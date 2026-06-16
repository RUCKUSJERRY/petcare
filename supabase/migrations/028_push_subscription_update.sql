-- ============================================================
--  028: 푸시 구독 UPDATE 정책 추가
--  014에는 select/insert/delete 정책만 있어, 같은 endpoint로 재구독할 때
--  upsert(onConflict=endpoint)의 DO UPDATE 경로가 RLS에 막혀 실패(500)했다.
--  본인 행만 갱신할 수 있는 UPDATE 정책을 추가해 재구독·키 갱신을 정상화한다.
--  USING/WITH CHECK 모두 auth.uid()=user_id 라 다른 사용자의 구독을
--  자기 것으로 바꾸는 탈취는 여전히 차단된다. (idempotent)
-- ============================================================

drop policy if exists "push_sub_update_own" on public.push_subscriptions;
create policy "push_sub_update_own" on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
