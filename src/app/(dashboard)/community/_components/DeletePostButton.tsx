'use client'

import { createClient } from '@/lib/supabase/client'
import { deleteImageByUrl } from '@/lib/upload'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function DeletePostButton({ postId, imageUrl }: { postId: string; imageUrl?: string | null }) {
  const supabase = createClient()
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    const { error: delErr } = await supabase.from('posts').delete().eq('id', postId)
    if (delErr) {
      setDeleting(false)
      setError('삭제에 실패했어요.')
      setShowModal(false)
      return
    }
    // 첨부 이미지 정리(고아 방지)
    if (imageUrl) deleteImageByUrl(imageUrl)
    router.push('/community')
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="text-sm text-gray-400 hover:text-red-500"
      >
        삭제
      </button>

      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}

      {showModal && (
        <ConfirmModal
          title="글 삭제"
          description="삭제한 글은 복구할 수 없어요. 정말 삭제할까요?"
          confirmLabel={deleting ? '삭제 중...' : '삭제'}
          destructive
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setShowModal(false)}
        />
      )}
    </>
  )
}
