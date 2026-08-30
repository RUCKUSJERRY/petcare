'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { useMyPets } from '@/hooks/useMyPets'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionTabs } from '@/components/ui/SectionTabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import { PetAvatar } from '@/components/ui/PetAvatar'
import { daysTogether } from '@/lib/utils'
import { computeCareLevel, computeCarePoints } from '@/lib/careLevel'
import { badgeProgress, computeBadges, type Badge, type BadgeCategory } from '@/lib/badges'

/**
 * 성취 컬렉션 화면 — 선택된 아이의 성장 레벨 + 획득/미획득 뱃지 모아보기.
 * 누적(단조 증가) 신호(기록·산책·함께한 날)만 사용해, 한 번 얻은 뱃지는 사라지지 않는다.
 */
export default function AchievementsPage() {
  const t = useTranslations('achievements')
  const supabase = createClient()
  const { selectedPetId } = useSelectedPet()
  const { data: pets } = useMyPets()
  const pet = pets?.find(p => p.id === selectedPetId) ?? null

  const { data, isLoading } = useQuery({
    queryKey: ['achievements', selectedPetId],
    enabled: !!selectedPetId,
    // 이 화면은 홈 카드처럼 상주하지 않고 사용자가 '진입'하는 목적지 페이지다. 레벨·뱃지는 누적
    // 기록 수·산책 수로 계산되는데, 그 값을 바꾸는 쓰기 경로(원탭·직접·스캔·비용·산책 저장/삭제 등)가
    // 여러 곳에 흩어져 있어 이 캐시 키를 개별 무효화로 챙기다 한 곳이라도 빠지면(실제로 어느 경로도
    // 무효화하지 않았다) 진입 시 옛 카운트가 최대 60초간 남아 캐릭터 카드(pet-care-points)와도
    // 어긋났다. 진입 시마다 새로 읽어(staleTime 0) 어떤 쓰기 경로를 거쳤든 항상 최신을 보장한다
    // — 카운트는 head 쿼리 2건으로 가볍다.
    staleTime: 0,
    queryFn: async () => {
      const [recCnt, walkCnt] = await Promise.all([
        supabase.from('records').select('id', { count: 'exact', head: true }).eq('pet_id', selectedPetId!),
        supabase.from('walks').select('id', { count: 'exact', head: true }).eq('pet_id', selectedPetId!),
      ])
      return { recordCount: recCnt.count ?? 0, walkCount: walkCnt.count ?? 0 }
    },
  })

  return (
    <div className="px-4 py-6 space-y-5">
      <PageHeader title={t('title')} fallbackHref="/dashboard" />

      {/* 형제 활동 화면(비용)으로 바로 이동 — 비용↔성취 상호 이동에 더보기를 거치지 않도록. */}
      <SectionTabs section="activity" />

      {!pet ? (
        // 예전엔 아이가 없거나 미선택일 때 CTA 없는 막다른 빈 화면이었다. 두 경우를 구분해
        // 실제로 나아갈 길을 준다 — 등록된 아이가 없으면 '등록하기', 있으면 '아이 선택' 안내.
        (pets?.length ?? 0) === 0 ? (
          <EmptyState
            icon="🏅"
            title={t('noPetTitle')}
            hint={t('noPetHint')}
            action={
              <Link href="/pets/new" className="btn-primary inline-flex px-4 py-2 text-sm">
                {t('registerPet')}
              </Link>
            }
          />
        ) : (
          <EmptyState icon="🏅" title={t('needPet')} hint={t('pickPetHint')} />
        )
      ) : isLoading || !data ? (
        <CardSkeletonList count={2} />
      ) : (
        <AchievementsBody
          name={pet.name}
          photoUrl={pet.photo_url}
          species={pet.species}
          recordCount={data.recordCount}
          walkCount={data.walkCount}
          togetherDays={daysTogether(pet.adopted_on)}
        />
      )}
    </div>
  )
}

function AchievementsBody({
  name, photoUrl, species, recordCount, walkCount, togetherDays,
}: {
  name: string
  photoUrl: string | null
  species: 'dog' | 'cat'
  recordCount: number
  walkCount: number
  togetherDays: number | null
}) {
  const t = useTranslations('achievements')
  const points = computeCarePoints(recordCount, walkCount)
  const level = computeCareLevel(points)
  const badges = computeBadges({ recordCount, walkCount, togetherDays })
  const prog = badgeProgress(badges)

  const cats: { key: BadgeCategory; label: string }[] = [
    { key: 'record', label: t('catRecord') },
    { key: 'walk', label: t('catWalk') },
    { key: 'together', label: t('catTogether') },
  ]

  return (
    <>
      {/* 성장 레벨 카드 */}
      <div className="card space-y-3">
        <div className="flex items-center gap-3">
          <PetAvatar photoUrl={photoUrl} species={species} name={name}
            className="w-12 h-12 bg-primary-100" emojiClassName="text-2xl" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400">{t('subtitle', { name })}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center gap-1 text-sm font-bold text-primary-600 bg-primary-50 rounded-full px-2.5 py-0.5">
                <span aria-hidden>⭐</span>{t('levelBadge', { level: level.level })}
              </span>
              <span className="text-sm font-bold text-gray-900 truncate">{level.title}</span>
            </div>
          </div>
        </div>
        <div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all"
              style={{ width: `${level.progressPct}%` }} />
          </div>
          <p className="text-[11px] text-gray-400 mt-1 text-right">
            {level.nextThreshold != null ? t('nextLevel', { points: level.nextThreshold - level.points }) : t('maxLevel')}
          </p>
        </div>
      </div>

      {/* 뱃지 컬렉션 */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900">🏅</h2>
        <span className="text-xs font-semibold text-gray-500">{t('badgeProgress', prog)}</span>
      </div>

      {cats.map(cat => (
        <div key={cat.key} className="space-y-2">
          <p className="text-xs font-semibold text-gray-400">{cat.label}</p>
          <div className="grid grid-cols-3 gap-2">
            {badges.filter(b => b.category === cat.key).map(b => (
              <BadgeTile key={b.id} badge={b} />
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

function BadgeTile({ badge }: { badge: Badge }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${badge.earned ? 'bg-white border-primary-200' : 'bg-gray-50 border-gray-100'}`}>
      <div className={`text-3xl leading-none ${badge.earned ? '' : 'grayscale opacity-40'}`} aria-hidden>
        {badge.icon}
      </div>
      <div className={`text-xs font-bold mt-1.5 truncate ${badge.earned ? 'text-gray-900' : 'text-gray-400'}`}>
        {badge.label}
      </div>
      {badge.earned ? (
        <div className="text-[10px] text-primary-600 font-semibold mt-0.5">✓</div>
      ) : (
        <>
          <div className="h-1 rounded-full bg-gray-200 overflow-hidden mt-1.5">
            <div className="h-full rounded-full bg-gray-300" style={{ width: `${badge.progressPct}%` }} />
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">{badge.current}/{badge.threshold}</div>
        </>
      )}
    </div>
  )
}
