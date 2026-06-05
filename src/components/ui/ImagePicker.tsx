'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uploadImage, validateImage } from '@/lib/upload'

/**
 * 이미지 선택 + 업로드 + 미리보기 컴포넌트.
 * 업로드 완료 시 onUploaded(url) 호출.
 */
export function ImagePicker({
  bucket,
  value,
  onUploaded,
  onError,
  shape = 'square',
}: {
  bucket: 'post-images' | 'avatars' | 'pet-photos'
  value: string | null
  onUploaded: (url: string | null) => void
  onError?: (msg: string) => void
  shape?: 'square' | 'circle'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const [uploading, setUploading] = useState(false)

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validationError = validateImage(file)
    if (validationError) {
      onError?.(validationError)
      return
    }

    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요해요')
      const url = await uploadImage(bucket, file, user.id)
      onUploaded(url)
    } catch {
      onError?.('업로드에 실패했어요. 다시 시도해주세요.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const radius = shape === 'circle' ? 'rounded-full' : 'rounded-xl'

  return (
    <div className="flex items-center gap-3">
      <div
        className={`relative w-20 h-20 ${radius} bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="미리보기" className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl text-gray-300">📷</span>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-xs text-gray-500">
            업로드 중
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="btn-secondary text-sm py-1.5 px-3"
        >
          {value ? '사진 변경' : '사진 추가'}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onUploaded(null)}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            제거
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSelect}
      />
    </div>
  )
}
