import { createClient } from '@/lib/supabase/client'

/**
 * 업로드 전 클라이언트에서 이미지를 리사이즈/압축한다.
 * - 긴 변을 maxDim(px) 이하로 축소
 * - JPEG로 재인코딩 (quality)
 * 큰 폰 사진도 보통 수백 KB로 줄어 5MB 제한 문제를 없앤다.
 * 변환에 실패하면 원본 파일을 그대로 반환한다(안전한 폴백).
 */
export async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.8
): Promise<File> {
  // GIF 등 애니메이션은 캔버스 변환 시 첫 프레임만 남으므로 원본 유지
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)

    const blob: Blob | null = await new Promise(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    )
    if (!blob) return file

    // 압축 결과가 더 크면(작은 이미지 등) 원본 사용
    if (blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
  } catch {
    return file
  }
}

/**
 * Supabase Storage에 이미지 업로드 후 public URL 반환.
 * 경로 규칙: {bucket}/{userId}/{timestamp}.{ext}  (RLS: 본인 폴더만 쓰기)
 * 업로드 전 자동으로 압축한다.
 */
export async function uploadImage(
  bucket: 'post-images' | 'avatars' | 'pet-photos',
  file: File,
  userId: string
): Promise<string> {
  const compressed = await compressImage(file)
  const ext = compressed.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`

  const supabase = createClient()
  const { error } = await supabase.storage.from(bucket).upload(path, compressed, {
    cacheControl: '3600',
    upsert: true,
  })
  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

const BUCKETS = ['post-images', 'avatars', 'pet-photos'] as const
type Bucket = typeof BUCKETS[number]

/**
 * public URL에서 {bucket, path}를 파싱한다.
 * URL 형식: .../storage/v1/object/public/{bucket}/{path}
 * 우리 스토리지 URL이 아니면 null.
 */
function parseStorageUrl(url: string): { bucket: Bucket; path: string } | null {
  const marker = '/storage/v1/object/public/'
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  const rest = url.slice(idx + marker.length) // {bucket}/{path}
  const slash = rest.indexOf('/')
  if (slash === -1) return null
  const bucket = rest.slice(0, slash) as Bucket
  const path = decodeURIComponent(rest.slice(slash + 1).split('?')[0])
  if (!BUCKETS.includes(bucket) || !path) return null
  return { bucket, path }
}

/**
 * public URL로 스토리지 파일을 삭제한다. 실패는 무시(베스트 에포트).
 * 더 이상 참조되지 않는 고아 이미지 정리에 사용.
 */
export async function deleteImageByUrl(url: string | null | undefined): Promise<void> {
  if (!url) return
  const parsed = parseStorageUrl(url)
  if (!parsed) return
  try {
    const supabase = createClient()
    await supabase.storage.from(parsed.bucket).remove([parsed.path])
  } catch {
    // 정리 실패는 치명적이지 않으므로 무시
  }
}

/** 업로드 전 클라이언트 측 검증 (타입/용량). 압축 후에도 큰 경우를 위한 안전망. */
export function validateImage(file: File, maxMB = 10): string | null {
  if (!file.type.startsWith('image/')) return '이미지 파일만 업로드할 수 있어요'
  if (file.size > maxMB * 1024 * 1024) return `파일 크기는 ${maxMB}MB 이하여야 해요`
  return null
}
