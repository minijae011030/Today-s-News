-- Today's News: 웹 푸시 구독 저장소
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run

create table if not exists public.push_subscriptions (
  endpoint     text primary key,
  subscription jsonb not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- RLS를 켜고 정책을 하나도 안 만들면, 브라우저(공개 키)로는 테이블을 직접 읽거나 쓸 수 없어요.
-- 알림 보내는 GitHub Actions만 secret 키로 읽어요.
alter table public.push_subscriptions enable row level security;

-- 브라우저는 아래 두 함수로만 저장/삭제할 수 있어요 (목록 조회는 불가)
create or replace function public.save_push_subscription(sub jsonb, ua text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if sub->>'endpoint' is null
     or sub->>'endpoint' !~ '^https://'
     or sub->'keys'->>'p256dh' is null
     or sub->'keys'->>'auth' is null then
    raise exception 'invalid push subscription';
  end if;

  insert into push_subscriptions (endpoint, subscription, user_agent)
  values (sub->>'endpoint', sub, left(ua, 300))
  on conflict (endpoint) do update
    set subscription = excluded.subscription,
        user_agent   = excluded.user_agent,
        updated_at   = now();
end;
$$;

create or replace function public.delete_push_subscription(endpoint_url text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from push_subscriptions where endpoint = endpoint_url;
$$;

revoke all on function public.save_push_subscription(jsonb, text) from public;
revoke all on function public.delete_push_subscription(text) from public;
grant execute on function public.save_push_subscription(jsonb, text) to anon, authenticated;
grant execute on function public.delete_push_subscription(text) to anon, authenticated;
