-- 005: 듣기(Part 2·3·4). 음성은 Storage 비공개 버킷 audio 에 두고, questions 에는 경로만 넣는다.
--  Part 2: 문항 1개 = 행 1개 (choices 3개, 보기 순서는 음성과 같아야 하므로 섞지 않는다)
--  Part 3·4: 세트 1개 = 행 1개 (passage = 대본, items = 문제 3개, img = 시각 자료가 있으면 그 경로)
alter table public.questions add column if not exists audio text;
alter table public.questions add column if not exists img text;

insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do nothing;

-- 읽기는 내 계정만 (개인 앱. 새 프로젝트에 깔 때는 아래 uuid 를 자기 auth.users id 로 바꿀 것)
drop policy if exists audio_read on storage.objects;
create policy audio_read on storage.objects for select to authenticated
  using (bucket_id = 'audio' and auth.uid() = '10bb06e7-150e-4768-b473-13a335988233'::uuid);

-- 올리기도 내 계정만 (앱 설정의 "자료 가져오기"가 내 로그인으로 올린다. x-upsert 덮어쓰기에 update 필요)
drop policy if exists audio_insert on storage.objects;
create policy audio_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'audio' and auth.uid() = '10bb06e7-150e-4768-b473-13a335988233'::uuid);
drop policy if exists audio_update on storage.objects;
create policy audio_update on storage.objects for update to authenticated
  using (bucket_id = 'audio' and auth.uid() = '10bb06e7-150e-4768-b473-13a335988233'::uuid)
  with check (bucket_id = 'audio' and auth.uid() = '10bb06e7-150e-4768-b473-13a335988233'::uuid);
