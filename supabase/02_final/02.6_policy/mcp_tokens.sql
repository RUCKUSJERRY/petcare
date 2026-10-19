-- mcp_tokens : RLS (본인 토큰만 관리). 토큰 검증(해시 조회)은 service role 로 RLS 우회해 수행한다.
alter table public.mcp_tokens enable row level security;
drop policy if exists "mcp_tokens_select_own" on public.mcp_tokens;
drop policy if exists "mcp_tokens_insert_own" on public.mcp_tokens;
drop policy if exists "mcp_tokens_update_own" on public.mcp_tokens;
drop policy if exists "mcp_tokens_delete_own" on public.mcp_tokens;
create policy "mcp_tokens_select_own" on public.mcp_tokens for select using (auth.uid() = user_id);
create policy "mcp_tokens_insert_own" on public.mcp_tokens for insert with check (auth.uid() = user_id);
create policy "mcp_tokens_update_own" on public.mcp_tokens for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "mcp_tokens_delete_own" on public.mcp_tokens for delete using (auth.uid() = user_id);
