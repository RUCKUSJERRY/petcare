'use client'

import { useEffect, useRef } from 'react'

/**
 * 접근성을 갖춘 확인 모달.
 * - role="dialog" + aria-modal, aria-labelledby/describedby
 * - Esc 키 / 배경 클릭으로 닫기
 * - 열릴 때 취소 버튼에 포커스, 닫힐 때 이전 포커스 복원
 * - 간단한 포커스 트랩(Tab 순환)
 */
export function ConfirmModal({
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const prevFocused = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (!busy) onCancel()
        return
      }
      if (e.key === 'Tab') {
        const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled])'
        )
        if (!nodes || nodes.length === 0) return
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    // 배경 스크롤 잠금
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      prevFocused?.focus?.()
    }
  }, [busy, onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={() => { if (!busy) onCancel() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby={description ? 'confirm-modal-desc' : undefined}
        className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center space-y-1">
          <p id="confirm-modal-title" className="font-bold text-gray-900 text-lg">{title}</p>
          {description && (
            <p id="confirm-modal-desc" className="text-sm text-gray-500">{description}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={busy}
            className="py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 ${
              destructive ? 'bg-red-500' : 'bg-primary-500'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
