'use client'

import { useEffect, useState } from 'react'
import { timeAgo } from '@/lib/utils'

/**
 * 상대 시간("방금 전"·"3시간 전")을 하이드레이션 안전하게 그리는 표시용 컴포넌트.
 *
 * timeAgo() 는 Date.now() 를 읽어 비결정적이라, 서버에서 렌더된 HTML(그 시점 기준)과
 * 클라이언트 첫 렌더(조금 뒤 시점)가 분 경계에서 어긋나 React 하이드레이션 불일치·깜빡임이
 * 났다. (initialPosts·initialComments 처럼 서버 데이터를 받는 클라이언트 컴포넌트에서 발생)
 *
 * 해결: 서버·첫 클라이언트 렌더는 '측정 시점 없이도 동일한' 절대 날짜로 그려 일치시키고,
 * 마운트 후에만 현재 시각 기준 상대시간으로 바꾼다.
 */
export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  // 마운트 후에만 현재 시각을 채운다 → 서버/첫 렌더는 now=null 로 절대 날짜만 그린다.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    // 화면에 오래 머물러도 상대시간이 자연스럽게 갱신되도록 1분마다 갱신한다.
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const text = now == null ? absDate(iso) : timeAgo(iso, now)
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {text}
    </time>
  )
}

/** 시점에 무관한 결정적 표시(월·일) — 하이드레이션 기준 텍스트로 사용 */
function absDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}
