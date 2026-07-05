'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 작성 중(dirty) 폼에서 뒤로가기/새로고침으로 입력이 통째로 날아가는 것을 막는 가드.
 *
 * 동작
 *  - 새로고침·탭 닫기: `beforeunload` 로 브라우저 기본 경고.
 *  - 앱 내 뒤로가기(스와이프/하드웨어/router.back): 마운트 시 히스토리에 가드 항목을 하나 쌓아두고,
 *    popstate(뒤로가기 시도) 때 dirty 면 다시 쌓아 실제 이탈을 막고 확인 모달을 띄운다.
 *    깨끗하면 그대로 뒤로 보낸다.
 *
 * 반환한 `promptLeave` 가 true 면 페이지에서 ConfirmModal 을 띄우고,
 * 확인 시 `confirmLeave()`(직전 화면으로 실제 이탈), 취소 시 `cancelLeave()` 를 연결한다.
 *
 * Next.js App Router 는 라우팅 차단 API 가 없어 popstate 기반 가드를 쓴다.
 */
export function useUnsavedGuard(dirty: boolean) {
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const bypass = useRef(false)
  const [promptLeave, setPromptLeave] = useState(false)

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current || bypass.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    // 가드 항목을 하나 쌓아, 뒤로가기 시 이 항목이 먼저 소비되도록 한다(같은 URL).
    window.history.pushState(null, '', window.location.href)

    const onPopState = () => {
      if (bypass.current) return
      if (!dirtyRef.current) {
        // 깨끗함 → 방금 가드 항목이 소비됐으니 한 번 더 뒤로 보내 실제 이탈시킨다.
        bypass.current = true
        window.history.back()
        return
      }
      // 작성 중 → 가드 항목을 다시 쌓아 이탈을 막고 확인을 요청한다.
      window.history.pushState(null, '', window.location.href)
      setPromptLeave(true)
    }
    window.addEventListener('popstate', onPopState)

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('popstate', onPopState)
    }
    // 마운트 시 1회만 — 최신 dirty 는 ref 로 읽는다(작성 중 매 입력마다 가드 항목이 쌓이지 않도록).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 확인 후 실제 이탈: 모달 표시 시점엔 [이전화면, 폼, 가드] 상태이므로 두 단계 뒤로 간다.
  const confirmLeave = useCallback(() => {
    bypass.current = true
    setPromptLeave(false)
    window.history.go(-2)
  }, [])

  const cancelLeave = useCallback(() => setPromptLeave(false), [])

  return { promptLeave, confirmLeave, cancelLeave }
}
