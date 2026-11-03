-- 001: days 행을 통째로 덮어쓰지 않고 서버에서 더한다.
-- 앱과 위젯이 같은 날 각자 가진 사본으로 덮어써서 기록이 사라지던 문제를 막는다.
-- p_q 는 {"5:품사": {"n":1,"c":0}} 형태의 증가분.

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
