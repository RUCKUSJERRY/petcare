'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toggleLike } from '../_actions'

export function LikeButton({
  postId,
  initialCount,
  initialLiked,
}: {
  postId: string
  initialCount: number
  initialLiked: boolean
}) {
  const t = useTranslations('community')
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [pending, setPending] = useState(false)
  // 실패 시 낙관적 업데이트를 조용히 되돌리면 사용자는 탭이 안 먹은 줄 알고 다시 누른다.
  // 잠깐 안내를 띄워 '나중에 다시 시도'임을 알린다(앱의 다른 쓰기 흐름과 동일한 피드백).
  const [failed, setFailed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const toggle = async () => {
    if (pending) return
    setPending(true)

    // 낙관적 업데이트
    const next = !liked
    setLiked(next)
    setCount(c => c + (next ? 1 : -1))

    // 서버 액션: DB 반영 + 목록/상세 revalidate
    const { error } = await toggleLike(postId, next)

    if (error) {
      // 실패 시 롤백 + 안내
      setLiked(!next)
      setCount(c => c + (next ? -1 : 1))
      setFailed(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setFailed(false), 2500)
    }
    setPending(false)
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={toggle}
        disabled={pending}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
          liked
            ? 'bg-red-50 border-red-200 text-red-600'
            : 'bg-white border-gray-200 text-gray-600'
        }`}
      >
        <span>{liked ? '❤️' : '🤍'}</span>
        <span>{count}</span>
      </button>
      {failed && (
        <p role="status" className="text-xs text-red-500">{t('likeFailed')}</p>
      )}
    </div>
  )
}
