import { createClient } from '@/lib/supabase/client'

/**
 * Supabase Storage에 이미지 업로드 후 public URL 반환.
 * 경로 규칙: {bucket}/{userId}/{timestamp}.{ext}  (RLS: 본인 폴더만 쓰기)
 */
export async function uploadImage(
  bucket: 'post-images' | 'avatars',
  file: File,
  userId: string
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`

  const supabase = createClient()
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  })
  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

/** 업로드 전 클라이언트 측 검증 (타입/용량) */
export function validateImage(file: File, maxMB = 5): string | null {
  if (!file.type.startsWith('image/')) return '이미지 파일만 업로드할 수 있어요'
  if (file.size > maxMB * 1024 * 1024) return `파일 크기는 ${maxMB}MB 이하여야 해요`
  return null
}
