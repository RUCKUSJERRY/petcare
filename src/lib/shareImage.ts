/**
 * 캔버스로 만든 이미지(Blob)를 공유하거나(Web Share API, 파일) 다운로드로 폴백하는 공용 헬퍼.
 *
 * 성취 공유·월간 회고 공유 등 '즉석 생성한 브랜드 이미지 카드'를 내보내는 경로가 여러 곳이라,
 * navigator.canShare/share 지원 분기와 다운로드 폴백을 한 곳에 모은다(동작 일관성).
 * 브라우저 전용(document/navigator 사용) — 클라이언트에서만 호출한다.
 */
export async function shareOrDownloadImage(blob: Blob, filename: string, caption: string): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean }

  // 파일 공유 지원 시 네이티브 공유 시트, 아니면 다운로드 폴백
  if (nav.canShare?.({ files: [file] }) && typeof nav.share === 'function') {
    try {
      await nav.share({ files: [file], text: caption })
    } catch {
      // 사용자가 공유 시트를 닫음(AbortError) — 조용히 무시
    }
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
