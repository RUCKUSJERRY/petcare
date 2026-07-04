// 반려동물 기록(접종·진료·관리 등)을 인쇄/PDF 저장용 문서로 내보내기.
// 외부 라이브러리 없이 새 창에 인쇄용 HTML을 그려 브라우저의 '인쇄 → PDF 저장'을 이용한다.
// (병원·호텔·미용·이사 제출용. 문서는 한국어 고정 — 출력 산출물이라 로케일 불필요)

import { todayKST } from './utils'

export type ExportRecord = {
  pet_name: string
  category: string
  title: string
  event_on: string
  place_name: string | null
  cost: number | null
  memo: string | null
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

const won = (n: number) => n.toLocaleString('ko-KR') + '원'

/** 기록 배열 → 인쇄용 HTML 문서 문자열.
 *  opts.watermark=true 면(무료 사용자) 대각선 워터마크 + 하단 안내를 넣는다.
 *  프리미엄은 워터마크 없는 깔끔한 문서로 발행(병원·호텔·미용 제출용 유료 가치). */
export function buildRecordsHtml(
  heading: string,
  rows: ExportRecord[],
  opts: { watermark?: boolean } = {},
): string {
  const today = todayKST()
  const totalCost = rows.reduce((sum, r) => sum + (r.cost ?? 0), 0)
  const watermark = opts.watermark === true

  const body = rows.length === 0
    ? `<p class="empty">내보낼 기록이 없습니다.</p>`
    : `<table>
        <thead>
          <tr><th>날짜</th><th>반려동물</th><th>구분</th><th>내용</th><th>장소</th><th class="num">비용</th><th>메모</th></tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td class="nowrap">${esc(r.event_on)}</td>
              <td class="nowrap">${esc(r.pet_name)}</td>
              <td class="nowrap">${esc(r.category)}</td>
              <td>${esc(r.title)}</td>
              <td>${r.place_name ? esc(r.place_name) : '-'}</td>
              <td class="num">${r.cost ? esc(won(r.cost)) : '-'}</td>
              <td>${r.memo ? esc(r.memo) : '-'}</td>
            </tr>`).join('')}
        </tbody>
        ${totalCost > 0 ? `<tfoot><tr><td colspan="5" class="num">합계</td><td class="num">${esc(won(totalCost))}</td><td></td></tr></tfoot>` : ''}
      </table>`

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(heading)} - 펫케어 기록</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; color: #1f2937; margin: 0; padding: 24px; }
  .head { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 2px solid #2d8a42; padding-bottom: 8px; margin-bottom: 4px; }
  h1 { font-size: 20px; margin: 0; color: #1f6e32; }
  .meta { font-size: 12px; color: #6b7280; }
  .count { font-size: 13px; color: #6b7280; margin: 6px 0 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; font-weight: 600; white-space: nowrap; }
  .num { text-align: right; white-space: nowrap; }
  .nowrap { white-space: nowrap; }
  tfoot td { font-weight: 700; background: #fafafa; }
  .empty { color: #9ca3af; text-align: center; padding: 40px 0; }
  .actions { margin-bottom: 16px; }
  .btn { background: #2d8a42; color: #fff; border: 0; border-radius: 8px; padding: 8px 16px; font-size: 14px; cursor: pointer; }
  .wm { position: fixed; inset: 0; z-index: -1; pointer-events: none;
        background-image: repeating-linear-gradient(-45deg, transparent 0 120px, rgba(45,138,66,0.06) 120px 121px);
        display: flex; align-items: center; justify-content: center; }
  .wm span { font-size: 40px; font-weight: 800; color: rgba(45,138,66,0.10); transform: rotate(-24deg); white-space: nowrap; }
  .foot { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; }
  @media print { .actions { display: none; } body { padding: 0; } .wm { position: fixed; } }
</style>
</head>
<body>
  ${watermark ? `<div class="wm"><span>펫케어 무료 · PETCARE</span></div>` : ''}
  <div class="actions"><button class="btn" onclick="window.print()">인쇄 / PDF 저장</button></div>
  <div class="head">
    <h1>🐾 ${esc(heading)}</h1>
    <span class="meta">발행일 ${esc(today)} · 펫케어</span>
  </div>
  <p class="count">총 ${rows.length}건</p>
  ${body}
  ${watermark ? `<p class="foot">본 문서는 펫케어 무료 버전으로 발행되어 배경 워터마크가 포함됩니다. 프리미엄에서는 워터마크 없이 제출용으로 발행할 수 있어요.</p>` : ''}
  <script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 300); });</script>
</body>
</html>`
}

/** HTML 문서를 새 창에 열어 인쇄 대화상자를 띄운다. 팝업 차단 시 false. */
export function openPrintWindow(html: string): boolean {
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.open()
  w.document.write(html)
  w.document.close()
  return true
}
