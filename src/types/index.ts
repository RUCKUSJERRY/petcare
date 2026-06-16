// ─── DB 테이블 타입 ───────────────────────────────────────────

export type SizeCategory = '소형' | '중형' | '대형'
export type SafetyLevel = 'safe' | 'caution' | 'dangerous'
export type Gender = '수컷' | '암컷'
export type HealthCategory = '질환' | '검진' | '백신' | '중성화'
export type Species = 'dog' | 'cat'

export interface Breed {
  id: string
  name_ko: string
  name_en: string | null
  size_category: SizeCategory
  avg_lifespan: number
  characteristics: string | null
  species: Species
}

export interface Pet {
  id: string
  user_id: string
  name: string
  breed_id: string
  species: Species
  birth_year: number
  birth_month: number
  gender: Gender
  weight_kg: number | null
  photo_url: string | null
  created_at: string
  // join
  breed?: Breed
}

export type PetMemberRole = 'owner' | 'member'

/** 반려동물 공동 관리 구성원 */
export interface PetMember {
  pet_id: string
  user_id: string
  role: PetMemberRole
  created_at: string
  // join
  profile?: Pick<Profile, 'display_name' | 'avatar_url'>
}

export type FoodCategory = '육류' | '채소' | '과일' | '유제품' | '기타'

/** 음식 마스터 (종 무관) */
export interface FoodItem {
  id: string
  name_ko: string
  category: FoodCategory | null
}

/** 종별 음식 안전도 */
export interface FoodSafety {
  id: string
  food_id: string
  species: Species
  safety_level: SafetyLevel
  reason: string | null
  caution: string | null
  source: string | null  // 데이터 근거 출처 (예: ASPCA, AKC)
}

/** 음식 + 특정 종 안전도 조인 결과 (UI용) */
export interface FoodWithSafety extends FoodItem {
  safety: FoodSafety | null
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
  species: Species
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
  species: Species
  breed_id: string | null       // 특정 견종
  size_category: SizeCategory | null  // 크기 그룹
  // breed_id, size_category 모두 null = 전체 공통
  age_month_min: number
  age_month_max: number
  activity_type: string         // '산책' | '실내놀이' | '인지훈련' | '사냥놀이' | '실내탐험'
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
  lifeStage: '퍼피' | '성견' | '시니어' | '키튼' | '성묘'
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
  parent_id: string | null
  content: string
  created_at: string
  updated_at: string
  // join
  author?: Pick<Profile, 'display_name' | 'avatar_url'>
}

// ─── 알림 ────────────────────────────────────────────────────

export type NotificationType = 'comment' | 'like' | 'reply'

/** notification_list 뷰: 알림 + actor 프로필 + 게시글 제목 */
export interface NotificationItem {
  id: string
  recipient_id: string
  actor_id: string
  type: NotificationType
  post_id: string | null
  comment_id: string | null
  read: boolean
  created_at: string
  // join
  actor_name: string | null
  actor_avatar: string | null
  post_title: string | null
}

// ─── 실종 반려동물 ───────────────────────────────────────────

export type LostPetStatus = 'active' | 'found'

export interface LostPet {
  id: string
  user_id: string
  name: string | null
  species: Species
  breed_id: string | null
  gender: Gender | null
  photo_url: string | null
  lost_at: string        // YYYY-MM-DD
  lat: number
  lng: number
  area_text: string | null
  description: string | null
  contact: string | null
  contact_public: boolean
  status: LostPetStatus
  created_at: string
  updated_at: string
  // join
  breed?: Pick<Breed, 'name_ko'>
}

export interface LostPetSighting {
  id: string
  lost_pet_id: string
  user_id: string
  content: string
  lat: number | null
  lng: number | null
  created_at: string
  author?: Pick<Profile, 'display_name' | 'avatar_url'>
}

// ─── 지도 즐겨찾기 ───────────────────────────────────────────

export interface MapFavorite {
  id: string
  user_id: string
  place_id: string
  place_name: string
  category: string | null
  address: string | null
  phone: string | null
  lat: number
  lng: number
  place_url: string | null
  created_at: string
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

/** 통합 기록 카테고리 (구글 캘린더형 단일 모델) */
export type RecordCategory =
  | '접종' | '심장사상충' | '구충' | '외부기생충' | '건강검진' | '진료'
  | '미용' | '양치' | '발톱' | '목욕' | '귀청소' | '식사' | '간식'
  | '기타'

/** 통합 기록 (records 테이블) — 캘린더/목록은 이 공통 컬럼만 사용 */
export interface PetRecord {
  id: string
  pet_id: string
  category: RecordCategory
  title: string
  event_on: string             // 시행/진료/발생일 YYYY-MM-DD
  place_name: string | null
  place_lat: number | null
  place_lng: number | null
  cost: number | null
  memo: string | null
  photo_url: string | null
  recur_rule: string | null            // 반복 규칙(JSON 직렬화). null = 1회성
  next_due_on: string | null
  created_at: string
}

/** 카테고리별 상세 (상세 진입 시에만 조회) */
export interface MedicalDetail { record_id: string; reason: string | null; treatment: string | null; medication: string | null }
export interface GroomingDetail { record_id: string; method: string | null; vendor: string | null; groom_type: string | null }
export interface MealDetail { record_id: string; food_kind: string | null; mix: string | null; amount: string | null }

/** 대시보드 D-day 알림용 경량 타입 */
export interface CareAlert {
  pet_id: string
  category: RecordCategory
  title: string
  next_due_on: string
}

// ─── 산책 기록 ───────────────────────────────────────────────

/** 경로 좌표 한 점 [위도, 경도] */
export type WalkPoint = [number, number]

/** 산책 기록 */
export interface Walk {
  id: string
  user_id: string
  pet_id: string | null
  title: string | null
  started_at: string
  ended_at: string
  duration_s: number
  distance_m: number
  path: WalkPoint[]
  is_public: boolean
  area_text: string | null
  note: string | null
  photo_url: string | null
  like_count: number
  created_at: string
  // join (공유 피드용)
  pet_name?: string | null
  author_name?: string | null
}

/** 산책 댓글 */
export interface WalkComment {
  id: string
  walk_id: string
  user_id: string
  content: string
  created_at: string
  // join
  author?: Pick<Profile, 'display_name' | 'avatar_url'>
}
