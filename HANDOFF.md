# OMR 토익 — Claude Code 인수인계서

Claude Code가 이 프로젝트를 처음 열었을 때 읽는 안내서. 구조와 규칙은 `CLAUDE.md`, 사용자용 설치 절차는 `README.md`에 있다. 이 문서는 **지금 어디까지 됐고, 다음에 무엇을 할지**를 정리한다.

---

## 1. 프로젝트 한 줄 요약

김도윤(나)이 혼자 쓰는 TOEIC 학습 앱. 아이폰 홈 화면에 설치하는 웹앱(PWA)과 잠금화면 단어 퀴즈(Scriptable 위젯)가 같은 Supabase DB를 공유한다. Part 5·6 문제는 내 Claude API 키로 생성한다.

- 작업 환경: Windows PC, 프로젝트 경로 `C:\Users\ksain\Documents\omr-toeic`
- 사용 기기: iPhone (Safari, Scriptable)
- 배포: GitHub Pages (정적 파일, 빌드 없음)

## 2. 현재 상태

| 항목 | 상태 |
|---|---|
| 웹앱 `index.html` (단어 SRS, P5/P6, 분석, 단어장, 설정) | 로컬에서 확인 (2026-11-03): 로그인, 시드 upsert, 단어 SRS 저장, P5 기록·레벨 조정, 새로고침 후 유지. **Claude 문제 생성 미검증** |
| Supabase 프로젝트 `omr-toeic` (Seoul, 무료, ref `gofqlrntbuyrtdsipigg`) | 스키마 적용 · RLS 5개 테이블 확인 · advisors 경고 0 · 계정 1개 |
| Scriptable 위젯 `scriptable/omr-toeic-widget.js` | 작성 완료 · 문법 검사 통과 · **폰에서 미검증** |
| PWA 파일 (`manifest.webmanifest`, `sw.js`, `icons/`) | 배포본에서 서비스 워커 등록 확인 (`omr-v2`) |
| 시드 데이터 `data/seed.json` (단어 60, P5 18, P6 3) | DB 적재 확인 |
| 작업 폴더 | 실제 경로는 `OneDrive\Desktop\토익어플\omr-toeic\omr-toeic` (아래 1번의 경로와 다름) |
| GitHub 저장소 · Pages 배포 | `dodo-port/omr-toeic` (public) · https://dodo-port.github.io/omr-toeic/ |
| 폰 설치 · 위젯 (README 3~5) | 아직 안 함 |

이전에 claude.ai 아티팩트로 만든 버전이 있지만 데이터는 연결되지 않는다. 이 저장소가 정식 버전이다.

## 3. 첫 세션에서 할 일 (순서대로)

### 3-1. git 초기화
```bash
git init -b main
git add -A
git commit -m "OMR 토익 첫 버전"
```
커밋 전에 키·비밀번호가 파일에 없는지 확인한다 (`git grep -nE "sk-ant|service_role|eyJ"` 결과가 비어야 함).

### 3-2. 로컬에서 띄워 보기
```bash
python -m http.server 8000
```
`http://localhost:8000`에서 첫 화면(Supabase 연결 폼)이 뜨는지 확인한다. Supabase가 아직 없으면 여기까지만 확인하고 넘어간다.

### 3-3. Supabase 설정 (사용자가 대시보드에서 직접)
README 1단계를 사용자와 함께 진행한다. Claude Code는 대시보드를 조작할 수 없으니 단계를 안내하고, 사용자가 붙여 준 오류 메시지를 해석한다.
- `schema.sql`을 SQL Editor에서 실행
- 사용자 계정 생성(Auto Confirm) → 가입 허용 끄기
- Project URL과 anon/publishable 키 확보

설정이 끝나면 로컬 앱에서 로그인 → 홈의 **기본 단어·문제 불러오기** → 단어 1개, P5 1문제 풀기 → 새로고침해도 기록이 남는지 확인한다.

### 3-4. GitHub Pages 배포
```bash
gh repo create omr-toeic --public --source . --push
gh api -X POST repos/{owner}/omr-toeic/pages -f "source[branch]=main" -f "source[path]=/"
```
`gh`가 없으면 `winget install GitHub.cli` 후 `gh auth login`. 배포 주소는 `https://<아이디>.github.io/omr-toeic/`이다. 사용자의 기존 포트폴리오 저장소(`dodo-port.github.io`)와는 별개 저장소로 만든다.

### 3-5. 폰 설치와 위젯
README 3~5단계는 사용자가 폰에서 직접 한다. Claude Code는 막히는 지점을 함께 디버깅한다.

