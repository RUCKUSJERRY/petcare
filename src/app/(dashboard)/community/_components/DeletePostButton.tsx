'use client'

import { createClient } from '@/lib/supabase/client'
import { deleteImageByUrl } from '@/lib/upload'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div className="text-center space-y-1">
              <p className="font-bold text-gray-900 text-lg">글 삭제</p>
              <p className="text-sm text-gray-500">삭제한 글은 복구할 수 없어요. 정말 삭제할까요?</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={deleting}
                className="py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="py-3 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-60"
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
