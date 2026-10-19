-- 022_mcp_tokens : 개인 MCP 액세스 토큰 테이블 추가
-- 외부 MCP 클라이언트가 Bearer 토큰으로 본인 데이터 툴을 쓰게 한다. 평문은 저장 안 하고 sha256 해시만.
-- idempotent.

create table if not exists public.mcp_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  token_hash   text not null unique,
  label        text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked      boolean not null default false
);

alter table public.mcp_tokens drop constraint if exists mcp_tokens_user_id_fkey;
alter table public.mcp_tokens add constraint mcp_tokens_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

create index if not exists idx_mcp_tokens_user on public.mcp_tokens (user_id, created_at desc);

alter table public.mcp_tokens enable row level security;
drop policy if exists "mcp_tokens_select_own" on public.mcp_tokens;
drop policy if exists "mcp_tokens_insert_own" on public.mcp_tokens;
drop policy if exists "mcp_tokens_update_own" on public.mcp_tokens;
drop policy if exists "mcp_tokens_delete_own" on public.mcp_tokens;
create policy "mcp_tokens_select_own" on public.mcp_tokens for select using (auth.uid() = user_id);
create policy "mcp_tokens_insert_own" on public.mcp_tokens for insert with check (auth.uid() = user_id);
create policy "mcp_tokens_update_own" on public.mcp_tokens for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "mcp_tokens_delete_own" on public.mcp_tokens for delete using (auth.uid() = user_id);
