# MCP 서버 (petcare-knowledge)

petcare 의 공개 반려동물 지식을 MCP(Model Context Protocol)로 노출해, 외부 MCP 클라이언트
(Claude Desktop 등)가 "우리 돌봄 가이드·증상 트리아지"를 툴로 쓰게 한다. 앞서 만든 RAG 검색과
증상 트리아지 에이전트를 그대로 재사용한다.

읽기전용 + 큐레이션 콘텐츠만 다룬다 — 인증·PII 없음. (사용자 기록 노출은 인증이 필요해 다음 단계.)

## 노출 툴

- `search_pet_care_knowledge` - 돌봄 지식 검색(query, 선택 source/topK) > 관련 구절 + 출처 링크
- `list_knowledge_topics` - 영역(care/food/symptom/seasonal)별 주제 목록
- `triage_pet_symptom` - 증상 설명 > 관련 증상 가이드 + 출처 + 안전 주의

## 구성

- `tools.ts` - 툴 정의(name·description·inputSchema·handler). 핸들러는 RAG/에이전트 재사용(오프라인·결정적)
- `server.ts` - JSON-RPC 2.0 디스패처(initialize / tools/list / tools/call / ping / notifications). 전송 무관·순수
- `../../../app/api/mcp/route.ts` - Streamable HTTP 전송(POST JSON-RPC, 배치·알림 지원). GET 은 헬스체크
- `../../../scripts/mcp-demo.mjs` - `npm run mcp:demo` (initialize>list>call 교환 시연, 오프라인)

## 연결 (HTTP)

MCP 클라이언트의 HTTP 서버 URL 로 배포 주소의 `/api/mcp` 를 지정하면 된다. 빠른 확인:

```
curl -s -X POST http://localhost:3000/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## 설계 의도

- 전송(HTTP/stdio)과 프로토콜 처리(디스패처)를 분리 — 디스패처는 순수라 결정적으로 테스트.
- 에이전트의 A2A 엔벨로프·RAG 가 그대로 MCP 툴로 매핑 — 내부 기능을 표준 프로토콜 경계로 재노출.
- 툴 실행 오류는 JSON-RPC 에러가 아니라 `isError` 결과로(관례) — 클라이언트가 모델에 전달해 복구 가능.

## 다음

- 사용자 데이터 툴(기록·통계)은 인증(OAuth/토큰) + RLS 경유로 추가 — 공개 지식과 분리.
