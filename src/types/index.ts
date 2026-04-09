// ─── DB 테이블 타입 ───────────────────────────────────────────

export type SizeCategory = '소형' | '중형' | '대형'
export type SafetyLevel = 'safe' | 'caution' | 'dangerous'
export type Gender = '수컷' | '암컷'
export type HealthCategory = '질환' | '검진' | '백신' | '중성화'

export interface Breed {
  id: string
  name_ko: string
  name_en: string | null
  size_category: SizeCategory
  avg_lifespan: number
  characteristics: string | null
}

export interface Pet {
  id: string
  user_id: string
  name: string
  breed_id: string
  birth_year: number
  birth_month: number
  gender: Gender
  weight_kg: number | null
  photo_url: string | null
  created_at: string
  // join
  breed?: Breed
}

export interface FoodItem {
  id: string
  name_ko: string
  safety_level: SafetyLevel
  reason: string | null
  caution: string | null
}

export interface BreedFoodRule {
  id: string
  breed_id: string
  food_id: string
  override_safety: SafetyLevel
  note: string | null
}

export interface HealthGuide {
  id: string
  breed_id: string | null  // null = 모든 견종 공통
  age_month_min: number
  age_month_max: number
  category: HealthCategory
  title: string
  description: string
}

export interface WalkGuide {
  id: string
  breed_id: string | null
  age_month_min: number
  age_month_max: number
  daily_minutes: number
  intensity: '가벼움' | '보통' | '활발'
  tips: string | null
}

// ─── 뷰 / 계산 타입 ───────────────────────────────────────────

/** 반려동물의 현재 개월 수 계산 결과 */
export interface PetAge {
  months: number
  years: number
  displayText: string  // "3살 2개월"
  lifeStage: '퍼피' | '성견' | '시니어'
}

/** 음식 조회 시 견종 예외 적용 후 최종 결과 */
export interface FoodSafetyResult {
  food: FoodItem
  effectiveSafety: SafetyLevel
  breedNote: string | null  // 견종 예외가 있으면 표시
}
