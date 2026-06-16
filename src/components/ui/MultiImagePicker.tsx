'use client'

import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { deleteImageByUrl, uploadImage, validateImage } from '@/lib/upload'
import { uploadErrorMessage } from './ImagePicker'

/**
 * 여러 장 이미지 선택 + 업로드 + 미리보기.
 * value(url 배열)와 onChange로 동작. max로 최대 장수 제한(기본 6).
 * capture 미지정: 모바일 OS가 카메라/보관함/파일 선택지를 함께 띄움(표준).
 */
export function MultiImagePicker({
  bucket,
  value,
  onChange,
  onError,
  max = 6,
}: {
  bucket: 'post-images' | 'avatars' | 'pet-photos'
  value: string[]
  onChange: (urls: string[]) => void
  onError?: (msg: string) => void
  max?: number
}) {
  const t = useTranslations('ui')
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const [uploading, setUploading] = useState(false)
  // 이 컴포넌트에서 업로드(미저장)한 URL들. 제거 시 즉시 정리.
  const sessionUrls = useRef<Set<string>>(new Set())

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    const room = Math.max(0, max - value.length)
    if (room === 0) { onError?.(t('imgMaxReached', { max })); return }

    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요해요')
      const urls = [...value]
      for (const file of files.slice(0, room)) {
        const invalid = validateImage(file)
        if (invalid) { onError?.(invalid); continue }
        const url = await uploadImage(bucket, file, user.id)
        sessionUrls.current.add(url)
        urls.push(url)
      }
      onChange(urls)
    } catch (err) {
      onError?.(uploadErrorMessage(err, t))
    } finally {
      setUploading(false)
    }
  }

  const remove = (url: string) => {
    if (sessionUrls.current.has(url)) {
      deleteImageByUrl(url)
      sessionUrls.current.delete(url)
    }
    onChange(value.filter(u => u !== url))
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        {value.map(url => (
          <div key={url} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={t('imgPreviewAlt')} className="w-full h-full object-cover" />
            <button type="button" onClick={() => remove(url)}
              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/50 text-white text-xs flex items-center justify-center"
              aria-label={t('imgRemove')}>✕</button>
          </div>
        ))}
      </div>
      {value.length < max && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => cameraRef.current?.click()} disabled={uploading}
            className="btn-secondary text-sm py-1.5 px-3">
            {uploading ? t('imgUploading') : t('imgCamera')}
          </button>
          <button type="button" onClick={() => galleryRef.current?.click()} disabled={uploading}
            className="btn-secondary text-sm py-1.5 px-3">
            {t('imgGallery')}
          </button>
          <span className="text-xs text-gray-400">{t('imgCount', { n: value.length, max })}</span>
        </div>
      )}
      {/* 촬영(카메라, 1장) / 갤러리(여러 장) 분리 */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleSelect} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={handleSelect} />
    </div>
  )
}
