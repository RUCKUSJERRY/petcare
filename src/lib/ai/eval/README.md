# LLM Eval (평가) 하네스

AI 기능을 "감"이 아니라 숫자로 판정하기 위한 평가 틀. 첫 대상은 OCR 구조화추출(영수증/증명서 > 레코드).

## 구성

- `types.ts` - 케이스/레코드/리포트/예측기 타입
- `ocrScore.ts` - 채점기(순수). 레코드 정렬(greedy) > 레코드 P/R/F1 + 매칭쌍 필드별 정확도(date/type/category/cost/name)
- `runOcrEval.ts` - 러너. `runOcrEval(dataset, predict)` 로 예측기만 바꿔 끼운다. `fixturePredictor`(오프라인 재생) 포함
- `dataset/ocr.json` - 합성 골드셋(실제 개인정보 아님). 각 케이스에 `gold` 와 오프라인용 `fixturePrediction`
- `../../../scripts/eval-ocr.mjs` - 리포트 출력 CLI (`npm run eval:ocr`)

## 설계 의도

- 데이터셋(입력+정답)과 채점기는 고정, "예측기(predict)"만 교체한다.
  - 오프라인: 저장된 `fixturePrediction` 재생 > 네트워크 없이 CI 에서 결정적으로 돈다.
  - 온라인: 실제 provider(Upstage/Gemini 등)로 추출해 비교 > 멀티모델 단계에서 같은 데이터셋으로
    모델별 F1 과 (ai_events 의) 비용을 함께 비교한다.
- 비용/정확도를 한 틀에서 보므로 "싼 모델로 바꿔도 품질이 유지되나"를 근거로 판단할 수 있다.

## 채점 방식 요약

1. 레코드 정렬: 모든 (gold, pred) 쌍의 유사도(날짜 0.4 + 종류 0.2 + 이름 0.3 + 금액 0.1)를 구해
   높은 순으로 1:1 매칭(임계값 0.3 이상). 못 잡은 정답=FN, 헛것=FP.
2. 레코드 단위: precision = matched/pred, recall = matched/gold, F1 = 조화평균.
   (빈 정답+빈 예측 = 완벽 1. 누락은 recall 로 드러나며 숨기지 않는다.)
3. 필드 정확도: 매칭쌍에서 날짜/종류/분류/금액 정확 일치율, 이름은 유사도 0.6 이상이면 정답.

## 확장(다음 단계)

- 라이브 예측기: OCR 추출을 호출하는 `predict` 를 붙여 모델별 비교.
- 챗 툴콜 정확도 / RAG 검색 품질(recall@k) 로 평가 대상 확대.
