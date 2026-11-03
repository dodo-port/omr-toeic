# OMR 토익

나만 쓰는 TOEIC 학습 앱. 아이폰 홈 화면에 설치해서 쓰는 웹앱(PWA)과 잠금화면 단어 퀴즈 위젯(Scriptable)이 같은 DB를 공유한다.

| 어디서 | 무엇을 |
|---|---|
| 잠금화면 위젯 | 다음 복습 단어 표시 → 탭하면 4지선다 퀴즈 |
| 앱 · 단어 | 플래시카드 / 4지선다, SM-2 간격반복 |
| 앱 · P5 / P6 | 레벨(1~3) 적응형 문제풀이, Claude API로 새 문제 생성 |
| 앱 · 분석 | 유형별 정답률, 14일 학습량, 자주 틀리는 단어 |
| 앱 · 단어장 | 단어 추가·수정·삭제, 일괄 붙여넣기, API 키 설정 |

구성: GitHub Pages(앱 호스팅, 무료) · Supabase(DB, 무료 플랜) · Claude API(문제 생성, 사용량 과금) · Scriptable(위젯, 무료).

---

## 1. Supabase 준비 (약 5분)

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만든다. 리전은 Seoul(ap-northeast-2)을 고르면 빠르다.
2. **SQL Editor**에 `supabase/schema.sql` 내용을 통째로 붙여 넣고 **Run**.
3. **Authentication → Users → Add user → Create new user**: 이메일, 비밀번호 입력, *Auto Confirm User* 체크.
4. **Authentication → Sign In / Providers**에서 **Allow new users to sign up을 끈다.** 나 말고는 계정을 못 만들게 하기 위해서다.
5. **Project Settings → API Keys**(또는 API)에서 두 가지를 복사해 둔다.
   - Project URL: `https://xxxx.supabase.co`
   - `anon` public 키 또는 `publishable` 키

> anon/publishable 키는 공개돼도 되는 키다. 데이터는 RLS로 "로그인한 본인 행"만 읽고 쓸 수 있다. `service_role`/`secret` 키는 절대 앱이나 위젯에 넣지 않는다.

## 2. GitHub Pages에 올리기

```bash
cd omr-toeic
git add -A && git commit -m "OMR 토익 첫 버전"
gh repo create omr-toeic --public --source . --push   # gh CLI가 없으면 GitHub에서 저장소를 만들고 push
```

저장소 **Settings → Pages → Source: Deploy from a branch → main / (root)**. 1~2분 뒤 `https://<깃허브아이디>.github.io/omr-toeic/`에서 열린다.

> 코드에는 키가 하나도 없다. Supabase 주소·키, Claude API 키는 전부 앱을 처음 열 때 폰에서 입력하고 그 기기에만 저장된다. 그래서 public 저장소여도 괜찮다.

## 3. 아이폰에 앱 설치

1. Safari로 위 주소를 연다 → 공유 버튼 → **홈 화면에 추가**.
2. 홈 화면 아이콘으로 연다 → 1단계의 URL, 키, 이메일, 비밀번호를 입력 → **연결하고 로그인**.
3. 홈 탭의 **기본 단어·문제 불러오기**를 누른다. 기본 단어 60개와 Part 5 18문제, Part 6 3지문이 들어간다.

## 4. Claude API 연결

1. [console.anthropic.com](https://console.anthropic.com) → **API Keys → Create Key**.
2. 같은 콘솔의 **Limits**에서 월 지출 한도를 걸어 둔다.
3. 앱 **단어장 탭 → 맨 아래 설정**에 키를 붙여 넣고 모델을 고른 뒤 **API 설정 저장**.
4. P5·P6 탭의 **문제 생성**을 누르면 현재 레벨과 약점 유형에 맞춘 새 문제가 DB에 저장된다.

키는 폰의 앱 저장소(localStorage)에만 남고 GitHub이나 Supabase에는 올라가지 않는다. 그래도 폰을 잃어버리면 콘솔에서 키를 지우고 새로 만든다.

## 5. 잠금화면 위젯 (Scriptable)

1. App Store에서 **Scriptable** 설치.
2. Scriptable에서 **+** → 새 스크립트 → `scriptable/omr-toeic-widget.js` 내용을 붙여 넣는다. 이름은 `OMR 토익`으로 한다.
3. 맨 위 3줄(`SUPABASE_URL`, `SUPABASE_KEY`, `EMAIL`)을 채운다.
4. 스크립트를 **앱 안에서 한 번 실행** → 비밀번호 입력(키체인에 저장) → 퀴즈가 뜨면 성공.
5. 잠금화면 길게 누르기 → **사용자화** → 잠금화면 → 위젯 추가 → **Scriptable** → 직사각형 위젯 추가.
6. 추가한 위젯을 탭해서 설정한다. **Script: OMR 토익**, **When Interacting: Run Script**.

이제 잠금화면에서 위젯을 탭하면 Face ID 해제 후 퀴즈가 바로 뜬다. 결과는 앱과 같은 복습 일정에 반영된다. 위젯 갱신 주기는 iOS가 정해서 보통 15분~1시간 간격이다.

---

## 업데이트하는 법

1. Claude Code에서 이 폴더를 열고 고친다. 구조와 규칙은 `CLAUDE.md`에 있다.
2. 앱 파일을 바꿨으면 `sw.js`의 `VERSION`을 올린다. 안 올리면 폰에 예전 버전이 남는다.
3. `git push` → 1~2분 뒤 폰에서 앱을 껐다 켠다. 두 번 켜야 새 버전이 뜰 때도 있다.
4. 위젯 스크립트를 바꿨으면 Scriptable에 다시 붙여 넣는다.
5. DB 구조를 바꿨으면 `supabase/migrations/`의 새 SQL을 SQL Editor에서 실행한다.

## 로컬에서 확인

```bash
python3 -m http.server 8000   # http://localhost:8000 에서 열기
```
