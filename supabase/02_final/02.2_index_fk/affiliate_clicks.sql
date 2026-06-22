-- affiliate_clicks : 외래키 + 인덱스
-- user_id 는 비로그인 클릭(null)도 허용하므로 not null 로 두지 않는다. 삭제 시 로그는 보존.
alter table public.affiliate_clicks drop constraint if exists affiliate_clicks_user_id_fkey;
alter table public.affiliate_clicks add constraint affiliate_clicks_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

create index if not exists idx_affiliate_clicks_product on public.affiliate_clicks (product_id, created_at desc);
create index if not exists idx_affiliate_clicks_created on public.affiliate_clicks (created_at desc);
