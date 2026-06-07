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

export type FoodCategory = '육류' | '채소' | '과일' | '유제품' | '기타'

export interface FoodItem {
  id: string
  name_ko: string
  safety_level: SafetyLevel
  reason: string | null
  caution: string | null
  category: FoodCategory | null
  source: string | null  // 데이터 근거 출처 (예: ASPCA, AKC)
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
  breed_id: string | null       // 특정 견종
  size_category: SizeCategory | null  // 크기 그룹
  // breed_id, size_category 모두 null = 전체 공통
  age_month_min: number
  age_month_max: number
  category: HealthCategory
  title: string
  description: string
}

export interface WalkGuide {
  id: string
  breed_id: string | null       // 특정 견종
  size_category: SizeCategory | null  // 크기 그룹
  // breed_id, size_category 모두 null = 전체 공통
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

// ─── 커뮤니티 ────────────────────────────────────────────────

export type PostCategory = '질문' | '자랑' | '정보공유' | '일상'

export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  created_at: string
}

export interface Post {
  id: string
  user_id: string
  category: PostCategory
  title: string
  content: string
  breed_id: string | null
  image_url: string | null
  like_count: number
  created_at: string
  updated_at: string
}

/** post_list 뷰: posts + 작성자/견종/댓글수 조인 결과 */
export interface PostListItem extends Post {
  author_name: string | null
  author_avatar: string | null
  breed_name: string | null
  comment_count: number
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  // join
  author?: Pick<Profile, 'display_name' | 'avatar_url'>
}

// ─── 내 아이 기록 ────────────────────────────────────────────

export interface WeightLog {
  id: string
  pet_id: string
  weight_kg: number
  measured_on: string  // YYYY-MM-DD
  note: string | null
  created_at: string
}

export interface VaccinationRecord {
  id: string
  pet_id: string
  vaccine_name: string
  vaccinated_on: string   // YYYY-MM-DD
  next_due_on: string | null
  clinic: string | null
  note: string | null
  created_at: string
}
