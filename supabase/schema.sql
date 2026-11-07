-- OMR 토익 · Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여 넣고 Run.
-- 모든 행은 user_id 로 묶이고, RLS 로 "로그인한 본인 행만" 읽고 쓸 수 있다.
-- 여러 번 실행해도 안전하다 (if not exists / drop policy if exists).

create table if not exists public.words (
  user_id  uuid   not null default auth.uid() references auth.users on delete cascade,
  id       text   not null,
  w        text   not null,          -- 영어 단어
  pos      text   default '',        -- 품사 (n, v, a, ad, prep ...)
  ko       text   not null,          -- 뜻
  ex       text   default '',        -- 예문
  lv       smallint default 1,       -- 1 기본 · 2 중급 · 3 고난도
  created  bigint default 0,         -- ms epoch, 새 단어 출제 순서
  primary key (user_id, id)
);

create table if not exists public.srs (
  user_id  uuid   not null default auth.uid() references auth.users on delete cascade,
  word_id  text   not null,
  ef       real   default 2.5,       -- SM-2 easiness factor
  reps     int    default 0,
  ivl      int    default 0,         -- 복습 간격(일). 0 = 10분 뒤 재출제
  lapses   int    default 0,         -- 틀린 횟수
  due      bigint default 0,         -- 다음 복습 시각 (ms epoch)
  last     bigint default 0,
  primary key (user_id, word_id)
);

create table if not exists public.questions (
  user_id  uuid   not null default auth.uid() references auth.users on delete cascade,
  id       text   not null,
  part     smallint not null,        -- 5 또는 6
  level    smallint default 1,
  type     text,                     -- Part 5 유형 (품사, 어휘 ...)
  stem     text,                     -- Part 5 문장, 빈칸은 -------
  choices  jsonb,                    -- Part 5 보기 4개
  answer   smallint,                 -- Part 5 정답 0~3
  exp      text,                     -- Part 5 해설
  ko       text,                     -- Part 5 문장 해석 (정답을 넣은 문장)
  title    text,                     -- Part 6 지문 제목
  passage  text,                     -- Part 6 지문, 빈칸은 [1]~[4]
  items    jsonb,                    -- Part 6 문항 [{type, choices, answer, exp}]
  src      text,                     -- seed | claude | manual
  created  bigint default 0,
  seen     int    default 0,
  wrong    int    default 0,
  last_ok  boolean,
  last_at  bigint,
  primary key (user_id, id)
);

create table if not exists public.days (
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  date           text not null,      -- YYYY-MM-DD (기기 현지 날짜)
  words_reviewed int  default 0,
  words_new      int  default 0,
  words_again    int  default 0,
  q              jsonb default '{}'::jsonb,  -- {"5:품사": {"n":3,"c":2}, ...}
  primary key (user_id, date)
);

create table if not exists public.settings (
  user_id   uuid primary key default auth.uid() references auth.users on delete cascade,
  lv5       real default 1.5,
  lv6       real default 1.5,
  daily_new int  default 15
);

do $$
declare t text;
begin
  foreach t in array array['words','srs','questions','days','settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format('create policy own_rows on public.%I for all to authenticated
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- days 증가분을 서버에서 더하는 함수 (migrations/001_bump_day.sql 과 같음)
create or replace function public.bump_day(
  p_date text, p_reviewed int default 0, p_new int default 0, p_again int default 0, p_q jsonb default '{}'::jsonb)
returns public.days
language plpgsql security invoker set search_path = ''
as $$
declare r public.days; k text; v jsonb; cur jsonb;
begin
  insert into public.days (user_id, date) values (auth.uid(), p_date) on conflict (user_id, date) do nothing;
  select * into r from public.days where user_id = auth.uid() and date = p_date for update;
  cur := coalesce(r.q, '{}'::jsonb);
  for k, v in select * from jsonb_each(coalesce(p_q, '{}'::jsonb)) loop
    cur := jsonb_set(cur, array[k], jsonb_build_object(
      'n', coalesce((cur->k->>'n')::int, 0) + coalesce((v->>'n')::int, 0),
      'c', coalesce((cur->k->>'c')::int, 0) + coalesce((v->>'c')::int, 0)));
  end loop;
  update public.days set
    words_reviewed = coalesce(words_reviewed, 0) + p_reviewed,
    words_new      = coalesce(words_new, 0) + p_new,
    words_again    = coalesce(words_again, 0) + p_again,
    q              = cur
  where user_id = auth.uid() and date = p_date
  returning * into r;
  return r;
end $$;

revoke all on function public.bump_day(text, int, int, int, jsonb) from public, anon;
grant execute on function public.bump_day(text, int, int, int, jsonb) to authenticated;

-- 풀이 1회 기록 (migrations/002_attempts.sql 과 같음)
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
