-- admin_users : 초기 관리자 지정 (해당 이메일로 가입돼 있어야 적용; 미가입이면 no-op).
-- 가입 후 이 구문을 다시 실행하면 관리자로 등록된다. 재실행 안전.
insert into public.admin_users (user_id)
select id from auth.users where email = 'yongjun5645@gmail.com'
on conflict (user_id) do nothing;
