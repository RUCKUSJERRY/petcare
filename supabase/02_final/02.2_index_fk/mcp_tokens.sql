-- mcp_tokens : 외래키 + 인덱스
alter table public.mcp_tokens drop constraint if exists mcp_tokens_user_id_fkey;
alter table public.mcp_tokens add constraint mcp_tokens_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- 토큰 검증(해시 조회)은 token_hash unique 인덱스가 담당. 사용자별 목록 조회용 인덱스 추가.
create index if not exists idx_mcp_tokens_user on public.mcp_tokens (user_id, created_at desc);