## 4. 검증할 때 특히 볼 곳 (미검증 위험 지점)

1. **PostgREST upsert** — `upsert()`/`upsertMany()`는 `on_conflict=user_id,<키>` + `Prefer: resolution=merge-duplicates`를 쓴다. 일괄 upsert는 모든 행의 키 집합이 같아야 한다 (seed.json은 맞춰 둠). 400 오류가 나면 먼저 여기를 본다.
2. **settings 행** — 기본키가 `user_id` 하나라 `on_conflict=user_id`. 첫 저장 전에는 행이 없어서 기본값(`DEFAULT_SETTINGS`)으로 동작해야 한다.
3. **Claude API 브라우저 직접 호출** — `anthropic-dangerous-direct-browser-access: true` 헤더 필요. 모델 ID(`MODELS` 상수)가 실제로 유효한지 첫 생성 때 확인하고, 400 `model` 오류면 최신 ID로 고친다.
4. **iOS 홈 화면 앱 저장소** — 홈 화면에 추가한 앱은 Safari와 localStorage가 분리된다. 로그인과 API 키 입력은 설치한 앱 안에서 해야 한다.
5. **서비스 워커 캐시** — 앱 파일을 고치고 `sw.js`의 `VERSION`을 안 올리면 폰에 예전 버전이 남는다.
6. **Scriptable** — top-level `await`, `Keychain`, `Alert.presentSheet()`, `config.runsInAccessoryWidget` 사용. 폰에서 오류가 나면 사용자가 보내 준 Alert 메시지로 원인을 찾는다.
7. **SRS 규칙 일치** — 앱의 `nextOf`/`buildQueue`와 위젯의 `nextOf`/`queueOf`는 같은 규칙이어야 한다. 한쪽을 고치면 반드시 다른 쪽도 고친다.

## 5. 작업 원칙

- 비밀값(Supabase 키, Claude API 키, 비밀번호)을 코드나 커밋에 넣지 않는다. 런타임 입력 → 기기 저장 구조를 유지한다. `service_role` 키는 어디에도 쓰지 않는다.
- 문제는 항상 오리지널로 생성한다. 산타토익·ETS 기출·교재 문항을 넣지 않는다.
- 빌드 도구·프레임워크를 들이지 않는다. 한 파일 vanilla JS 구조를 유지한다. 커지면 `app.js`로 분리하는 정도까지만.
- UI 문구는 한국어 반말, 짧고 직접적으로. 색은 `:root` 토큰만 쓰고 다크 모드 두 블록을 같이 고친다.
- DB 구조를 바꾸면 `supabase/migrations/NNN_설명.sql`을 추가하고 `schema.sql`도 갱신한다.
- 바꾼 뒤에는 `<script>` 내용을 뽑아 `node --check`로 문법을 확인한다.

## 6. 다음 기능 후보 (우선순위 순)

1. **오답 노트** — 틀린 P5/P6 문제만 모아 다시 풀기 (`questions.last_ok = false` 활용).
2. **단어장 내보내기** — CSV로 백업 (`단어 | 뜻 | 품사 | 레벨 | 예문` 형식, 가져오기와 같은 포맷).
3. **단어 발음** — Web Speech API(`speechSynthesis`)로 영어 단어·예문 읽기.
4. **Claude로 단어 예문·뜻 자동 채우기** — 단어만 입력하면 품사·뜻·예문·레벨 제안.
5. **학습 알림** — 웹 푸시 대신 iOS 단축어 자동화로 정해진 시간에 앱 열기 안내.
6. **Part 7(독해)** — 지문 + 여러 문항 구조가 Part 6과 비슷해서 `items` 구조를 재사용.
7. **네이티브 위젯(Swift)** — 위젯 안에서 바로 보기를 누르는 방식. Mac과 Xcode가 생기면 검토.

## 7. 파일 지도

```
omr-toeic/
├─ index.html                  앱 전체 (HTML+CSS+JS)
├─ sw.js                       서비스 워커 (VERSION 올리기 잊지 말 것)
├─ manifest.webmanifest        홈 화면 설치 정보
├─ icons/                      앱 아이콘 180 · 192 · 512
├─ data/seed.json              기본 단어·문제
├─ supabase/schema.sql         테이블 + RLS
├─ scriptable/omr-toeic-widget.js  잠금화면 위젯 + 퀴즈
├─ CLAUDE.md                   구조·규칙 (항상 먼저 읽기)
├─ HANDOFF.md                  이 문서
└─ README.md                   사용자용 설치 안내
```
