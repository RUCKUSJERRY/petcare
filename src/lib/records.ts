import type { RecordCategory } from '@/types'

/** 전체 카테고리 (그룹 순서대로) */
export const RECORD_CATEGORIES: RecordCategory[] = [
  '진료', '접종', '심장사상충', '구충', '외부기생충', '건강검진',
  '미용', '양치', '발톱', '목욕', '귀청소',
  '식사', '간식', '물', '소변', '대변', '투약', '증상', '기타',
]

/** 원탭으로 "지금" 남기는 생활기록 카테고리(오늘의 기록 바 순서). 육아앱식 빠른 로깅 대상. */
export const DAILY_LOG_CATEGORIES: RecordCategory[] = [
  '식사', '간식', '물', '소변', '대변', '투약', '증상',
]

/** 생활기록 여부 — 일정(예정/반복) 대신 시간순 타임라인으로 다루는 카테고리 */
export const DAILY_LOG_SET = new Set<RecordCategory>(DAILY_LOG_CATEGORIES)

/** 항목명 미입력 시 사용할 기본 제목(생활기록은 카테고리명을 그대로 제목으로). */
export function defaultRecordTitle(category: RecordCategory): string {
  return category
}

/** 항목명(title)이 서로 달라야 별개 일정으로 보는 카테고리(제품/백신 구분).
 *  그 외는 카테고리 단위로 "최신 1건"만 집계한다. (일정 중복 방지) */
export const PRODUCT_CATEGORIES = new Set<RecordCategory>([
  '접종', '심장사상충', '구충', '외부기생충',
])

/** 상세 테이블이 있는 카테고리만 매핑(없으면 공통 컬럼만 사용) */
export const DETAIL_TABLE: Partial<Record<RecordCategory, 'record_medical' | 'record_grooming' | 'record_meal'>> = {
  진료: 'record_medical',
  미용: 'record_grooming',
  식사: 'record_meal',
  간식: 'record_meal',
}

export type DetailFieldType = 'text' | 'textarea' | 'number' | 'select'
export type DetailField = {
  key: string
  label: string
  type: DetailFieldType
  placeholder?: string
  options?: string[]
}

export type CategoryConfig = {
  /** 공통 title 입력의 라벨/플레이스홀더 */
  titleLabel: string
  titlePlaceholder: string
  /** 상세 테이블의 입력 필드(없으면 빈 배열) */
  fields: DetailField[]
}

/** 카테고리별 입력 명세 — 동적 폼과 상세 표시의 단일 출처(상세 테이블 컬럼과 1:1) */
export const CATEGORY_CONFIG: Record<RecordCategory, CategoryConfig> = {
  진료: {
    titleLabel: '진단 · 주제', titlePlaceholder: '예: 외이염, 정기검진',
    fields: [
      { key: 'reason', label: '증상 · 내원 사유', type: 'text', placeholder: '예: 구토, 절뚝거림' },
      { key: 'treatment', label: '처치 · 치료', type: 'textarea', placeholder: '예: 귀 세정, 소염 주사' },
      { key: 'medication', label: '처방약', type: 'text', placeholder: '예: 항생제 7일분' },
    ],
  },
  접종: { titleLabel: '백신명', titlePlaceholder: '예: 종합백신 DHPPL', fields: [] },
  심장사상충: { titleLabel: '제품명', titlePlaceholder: '예: 하트가드, 애드보킷', fields: [] },
  구충: { titleLabel: '제품명', titlePlaceholder: '예: 드론탈, 파나쿠어', fields: [] },
  외부기생충: { titleLabel: '제품명', titlePlaceholder: '예: 넥스가드, 프론트라인', fields: [] },
  건강검진: { titleLabel: '항목명', titlePlaceholder: '예: 혈액검사, 엑스레이', fields: [] },
  미용: {
    titleLabel: '항목명', titlePlaceholder: '예: 전체미용, 위생미용',
    fields: [
      { key: 'method', label: '방식', type: 'select', options: ['직접', '업체'] },
      { key: 'vendor', label: '업체명', type: 'text', placeholder: '예: ○○펫살롱' },
      { key: 'groom_type', label: '미용 종류', type: 'text', placeholder: '예: 클리핑, 위생미용' },
    ],
  },
  양치: { titleLabel: '항목명', titlePlaceholder: '예: 양치, 치석 관리', fields: [] },
  발톱: { titleLabel: '항목명', titlePlaceholder: '예: 발톱 깎기', fields: [] },
  목욕: { titleLabel: '항목명', titlePlaceholder: '예: 목욕', fields: [] },
  귀청소: { titleLabel: '항목명', titlePlaceholder: '예: 귀 세정', fields: [] },
  식사: {
    titleLabel: '항목명', titlePlaceholder: '예: 아침 식사',
    fields: [
      { key: 'food_kind', label: '종류', type: 'text', placeholder: '예: 건사료 / 습식 / 화식' },
      { key: 'mix', label: '혼합 구성', type: 'text', placeholder: '예: 건사료 + 습식 토핑' },
      { key: 'amount', label: '양', type: 'text', placeholder: '예: 80g' },
    ],
  },
  간식: {
    titleLabel: '항목명', titlePlaceholder: '예: 덴탈껌',
    fields: [
      { key: 'food_kind', label: '종류', type: 'text', placeholder: '예: 덴탈껌 / 육포' },
      { key: 'mix', label: '구성', type: 'text', placeholder: '예: 닭가슴살' },
      { key: 'amount', label: '양', type: 'text', placeholder: '예: 1개' },
    ],
  },
  물: { titleLabel: '메모', titlePlaceholder: '예: 평소량 / 적게 마심 (선택)', fields: [] },
  소변: { titleLabel: '상태 · 메모', titlePlaceholder: '예: 정상 / 자주 / 색 진함 (선택)', fields: [] },
  대변: { titleLabel: '상태 · 메모', titlePlaceholder: '예: 정상 / 무름 / 설사 / 혈변 (선택)', fields: [] },
  투약: { titleLabel: '약 이름', titlePlaceholder: '예: 심장약, 관절영양제 (선택)', fields: [] },
  증상: { titleLabel: '증상', titlePlaceholder: '예: 구토 2회, 기침, 다리 절뚝 (선택)', fields: [] },
  기타: { titleLabel: '항목명', titlePlaceholder: '항목명', fields: [] },
}
