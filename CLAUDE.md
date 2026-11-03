# OMR 토익 — Claude Code 작업 메모

개인용 TOEIC 학습 PWA와 iOS 잠금화면 위젯. 사용자는 한 명(나)이고 아이폰에서 쓴다. 설치·배포 절차는 README.md에 있다.

## 구조
- `index.html` — 앱 전체 (HTML + CSS + vanilla JS 한 파일, 빌드 단계 없음). 해시 라우팅: `#home #words #p5 #p6 #stats #deck`.
- `sw.js` — 서비스 워커. 앱 껍데기만 캐시, 같은 출처 GET만 처리. **앱 파일을 바꾸면 `VERSION`을 올릴 것.**
- `manifest.webmanifest`, `icons/` — 홈 화면 설치용.
- `data/seed.json` — 첫 실행 때 넣는 기본 단어 60개, Part 5 18문제, Part 6 3지문 (전부 오리지널 작성).
- `supabase/schema.sql` — 테이블 + RLS. 스키마 변경은 `supabase/migrations/NNN_설명.sql`로 추가하고 schema.sql도 같이 갱신.
- `scriptable/omr-toeic-widget.js` — Scriptable 위젯(잠금화면 단어 표시) + 탭 시 4지선다 퀴즈.

## 데이터 모델 (Supabase, 모든 테이블 `user_id` + RLS `user_id = auth.uid()`)
- `words(id, w, pos, ko, ex, lv 1~3, created)`
- `srs(word_id, ef, reps, ivl, lapses, due ms, last ms)` — SM-2
- `questions(id, part 5|6, level, type, stem, choices, answer, exp, title, passage, items, src, created, seen, wrong, last_ok, last_at)`
  - Part 5: `stem`에 빈칸 `-------`, `choices` 4개, `answer` 0~3
  - Part 6: `passage`에 `[1]`~`[4]`, `items: [{type, choices, answer, exp}]` 4개 중 1개는 `문장삽입`
- `days(date YYYY-MM-DD, words_reviewed, words_new, words_again, q)` — `q`는 `{"5:품사": {n, c}}` 형태, 약점 분석의 원천
  - **days는 행을 직접 upsert하지 않는다.** 앱(`bumpDay`)과 위젯 모두 증가분만 `rpc/bump_day`로 보낸다. 통째로 쓰면 앱·위젯이 서로 기록을 지운다.
- 앱의 모든 쓰기는 `enqueue` 대기열(localStorage `omr.out`)을 거친다. 오프라인이면 남겨 두고 연결되면 보낸다. 네트워크 오류로 세션(`omr.tok`)이나 위젯 키체인 비밀번호를 지우지 않는다(4xx 거절일 때만).
- `settings(lv5, lv6, daily_new)` — 행 하나
- PostgREST 일괄 upsert는 모든 행의 키가 같아야 한다 (seed.json의 questions는 빈 필드를 null로 채워 둠).

## 지켜야 할 규칙
- **SM-2 규칙(`nextOf`)과 출제 큐(`buildQueue`/`queueOf`)는 index.html과 위젯 스크립트에서 동일해야 한다.** 한쪽을 바꾸면 다른 쪽도.
- 레벨 조정(`adjustLv`): 정답 +0.12(현재 레벨 이상 문제) / +0.05, 오답 −0.15, 범위 1~3.
- 문제 유형 이름은 `TYPES5`/`TYPES6` 목록의 한국어 그대로 쓴다. 통계 키가 된다.
- 비밀값을 코드에 넣지 않는다. Supabase URL·키, Claude API 키는 런타임에 폰에서 입력받아 localStorage(`omr.cfg`, `omr.tok`) / iOS 키체인에 저장한다. `service_role` 키는 어디에도 쓰지 않는다.
- Claude API는 브라우저 직접 호출(`anthropic-dangerous-direct-browser-access: true`). 모델 목록은 `MODELS` 상수.
- 생성 문제는 저작권 문제를 피하려고 항상 "ORIGINAL, do not copy published items"를 프롬프트에 둔다. 기출·교재 문제를 넣지 않는다.
- UI 문구는 한국어 반말, 짧고 직접적으로. 색은 `:root` 토큰만 쓰고 다크 모드 블록 두 곳을 같이 고친다.
- 위젯은 iOS가 갱신 주기를 정한다. 위젯 안에서 직접 버튼을 누르는 상호작용은 Scriptable로는 불가 → 탭하면 스크립트가 앱에서 실행되는 구조를 유지.

## 확인 방법
- `python3 -m http.server 8000` 후 브라우저에서 열고, 첫 화면에서 테스트용 Supabase 프로젝트로 로그인.
- JS 문법 확인: `<script>` 내용을 뽑아 `node --check`.
- 위젯 스크립트는 `node --check`(ESM, top-level await)까지만 로컬에서 가능하고 실제 동작은 폰의 Scriptable에서 확인.

## 이전 버전
claude.ai 아티팩트로 먼저 만든 버전(claude.ai 내장 DB 사용)이 따로 있다. 이 저장소가 정식 버전이고, 데이터는 서로 연결되지 않는다.
