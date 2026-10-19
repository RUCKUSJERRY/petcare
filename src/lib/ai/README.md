# petcare AI 아키텍처

이 앱에 들어간 AI 기능을 한 장으로 정리한 문서. 세부는 각 하위 폴더 README 참고
(`models/` `rag/` `agents/` `mcp/` `eval/`). 모든 핵심 로직은 순수 함수로 테스트 고정,
네트워크/DB 호출은 얇게 분리, 비용/품질 수치는 추정 없이 측정하는 것을 공통 원칙으로 함.

## 1. 적용 기술 한눈에

| 영역 | 위치 | 확인 |
|---|---|---|
| 옵저버빌리티 / 비용 | `telemetry.ts` `cost.ts` `usage.ts` `stats.ts`, `ai_events` 테이블, `/admin` 패널 | `npx vitest run src/lib/ai` |
| LLM 평가(Eval) | `eval/` (OCR 추출), `rag/evalRetrieval.ts` (검색) | `npm run eval:ocr`, `npm run rag:eval` |
| 멀티모델 / 오픈소스 LLM | `models/registry.ts` `models/routing.ts` | `npm run eval:ocr -- --live` |
| RAG(검색 증강) | `rag/` (코퍼스/청킹/BM25/벡터/RRF/리랭킹) | `npm run rag:demo`, `npm run rag:eval` |
| 멀티에이전트 오케스트레이션 | `agents/` | `npm run agents:demo` |
| MCP(에이전트 프로토콜) | `mcp/`, `/api/mcp` | `npm run mcp:demo` |
| 실제 챗봇 연결 | `chat/` (`route.ts` `tools.ts` `grounding.ts` `readTools.ts`) | `/chat` 화면, `/api/chat` |

기반: Vercel AI SDK(`ai`), OpenAI 호환 어댑터(`@ai-sdk/openai-compatible`), Supabase. 비밀키는 env 에만 둠.

## 2. 기술별 구현 방식과 확인 방법

### 2.1 옵저버빌리티 / 비용
- 구현: 완료된 LLM 호출 1건을 `ai_events` 1행으로 남김(provider/model/토큰/지연/비용/성공/트레이스ID).
  토큰 정규화(`usage.ts`)는 provider 3형태(AI SDK/OpenAI/Gemini)를 하나로 모으고, 비용(`cost.ts`)은
  토큰 x 단가로 계산하되 단가 미상이면 `null`(날조 금지). 집계(`stats.ts`)는 provider/model/feature 별
  호출수/성공률/비용/지연. 챗/OCR 라우트가 best-effort 로 기록하고 `/admin` 이 보여줌.
- 확인: `npx vitest run src/lib/ai/cost.test.ts src/lib/ai/usage.test.ts src/lib/ai/telemetry.test.ts src/lib/ai/stats.test.ts`.
  실데이터는 챗/스캔 사용 후 `/admin` 의 'AI 사용/비용' 패널.

### 2.2 LLM 평가(Eval)
- 구현: 두 평가. (1) OCR 구조화추출 - 레코드 정렬(greedy) 후 레코드 P/R/F1 + 필드 정확도
  (`eval/ocrScore.ts`), 합성 골드셋(`eval/dataset/ocr.json`), 예측기만 바꿔 끼우는 러너
  (`eval/runOcrEval.ts`), 실제 모델 예측기(`eval/livePredictor.ts`). (2) 검색 품질 - recall@k/
  precision@k/MRR/nDCG(`rag/evalRetrieval.ts`), 질의>관련문서 라벨셋(`rag/dataset/retrieval.json`).
- 확인: `npm run eval:ocr` (오프라인 고정 스냅샷 채점), `npm run rag:eval` (현재 lexical recall@5 약 83%).
  키가 있으면 `-- --live` 로 실제 모델 비교.

### 2.3 멀티모델 / 오픈소스 LLM
- 구현: Upstage/OpenAI/Groq/Together/OpenRouter/Ollama/Gemini 가 모두 OpenAI 호환 엔드포인트를
  제공하는 점을 이용해 `createOpenAICompatible` 하나로 연결(`models/registry.ts`). 오픈소스 모델
  (Llama/Qwen/Mistral)은 Groq/Together/Ollama/OpenRouter 경유로 같은 경로. env 에 키가 있는 provider 만
  '구성됨'으로 잡힘. 작업(chat/extract/classify)별 선호순 라우팅 + 폴백 + override(`models/routing.ts`).
  챗 provider 선택이 이 위에 얹혀 동작(기존 Upstage 단독 환경은 그대로 유지).
- 확인: `npx vitest run src/lib/ai/models`. 비교는 `npm run eval:ocr -- --live`(모델별 F1/비용/지연 표).

### 2.4 RAG(검색 증강)
- 구현: 앱 큐레이션 콘텐츠(돌봄/사료/증상/계절 가이드)를 코퍼스로 문서화(`rag/corpus.ts`) > 문단 경계+
  overlap 청킹(`rag/chunk.ts`) > 검색 세 축: BM25(한글 어절+bigram 토큰, `rag/lexical.ts`), 코사인
  벡터(`rag/vector.ts`), 하이브리드 RRF 융합(`rag/fuse.ts`). 임베딩은 주입식이라 코어는 순수
  (`rag/retriever.ts`), 실제 임베딩은 OpenAI 호환 embeddings 로 연결(`rag/embed.ts`). 하이브리드 상위
  후보를 LLM 으로 재정렬하는 리랭킹(`rag/rerank.ts`).
