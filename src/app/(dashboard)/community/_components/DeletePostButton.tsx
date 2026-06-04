'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function DeletePostButton({ postId }: { postId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm('이 글을 삭제할까요?')) return
    setDeleting(true)
    const { error } = await supabase.from('posts').delete().eq('id', postId)
    if (error) {
      setDeleting(false)
      alert('삭제에 실패했어요.')
      return
    }
    router.push('/community')
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="text-sm text-gray-400 hover:text-red-500"
    >
      {deleting ? '삭제 중...' : '삭제'}
    </button>
  )
}
