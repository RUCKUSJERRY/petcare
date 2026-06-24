'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Species } from '@/types'

/**
 * 반려동물 프로필 사진 아바타.
 * 사진(photoUrl)이 있으면 표시하고, 사진이 없거나 로딩에 실패하면
 * 종(species)에 맞는 이모지로 폴백한다. (스토리지에서 삭제됐거나 URL이
 * 깨진 경우에도 깨진 이미지 아이콘 대신 이모지가 보이도록 보완)
 *
 * 크기·배경은 className, 이모지 크기는 emojiClassName 으로 호출부에서 지정한다.
 */
export function PetAvatar({
  photoUrl,
  species,
  name,
  className,
  emojiClassName,
}: {
  photoUrl?: string | null
  species?: Species | string | null
  name?: string | null
  /** 원형 컨테이너 크기/배경 (예: 'w-14 h-14 bg-primary-100') */
  className?: string
  /** 이모지 폴백 크기 (예: 'text-2xl') */
  emojiClassName?: string
}) {
  const [failed, setFailed] = useState(false)
  const emoji = species === 'cat' ? '🐱' : '🐶'
  const showImg = !!photoUrl && !failed

  return (
    <div className={cn('rounded-full flex items-center justify-center overflow-hidden shrink-0', className)}>
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl!}
          alt={name ?? ''}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={emojiClassName} aria-hidden>{emoji}</span>
      )}
    </div>
  )
}