- 확인: `npx vitest run src/lib/ai/rag`. `npm run rag:demo "질의"` (lexical 검색 시연),
  `npm run rag:eval [-- --live]` (단계별 recall@k).

### 2.5 멀티에이전트 오케스트레이션
- 구현: '케어 코디네이터'가 요청을 분석해 전문 에이전트(증상 트리아지/기록 분석/영양/일정)에 위임하고
  결과를 합침(`agents/`). 각 에이전트는 역할/안전수칙/모델작업/근거 RAG 소스를 가짐(`agents/registry.ts`).
  라우팅(키워드+LLM, `agents/router.ts`)과 제어 흐름(위임/합성/부분 실패 허용, `agents/orchestrator.ts`)은
  주입식이라 모크로 결정적 테스트. 에이전트 간 메시지는 A2A 스타일 엔벨로프(`agents/types.ts`).
- 확인: `npx vitest run src/lib/ai/agents`. `npm run agents:demo` (라우팅+위임+RAG 근거 end-to-end, 키 불필요).

### 2.6 MCP(Model Context Protocol)
- 구현: 위 RAG/트리아지를 MCP 툴로 노출(`mcp/tools.ts`)해 외부 MCP 클라이언트가 '우리 돌봄 지식'을 쓰게 함.
  JSON-RPC 2.0 디스패처(initialize/tools.list/tools.call, 전송 무관, `mcp/server.ts`)와 HTTP 전송
  (`/api/mcp`) 분리. 읽기전용 공개 지식만 다뤄 인증/PII 없음.
- 확인: `npx vitest run src/lib/ai/mcp`. `npm run mcp:demo` (JSON-RPC 교환 시연). HTTP 는
  `curl -s -X POST http://localhost:3000/api/mcp -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`.

### 2.7 실제 챗봇 연결(위 조각들의 결합)
- 구현: 챗 라우트(`chat/route.ts`)가 쓰기 툴(기록/산책 생성)에 더해 읽기 툴(산책/비용/일정/최근기록 조회,
  RLS 로 본인 데이터만, 테스트된 통계 lib 재사용, `chat/tools.ts`+`chat/readTools.ts`)을 갖고, 마지막
  질문으로 RAG 근거를 검색해 시스템 프롬프트에 주입(`chat/grounding.ts`). 모델은 멀티모델 라우팅으로
  고르고, 모든 호출은 `ai_events` 로 계측됨.
- 확인: `npx vitest run src/lib/chat`. 실제 동작은 `/chat`(모델 키 필요).

## 3. 공통 설계 원칙
- 순수/부수효과 분리: 알고리즘(채점/검색/라우팅/집계)은 순수 함수로 테스트 고정, DB/네트워크는 얇은 래퍼.
- 측정 우선: 품질은 Eval(F1/recall@k), 비용/지연은 `ai_events`. 추정이 아니라 수치로 판단.
- 날조 금지: 단가/토큰 미상은 `null` 로 남겨 '모름'과 '0' 을 구분.
- 비파괴/게이팅: 기존 동작(Upstage 단독, 레이트리밋, 스트리밍)은 유지, 키 없는 환경은 오프라인 경로로 폴백.
- 키는 env 에만, 외부 노출(MCP)은 공개 지식만.

## 4. 이 앱에서 한 경험(학습 목표 대비)

| 해보고 싶던 것 | 이 앱에서 한 것 |
|---|---|
| 멀티에이전트 오케스트레이션 | 코디네이터 + 전문 에이전트 4종 위임/합성, A2A 엔벨로프, 부분 실패 허용 |
| MCP / A2A 등 에이전트 프로토콜 | JSON-RPC MCP 서버로 툴 노출(`/api/mcp`), A2A 스타일 메시지 경계 설계 |
| RAG 고도화(파싱/청킹/임베딩/벡터/하이브리드/리랭킹) | 코퍼스화 > 청킹 > BM25 + 벡터 + RRF 하이브리드 > LLM 리랭킹, recall@k 로 단계 검증 |
| LLM 평가(Eval) 체계 | OCR 추출 채점(P/R/F1/필드) + 검색 recall@k, 데이터셋/러너/CLI |
| LLM 옵저버빌리티 / 비용 관리 | `ai_events` 텔레메트리 + 토큰/비용 계산 + 관리자 패널 |
| 다양한 오픈소스 LLM 활용 | OpenAI 호환 레지스트리로 상용+오픈소스를 한 틀에, 작업별 라우팅 |

핵심 정리: '멀티모델 사용'은 부품(모델 라우팅), '오케스트레이션'은 조립 패턴(역할 분담 에이전트)이고,
이 앱에선 둘을 합쳐 각 에이전트가 작업에 맞는 모델로 라우팅되는 구조까지 경험함. 또한 측정(옵저버빌리티)>
평가(Eval)>선택(멀티모델)>검색 고도화(RAG)>조립(에이전트)>노출(MCP)의 순서로, 각 단계가 다음 단계의
근거가 되도록 쌓음.

## 5. 남은 선택지(미구현)
- 사용자 데이터 MCP 툴: 인증(OAuth/토큰) + RLS 경유로 기록/통계를 MCP 로도 노출(공개 지식과 분리).
- pgvector 영속화: 현재 정적 코퍼스(약 50청크)는 인메모리로 충분. 대규모/사용자 문서 확장 시 도입.
- 단가 라이브 관리: `cost.ts` 기본 단가를 `app_settings` 로 옮겨 관리자 화면에서 갱신.
