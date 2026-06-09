-- ============================================================
--  012: 댓글 고도화 — 대댓글(1단계) + 수정
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. (idempotent)
-- ============================================================

-- 부모 댓글(대댓글용). 부모 삭제 시 답글도 함께 삭제.
alter table public.comments
  add column if not exists parent_id uuid references public.comments(id) on delete cascade;

-- 수정 시각
alter table public.comments
  add column if not exists updated_at timestamptz not null default now();

-- 기존 댓글은 수정된 적 없으므로 updated_at = created_at 로 정렬
update public.comments set updated_at = created_at where updated_at <> created_at;

create index if not exists idx_comments_parent on public.comments (parent_id, created_at);

-- 본인 댓글 수정 허용
drop policy if exists "update_own_comment" on public.comments;
create policy "update_own_comment" on public.comments for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ───────────────────────────────────────────────
-- 알림 트리거 갱신: 답글이면 부모 댓글 작성자에게 'reply' 알림,
-- 최상위 댓글이면 기존대로 글 작성자에게 'comment' 알림. (본인 제외, 예외 안전)
-- ───────────────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type in ('comment', 'like', 'reply'));

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  notif_type text;
begin
  begin
    if new.parent_id is not null then
      -- 답글 → 부모 댓글 작성자에게
      select user_id into target_id from public.comments where id = new.parent_id;
      notif_type := 'reply';
    else
      -- 최상위 댓글 → 글 작성자에게
      select user_id into target_id from public.posts where id = new.post_id;
      notif_type := 'comment';
    end if;

    if target_id is not null and target_id <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, type, post_id, comment_id)
      values (target_id, new.user_id, notif_type, new.post_id, new.id);
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;
