# RAG 검색 코어

앱 큐레이션 콘텐츠(careGuide/foodGuide/symptomGuide/seasonalCare)를 근거 코퍼스로 쓰는 검색 코어.
챗 답변을 '우리 정보 페이지'에 정렬시켜 환각을 줄이기 위한 것. 이 디렉터리는 전부 순수·테스트 가능하며
임베딩 생성·DB 없이 오프라인으로 동작한다(lexical). vector/hybrid 는 임베딩을 주입하면 켜진다.

## 파이프라인

```
guides(정적 TS)
  > corpus.ts   문서화(RagDoc: 제목+본문 평문화 + 링크/메타)
  > chunk.ts    청킹(문단 경계 + maxChars + overlap)
  > retriever.ts(RagIndex)
       searchLexical  : lexical.ts  BM25(한글 어절 + bigram 토큰)
       searchVector   : vector.ts   코사인 kNN(임베딩 주입)
       searchHybrid   : fuse.ts     RRF(lexical + vector 순위 융합)
```

## 구성 파일

- `types.ts` - RagDoc / RagChunk / Scored
- `corpus.ts` - 가이드 4종 > 문서. `buildCorpus()`
- `chunk.ts` - `chunkText` / `chunkDoc` / `chunkCorpus` (문단 경계·overlap)
- `lexical.ts` - `tokenize`(한글 bigram 포함) / `buildLexicalIndex` / `searchLexical`(BM25)
- `vector.ts` - `cosineSim` / `searchVector`(kNN)
- `fuse.ts` - `reciprocalRankFusion`(RRF)
- `retriever.ts` - `RagIndex`(lexical/vector/hybrid) / `buildRagIndex()`
- `../../../scripts/rag-demo.mjs` - `npm run rag:demo [-- "질의"]` (lexical 시연)

## 왜 하이브리드인가 (lexical 의 한계)

`npm run rag:demo` 를 돌려 보면 순수 BM25 가 표현이 조금만 달라도 엉뚱한 문서를 올리는 걸 볼 수 있다
(예: "양치" 질의에 어휘 겹침으로 "목욕"이 상위). 조사·동의어·의미 유사는 lexical 이 약하다 — 그래서
의미 축(vector)을 RRF 로 합치고, 상위 후보를 리랭커로 다시 정렬한다.

## 평가 · 고도화 (구현됨)

- `evalRetrieval.ts` - recall@k / precision@k / MRR / nDCG@k 채점(순수) + 러너. `dataset/retrieval.json` 라벨셋.
- `embed.ts` - OpenAI 호환 임베딩으로 청크·질의 벡터화 > vector/hybrid 활성. `embeddingSpecFromEnv`(전용 EMBEDDING_* > openai > upstage).
- `rerank.ts` - 하이브리드 상위 N 을 LLM 으로 재정렬(cross-encoder 리랭킹의 LLM 판). 프롬프트·파싱은 순수, 실패 시 원순서 보존.
- CLI `npm run rag:eval [-- --live]`:
  - 기본: lexical(BM25) recall@k 베이스라인(오프라인). 현재 recall@5 ≈ 83%.
  - `--live`: 임베딩/챗 키가 있으면 `lexical vs vector vs hybrid vs rerank` 를 한 표로 비교.

## 남은 선택지

- 영속화: Supabase pgvector 에 청크 임베딩 저장(정적 코퍼스는 50청크라 인메모리로 충분 — 대규모·사용자 문서 확장 시).
- 챗봇 연결: 하이브리드 검색 상위 스니펫을 챗 시스템 프롬프트에 근거로 주입(답변을 앱 정보와 정렬).
