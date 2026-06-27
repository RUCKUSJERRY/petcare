# 01.2_changes — 변경 SQL

`01.1_initial/00_full_setup.sql`(baseline) 이후에 발생하는 DB 변경을 누적하는 곳입니다.

## 규칙
- 파일명: `NNN_간단설명.sql` (3자리 일련번호, 직전 번호 + 1부터 시작)
- 모든 SQL은 **idempotent**(재실행 안전)하게 작성한다.
- 변경분을 여기 추가하면 **반드시 `02_final/`의 해당 오브젝트 파일도 같이 갱신**한다.
  그 뒤 `npm run db:build` 로 통합본을 재생성한다.

자세한 규칙은 `supabase/README.md` 참고.
