-- 004: 무료 요금제는 7일 동안 요청이 없으면 프로젝트를 멈춘다.
-- GitHub Actions(.github/workflows/keepalive.yml)가 사흘마다 이 함수를 불러 깨워 둔다.
-- 테이블은 읽지 않고 1만 돌려준다. anon 키로 부를 수 있지만 데이터는 아무것도 보이지 않는다.
create or replace function public.keepalive()
returns int language sql stable as $$ select 1 $$;
revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
