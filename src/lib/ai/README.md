# petcare AI 아키텍처

펫케어 앱에 넣은 AI 기능을 정리한 문서. 세 가지를 다룸 - 무슨 기술을 구현했는지(1절),
그걸로 무엇을 배웠는지(2절), 실제로 어떻게 써보는지(3절, 화면과 운영 둘 다).

설계 원칙은 하나로 꿰짐: 핵심 로직은 순수 함수로 테스트 고정, 네트워크/DB 는 얇게 분리,
비용/품질은 추정 없이 측정.

세부는 하위 폴더 README 참고: `models/` `rag/` `agents/` `mcp/` `eval/`.
기반: Vercel AI SDK(`ai`) + OpenAI 호환 어댑터(`@ai-sdk/openai-compatible`) + Supabase. 비밀키는 env 에만 둠.

---

## 1. 구현한 AI 기술

| # | 기술 | 한 일 | 핵심 위치 |
|---|---|---|---|
| 1 | 옵저버빌리티 / 비용 | LLM 호출 1건 = `ai_events` 1행(토큰/지연/비용/성공). 단가 미상은 null(날조 금지) | `telemetry.ts` `cost.ts` `usage.ts` `stats.ts` |
| 2 | 평가(Eval) | OCR 추출 채점(P/R/F1/필드) + 검색 품질(recall@k/MRR/nDCG) | `eval/` `rag/evalRetrieval.ts` |
| 3 | 멀티모델 / 오픈소스 | OpenAI 호환 하나로 7개 provider 연결(OSS 포함) + 작업별 라우팅 | `models/registry.ts` `models/routing.ts` |
| 4 | RAG | 코퍼스 > 청킹 > BM25 + 벡터 + RRF 하이브리드 > LLM 리랭킹 | `rag/` |
| 5 | 멀티에이전트 | 코디네이터가 전문 에이전트 4종에 위임/합성(A2A 엔벨로프) | `agents/` |
| 6 | MCP | 기능을 JSON-RPC 툴로 노출(공개 지식 + 토큰 시 개인 데이터) | `mcp/` `/api/mcp` |
| - | 실제 연결 | 챗봇에 RAG 근거 + 읽기/쓰기 툴 + 멀티모델 + 계측 결합 | `chat/` `/api/chat` |

provider 매트릭스(모두 OpenAI 호환 경로):

| 종류 | provider | 대표 모델 |
|---|---|---|
| 상용 | upstage, openai, gemini | solar-pro2, gpt-4o-mini, gemini-3.6-flash |
| 오픈소스 | groq, together, openrouter, ollama | Llama 3.3, Qwen 2.5, Mistral 등 |

---

## 2. 이 앱으로 학습한 것

| 해보고 싶던 것 | 이 앱에서 한 것 | 대표 산출물 |
|---|---|---|
| 멀티에이전트 오케스트레이션 | 코디네이터 + 전문 에이전트 4종, 부분 실패 허용 | `agents/orchestrator.ts` |
| MCP / A2A 프로토콜 | JSON-RPC MCP 서버(공개+개인 토큰), A2A 메시지 경계 | `mcp/server.ts` `/api/mcp` |
| RAG 고도화 | 파싱/청킹/임베딩/벡터/하이브리드/리랭킹 + recall@k 검증 | `rag/` |
| LLM 평가 체계 | OCR/검색 두 축 채점 + 데이터셋/러너/CLI | `eval/` `rag/evalRetrieval.ts` |
| 옵저버빌리티 / 비용 | `ai_events` + 토큰/비용 계산 + 관리자 패널 | `telemetry.ts` `/admin` |
| 다양한 오픈소스 LLM | 레지스트리로 상용+OSS 한 틀, 작업별 라우팅 | `models/` |

쌓은 순서(각 단계가 다음의 근거):

```
측정(옵저버빌리티) > 평가(Eval) > 모델 선택(멀티모델) > 검색 고도화(RAG) > 조립(에이전트) > 노출(MCP)
```

참고로 '멀티모델'과 '오케스트레이션'은 층위가 다름 - 멀티모델은 부품(작업에 맞는 모델 선택),
오케스트레이션은 조립 패턴(역할 나눈 에이전트들의 협업). 이 앱은 둘을 합쳐, 각 에이전트가
자기 작업에 맞는 모델로 라우팅되는 데까지 해봄.

---

## 3. 어떻게 써보나

두 갈래로 나눔 - 앱 화면에서 쓰는 법(사용자), 그리고 배포된 앱을 점검하는 법(운영/개발).
둘 다 서버 env 에 모델 키가 있어야 실제 모델이 돎(키가 없으면 공개 지식/오프라인 경로만).

### 3.1 화면에서 쓰는 법 (사용자)

| 기능 | 어디서 | 어떻게 쓰나 |
|---|---|---|
| AI 케어 도우미(챗봇) | 홈의 🤖 타일 또는 더보기 > AI 도우미 (`/chat`) | 질문을 입력. 예: "이번 주 산책 몇 번 했어?"(내 기록 조회), "강아지 양치 어떻게 해?"(가이드 근거로 답), "오늘 사료 50g 먹었어 기록해줘"(기록 생성) |
| 영수증/문서 스캔 | 아이 상세 화면 > 사진/스캔 | 진료 영수증이나 접종증명서를 촬영하면 날짜/금액/항목을 자동 추출해 기록에 채워줌 |
| AI 사용/비용 현황 | 더보기 > 관리자 (`/admin`, 관리자만) | 기간별 호출수/토큰/비용/성공률을 패널로 확인 |

