-- 002: 풀이 1회마다 고른 보기를 남긴다. 유형별 정답률보다 자세한 약점(어떤 함정에 걸리는지) 분석의 원천.
-- 앱은 이 테이블을 시작할 때 통째로 읽지 않는다 (계속 늘어나므로). 분석할 때 최근 것만 조회한다.

create table if not exists public.attempts (
  user_id  uuid    not null default auth.uid() references auth.users on delete cascade,
  id       text    not null,
  at       bigint  not null,          -- ms epoch
  qid      text    not null,          -- questions.id
  part     smallint not null,         -- 5 또는 6
  item     smallint default 0,        -- Part 6 문항 번호 0~3
  type     text,                      -- 문제 유형 (TYPES5/TYPES6)
  level    smallint,
  picked   smallint,                  -- 고른 보기 0~3
  answer   smallint,                  -- 정답 0~3
  ok       boolean not null,
  review   boolean default false,     -- 오답 다시 풀기 모드에서 푼 것
  primary key (user_id, id)
);
create index if not exists attempts_user_at on public.attempts (user_id, at desc);

alter table public.attempts enable row level security;
drop policy if exists own_rows on public.attempts;
create policy own_rows on public.attempts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.attempts to authenticated;
revoke all on public.attempts from anon;
