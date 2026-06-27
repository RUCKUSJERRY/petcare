-- affiliate_clicks : 제휴 상품 클릭 로그 (수익화 - 어필리에이트 전환 측정용)
-- 어떤 상품을 어느 화면(context)에서 눌렀는지 적재해 제휴 매출/클릭률 분석에 사용한다.
create table if not exists public.affiliate_clicks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,
  product_id  text not null,
  context     text,
  created_at  timestamptz not null default now()
);
