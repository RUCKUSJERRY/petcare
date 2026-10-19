# 멀티에이전트 오케스트레이션

'케어 코디네이터'가 사용자 요청을 분석해 역할이 다른 전문 에이전트에 위임하고 결과를 합친다.
앞서 만든 부품을 총동원한다: 모델 레지스트리(멀티모델 라우팅) · RAG(근거 그라운딩) · 안전수칙.

```
query → route → [symptom-triage · records-analyst · nutrition · schedule] → synthesize → answer
         (키워드/LLM)      각 에이전트: 자기 systemPrompt + 모델작업(라우팅) + RAG 소스 근거
```

## 구성

- `types.ts` - AgentSpec / A2A 엔벨로프(AgentRequest·AgentResult) / AgentRunner / OrchestrationResult
- `registry.ts` - 전문 에이전트 4종(증상 트리아지 · 기록 분석 · 영양 · 일정). 역할·안전수칙·모델작업·RAG 소스·라우팅 신호
- `router.ts` - 키워드 라우터(순수·결정적) + LLM 라우터(프롬프트/파싱 순수)
- `orchestrator.ts` - route>위임>synthesize 제어 흐름(주입식). 부분 실패 허용(한 에이전트가 죽어도 진행)
- `runner.ts` - RAG 그라운딩 러너: `makeGroundedMockRunner`(오프라인·결정적) / `makeLlmAgentRunner`(모델 실행, 게이팅) / `buildSynthesisPrompt`
- `../../../scripts/agents-demo.mjs` - `npm run agents:demo [-- "질의"]` (오프라인 라우팅+그라운딩 시연)

## 설계 의도

- 제어 흐름(라우팅·위임·합성)과 실행(LLM)을 분리 — 흐름은 모크로 결정적 테스트, 실행만 바꿔 끼운다.
- A2A 스타일 엔벨로프로 에이전트 경계를 명확히 — 나중에 각 에이전트를 MCP 서버/원격 에이전트로 빼도
  코디네이터는 그대로.
- 각 에이전트는 좁은 책임 + 자기 근거(RAG) + 안전수칙. 모델은 작업 성격에 맞게 라우팅(싼/강한).

## 다음

- 실제 연결: `makeLlmAgentRunner` + LLM 신시사이저로 챗/전용 화면에 붙이기(모델 키).
- records-analyst 에 기록·통계 조회 툴 연결(walkStats·costStats·schedule 등 — 근거 코퍼스 대신 사용자 데이터).
- MCP: 에이전트/툴을 MCP 서버로 노출해 외부 클라이언트도 쓰게.
