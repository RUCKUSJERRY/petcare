-- mcp_tokens : 개인 MCP 액세스 토큰 (외부 MCP 클라이언트가 본인 데이터 툴을 쓰기 위한 인증)
-- 토큰 평문은 저장하지 않고 sha256 해시만 보관한다. 발급 시 1회만 평문을 돌려준다.
create table if not exists public.mcp_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  token_hash   text not null unique,     -- sha256(평문) hex
  label        text,                     -- 사용자 식별용 메모(예: "Claude Desktop")
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked      boolean not null default false
);
