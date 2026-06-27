// 무료 OCR 폴백 유틸 — 브라우저에서 Tesseract.js로 실행(키·서버비·쿼터 없음).
// LLM(Gemini) 인식이 실패/한도초과일 때 RecordsScanModal에서 호출한다.

const wonRe = /(\d{1,3}(?:,\d{3})+|\d{4,})/g
const dateRe = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/

/** 인식 텍스트에서 날짜(YYYY-MM-DD)·금액(원)을 휴리스틱으로 추출 */
export function parseOcrText(text: string): { date: string; cost: number } {
  let date = ''
  const dm = text.match(dateRe)
  if (dm) date = `${dm[1]}-${dm[2].padStart(2, '0')}-${dm[3].padStart(2, '0')}`
  let cost = 0
  const nums = Array.from(text.matchAll(wonRe), m => parseInt(m[1].replace(/,/g, ''), 10)).filter(n => n >= 100)
  if (nums.length) cost = Math.max(...nums) // 합계가 보통 가장 큰 값
  return { date, cost }
}

/**
 * 브라우저에서 Tesseract.js로 이미지 텍스트 인식 (한국어+영어).
 * 엔진/언어데이터는 첫 호출 시 CDN에서 받아 캐시된다. (무료·쿼터 없음)
 */
export async function recognizeImageText(file: File): Promise<string> {
  const Tesseract = (await import('tesseract.js')).default
  const { data } = await Tesseract.recognize(file, 'kor+eng')
  return (data.text || '').trim()
}
