// OMR 토익 — 잠금화면 단어 퀴즈 (Scriptable)
// 위젯: 다음에 복습할 단어를 잠금화면에 띄운다.
// 탭(또는 앱에서 실행): 4지선다 퀴즈 → 결과가 웹앱과 같은 Supabase DB(srs, days)에 저장된다.
//
// 설정: 아래 3줄만 채우면 된다. 비밀번호는 처음 실행할 때 물어보고 iOS 키체인에 저장한다.
const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_KEY = "YOUR-ANON-OR-PUBLISHABLE-KEY";
const EMAIL = "you@example.com";

const QUIZ_COUNT = 5;          // 한 번 탭했을 때 풀 문제 수
const REFRESH_MIN = 15;        // 위젯 갱신 요청 간격(분). 실제 주기는 iOS가 정한다.

// ---------------------------------------------------------------------------
const DAY = 86400000;
const KC_REFRESH = "omr_toeic_refresh";
const KC_PW = "omr_toeic_pw";
const fm = FileManager.local();
const CACHE = fm.joinPath(fm.documentsDirectory(), "omr_toeic_cache.json");

function todayId(t = new Date()) {
  return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------- 인증 ----------
async function authReq(grant, body) {
  const r = new Request(`${SUPABASE_URL}/auth/v1/token?grant_type=${grant}`);
  r.method = "POST";
  r.headers = { apikey: SUPABASE_KEY, "Content-Type": "application/json" };
  r.body = JSON.stringify(body);
  const j = await r.loadJSON();
  if (!j.access_token) throw new Error(j.error_description || j.msg || "로그인 실패");
  Keychain.set(KC_REFRESH, j.refresh_token);
  return { token: j.access_token, uid: j.user.id };
}
async function session() {
  if (Keychain.contains(KC_REFRESH)) {
    try { return await authReq("refresh_token", { refresh_token: Keychain.get(KC_REFRESH) }); } catch (e) {}
  }
  if (!Keychain.contains(KC_PW)) {
    if (config.runsInWidget) throw new Error("앱에서 한 번 실행해 로그인해줘");
    const a = new Alert();
    a.title = "OMR 토익 로그인";
    a.message = EMAIL;
    a.addSecureTextField("비밀번호");
    a.addAction("로그인");
    a.addCancelAction("취소");
    if (await a.present() === -1) throw new Error("로그인을 취소했어");
    Keychain.set(KC_PW, a.textFieldValue(0));
  }
  try { return await authReq("password", { email: EMAIL, password: Keychain.get(KC_PW) }); }
  catch (e) { Keychain.remove(KC_PW); throw e; }
}

// ---------- REST ----------
async function rest(sess, path, method = "GET", body) {
  const r = new Request(`${SUPABASE_URL}/rest/v1/${path}`);
  r.method = method;
  r.headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${sess.token}`, "Content-Type": "application/json" };
  if (body !== undefined) {
    r.body = JSON.stringify(body);
    r.headers.Prefer = "resolution=merge-duplicates,return=minimal";
  }
  const txt = await r.loadString();
  const code = r.response.statusCode;
  if (code >= 300) throw new Error(`DB 오류 ${code}: ${txt.slice(0, 120)}`);
  return txt ? JSON.parse(txt) : null;
}
async function loadData(sess) {
  const [words, srs, settings, days] = await Promise.all([
    rest(sess, "words?select=id,w,pos,ko,ex,lv,created&limit=5000"),
    rest(sess, "srs?select=*&limit=5000"),
    rest(sess, "settings?select=*"),
    rest(sess, `days?select=*&date=eq.${todayId()}`),
  ]);
  const data = { words, srs, settings: settings[0] || {}, day: days[0] || null, ts: Date.now() };
  fm.writeString(CACHE, JSON.stringify(data));
  return data;
}
function cached() { return fm.fileExists(CACHE) ? JSON.parse(fm.readString(CACHE)) : null; }

// ---------- SRS (SM-2) — 웹앱 index.html 의 nextOf 와 같은 규칙 ----------
function nextOf(s, q) {
  s = Object.assign({ ef: 2.5, reps: 0, ivl: 0, lapses: 0 }, s || {});
  const now = Date.now();
  if (q < 3) { s.reps = 0; s.ivl = 0; s.lapses = (s.lapses || 0) + 1; s.due = now + 10 * 60000; }
  else {
    s.reps++;
    s.ivl = s.reps === 1 ? 1 : s.reps === 2 ? 3 : Math.round(s.ivl * s.ef);
    if (q === 5) s.ivl = Math.max(2, Math.round(s.ivl * 1.3));
    s.ef = Math.max(1.3, s.ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    s.due = now + s.ivl * DAY;
  }
  s.last = now;
  return s;
}
function queueOf(data) {
  const now = Date.now();
  const wmap = new Map(data.words.map(w => [w.id, w]));
  const smap = new Map(data.srs.map(s => [s.word_id, s]));
  const due = data.srs.filter(s => s.due <= now && wmap.has(s.word_id)).sort((a, b) => a.due - b.due).map(s => s.word_id);
  const left = Math.max(0, (data.settings.daily_new ?? 15) - ((data.day && data.day.words_new) || 0));
  const fresh = data.words.filter(w => !smap.has(w.id))
    .sort((a, b) => (a.lv || 1) - (b.lv || 1) || (a.created || 0) - (b.created || 0)).slice(0, left).map(w => w.id);
  return { due, fresh, wmap, smap };
}

// ---------- 위젯 ----------
function buildWidget(data, err) {
  const w = new ListWidget();
  w.refreshAfterDate = new Date(Date.now() + REFRESH_MIN * 60000);
  const fam = config.widgetFamily || "accessoryRectangular";
  if (!data || !data.words.length) {
    const t = w.addText(err ? "OMR 토익 · 탭해서 로그인" : "OMR 토익 · 단어 없음");
    t.font = Font.systemFont(12);
    return w;
  }
  const { due, fresh, wmap } = queueOf(data);
  const id = due[0] || fresh[0] || data.words[Math.floor(Math.random() * data.words.length)].id;
  const word = wmap.get(id);
  const todo = due.length + fresh.length;

  if (fam === "accessoryInline") {
    w.addText(`${word.w} · 남은 ${todo}`);
  } else if (fam === "accessoryCircular") {
    w.addAccessoryWidgetBackground = true;
    const n = w.addText(String(todo));
    n.font = Font.boldSystemFont(20); n.centerAlignText();
    const l = w.addText("단어"); l.font = Font.systemFont(10); l.centerAlignText();
  } else if (fam === "accessoryRectangular") {
    w.addAccessoryWidgetBackground = true;
    const top = w.addText(due.length ? `복습 ${due.length} · 새 ${fresh.length}` : `새 단어 ${fresh.length}`);
    top.font = Font.mediumSystemFont(10); top.textOpacity = 0.8;
    const t = w.addText(word.w); t.font = Font.boldSystemFont(17); t.minimumScaleFactor = 0.6; t.lineLimit = 1;
    const b = w.addText(`${word.pos || ""} · 탭해서 퀴즈`); b.font = Font.systemFont(11); b.textOpacity = 0.8;
  } else { // 홈 화면 small / medium
    w.backgroundColor = Color.dynamic(new Color("#fbfaf7"), new Color("#1d1e23"));
    const ink = Color.dynamic(new Color("#1d1f24"), new Color("#ecebe8"));
    const omr = Color.dynamic(new Color("#c23b5a"), new Color("#ee7a95"));
    const top = w.addText(`OMR 토익 · 남은 ${todo}`); top.font = Font.mediumMonospacedSystemFont(10); top.textColor = omr;
    w.addSpacer(6);
    const t = w.addText(word.w); t.font = Font.boldSystemFont(22); t.textColor = ink; t.minimumScaleFactor = 0.5; t.lineLimit = 1;
    const p = w.addText(word.pos || ""); p.font = Font.systemFont(12); p.textColor = ink; p.textOpacity = 0.6;
    w.addSpacer();
    const b = w.addText("탭해서 퀴즈"); b.font = Font.systemFont(11); b.textColor = omr;
  }
  return w;
}

// ---------- 퀴즈 ----------
async function runQuiz() {
  const sess = await session();
  const data = await loadData(sess);
  if (!data.words.length) { const a = new Alert(); a.title = "단어가 없어"; a.message = "웹앱에서 기본 단어를 먼저 불러와줘."; a.addAction("확인"); await a.present(); return; }
  const { due, fresh, wmap, smap } = queueOf(data);
  let list = [...due, ...fresh];
  if (!list.length) list = shuffle(data.words.map(w => w.id));   // 오늘 분량 끝 → 자유 복습
  list = list.slice(0, QUIZ_COUNT);
  const counted = new Set(due.concat(fresh));                    // 자유 복습은 일정에 반영 안 함
  const again = new Set();
  const day = Object.assign({ words_reviewed: 0, words_new: 0, words_again: 0, q: {} }, data.day || {});
  delete day.user_id; delete day.date;
  let n = 0, ok = 0;

  for (let i = 0; i < list.length; i++) {
    const id = list[i]; const word = wmap.get(id);
    const others = shuffle(data.words.filter(o => o.id !== id && o.ko !== word.ko))
      .sort((a, b) => (b.pos === word.pos) - (a.pos === word.pos)).slice(0, 3).map(o => o.ko);
    const opts = shuffle([word.ko, ...others]);
    const a = new Alert();
    a.title = word.w;
    a.message = `${word.pos || ""}   ${i + 1} / ${list.length}`;
    opts.forEach(o => a.addAction(o));
    a.addCancelAction("그만하기");
    const k = await a.presentSheet();
    if (k === -1) break;
    const right = opts[k] === word.ko;
    n++; if (right) ok++;

    if (counted.has(id)) {
      const isNew = !smap.has(id);
      const s = nextOf(smap.get(id), right ? 4 : 1);
      delete s.user_id; s.word_id = id; s.user_id = sess.uid;
      smap.set(id, s);
      await rest(sess, "srs?on_conflict=user_id,word_id", "POST", [s]);
      day.words_reviewed++; if (isNew) day.words_new++; if (!right) day.words_again++;
    }
    if (!right && !again.has(id)) { again.add(id); list.push(id); }

    const r = new Alert();
    r.title = right ? "정답" : "오답";
    r.message = `${word.w} = ${word.ko}${word.ex ? "\n\n" + word.ex : ""}`;
    r.addAction(i < list.length - 1 ? "다음" : "끝");
    r.addCancelAction("그만하기");
    if (await r.present() === -1) break;
  }
  if (n) await rest(sess, "days?on_conflict=user_id,date", "POST", [{ ...day, user_id: sess.uid, date: todayId() }]);
  const end = new Alert();
  end.title = `${n}개 중 ${ok}개 정답`;
  end.message = "기록을 저장했어. 웹앱을 열면 바로 반영돼.";
  end.addAction("확인");
  await end.present();
}

// ---------- 진입점 ----------
if (config.runsInWidget || config.runsInAccessoryWidget) {
  let data = null, err = null;
  try { data = await loadData(await session()); } catch (e) { err = e; data = cached(); }
  Script.setWidget(buildWidget(data, err));
} else {
  try { await runQuiz(); }
  catch (e) { const a = new Alert(); a.title = "문제가 생겼어"; a.message = String(e.message || e); a.addAction("확인"); await a.present(); }
}
Script.complete();
