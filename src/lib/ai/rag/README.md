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

## 다음 단계(고도화)

- 임베딩 생성: 모델 레지스트리(OpenAI 호환 embeddings)로 청크·질의 임베딩 > `setEmbeddings` 주입 > vector/hybrid 활성.
- 영속화: Supabase pgvector 에 청크 임베딩 저장(대규모·사용자 문서용).
- 리랭킹: 하이브리드 상위 N 을 교차 인코더/LLM 리랭커로 재정렬.
- 평가: Eval 하네스를 recall@k 로 확장해 각 단계(lexical > +vector > +rerank) 효과를 숫자로 검증.
