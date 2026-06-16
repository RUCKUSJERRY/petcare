'use client'

import { createClient } from '@/lib/supabase/client'
import { deleteImageByUrl } from '@/lib/upload'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useTranslations } from 'next-intl'

export function DeletePostButton({ postId, imageUrls = [] }: { postId: string; imageUrls?: string[] }) {
  const t = useTranslations('community')
  const tc = useTranslations('common')
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
      setError(t('deletePostFailed'))
      setShowModal(false)
      return
    }
    // 첨부 이미지 정리(고아 방지)
    imageUrls.forEach(deleteImageByUrl)
    router.push('/community')
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="text-sm text-gray-400 hover:text-red-500"
      >
        {tc('delete')}
      </button>

      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}

      {showModal && (
        <ConfirmModal
          title={t('deletePostTitle')}
          description={t('deletePostConfirm')}
          confirmLabel={deleting ? t('deleting') : tc('delete')}
          destructive
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setShowModal(false)}
        />
      )}
    </>
  )
}