RAG 근거 주입, 멀티모델 라우팅, 멀티에이전트, 평가는 겉으로 드러나는 버튼이 아니라 챗봇 답변의
품질로 체감되는 '내부 동작'임. 동작 자체를 직접 눈으로 보려면 아래 운영/개발 경로를 씀.

### 3.2 운영/개발용 준비 (env 키 > 켜지는 기능)

| env | 켜지는 기능 |
|---|---|
| `UPSTAGE_API_KEY` 또는 `OPENAI_API_KEY` | 챗봇 / OCR / 추출(실모델) |
| `OPENAI_API_KEY` | 임베딩 > RAG 벡터/하이브리드 |
| `GROQ_API_KEY` / `TOGETHER_API_KEY` / `OPENROUTER_API_KEY` / `OLLAMA_BASE_URL` | 오픈소스 모델 라우팅 |
| (키 없음) | 공개 지식 / 오프라인 경로만 |

상세는 `.env.local.example` 의 '멀티 provider'. `BASE_URL` 은 배포 주소 또는 로컬 `npm run dev`.

### 3.3 엔드포인트

| 경로 | 메서드 | 인증 | 용도 |
|---|---|---|---|
| `/chat` | 화면 | 로그인 | 챗봇(데이터 질문=읽기 툴, 일반 질문=RAG 근거) |
| `/api/mcp` | POST | 없음 / Bearer | MCP 툴(공개 지식 / 토큰 시 개인 데이터) |
| `/api/mcp/tokens` | POST/GET/DELETE | 로그인 | 개인 MCP 토큰 발급/목록/폐기 |
| `/api/admin/ai/health?ping=1` | GET | 관리자 | provider/임베딩 구성 + 실모델 핑 |
| `/api/admin/ai/rag` | POST | 관리자 | 라이브 검색(`mode: "hybrid"`) |
| `/api/admin/ai/agents` | POST | 관리자 | 라이브 오케스트레이션(`live: true`) |
| `/admin` | 화면 | 관리자 | AI 사용/비용 패널 |

### 3.4 빠른 점검

```
# 공개 MCP 자동 점검(HTTP)
BASE_URL=https://<배포주소> npm run smoke

# MCP 공개 지식 호출
curl -s -X POST $BASE_URL/api/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_pet_care_knowledge","arguments":{"query":"양치"}}}'

# 관리자: 실모델 연결/지연 확인 (관리자 로그인 쿠키 필요)
curl -s "$BASE_URL/api/admin/ai/health?ping=1"
```

### 3.5 개인 데이터 MCP (3단계)

```
1) 로그인 상태에서  POST /api/mcp/tokens   > 응답의 token 은 1회만 노출(pck_...)
2) MCP_TOKEN=pck_... BASE_URL=... npm run smoke   > 개인 데이터 툴까지 점검
3) 외부 클라이언트는 Authorization: Bearer pck_... 로 /api/mcp 호출
```

데이터는 토큰 주인이 구성원인 반려동물(`pet_members`)로만 격리됨(타 사용자 차단).

---

## 4. 아키텍처 흐름

```
사용자 질문
  |
  +-- /chat      > RAG 근거주입(grounding) + 읽기/쓰기 툴(tools) + 멀티모델(models) > 답변
  |
  +-- /api/mcp   > MCP 툴 (공개 지식 / 토큰 시 개인 데이터)
  |
  +-- 코디네이터(agents) > 전문 에이전트 > RAG(rag) + 모델

  [공통] 모든 LLM 호출 > ai_events(telemetry) > /admin 비용/품질 패널
```

---

## 5. 테스트 / 품질

| 영역 | 명령 |
|---|---|
| 전체 단위 테스트 (467건) | `npm test` |
| OCR 추출 Eval | `npm run eval:ocr` ( `-- --live` 로 모델 비교) |
| RAG 검색 Eval (recall@k) | `npm run rag:eval` ( `-- --live` ) |
| RAG 검색 데모 | `npm run rag:demo "질의"` |
| 멀티에이전트 데모 | `npm run agents:demo` |
| MCP 데모 | `npm run mcp:demo` |
| 운영 스모크 (HTTP) | `BASE_URL=... npm run smoke` |

현재 lexical 검색 베이스라인 recall@5 약 83%. 임베딩 키가 있으면 `--live` 로 vector/hybrid/rerank 대비 확인.

---

## 6. 남은 선택지(미구현)
- pgvector 영속화: 정적 코퍼스(약 50청크)는 인메모리로 충분. 대규모/사용자 문서 확장 시 도입.
- 단가 라이브 관리: `cost.ts` 기본 단가를 `app_settings` 로 옮겨 관리자 화면에서 갱신.
- 토큰 발급 UI: 현재 `/api/mcp/tokens` API 만 있음. 프로필 화면에 발급/폐기 UI 추가 여지.
