-- affiliate_clicks : RLS (클릭 적재는 누구나 insert, 조회/수정/삭제는 막음 - 분석은 service_role)
-- 본인 클릭이면 user_id=auth.uid(), 비로그인이면 user_id is null 로만 insert 허용.
alter table public.affiliate_clicks enable row level security;
drop policy if exists "affiliate_clicks_insert" on public.affiliate_clicks;
create policy "affiliate_clicks_insert" on public.affiliate_clicks for insert
  with check (user_id is null or auth.uid() = user_id);
