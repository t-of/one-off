/* =========================================================
   ONE OFF（1 台の端末を回して遊ぶ）
   進行: 準備 → お題を見る → 話す → 投票（同数なら決選）→ 正体 → 逆転チャンス → 結果
   決まりの中身は logic.js（test.mjs で確かめる）。画面の骨組みはワケシリ（insider）と揃えてある。
   ========================================================= */
import * as L from './logic.js';
import { GENRES } from './words.js';

const ico = {
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .8c0 1.8-2.5 2.2-2.5 3.8M12 17h.01"/></svg>',
  soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5.5v13a1 1 0 0 0 1.5.9l10.5-6.5a1 1 0 0 0 0-1.8L8.5 4.6A1 1 0 0 0 7 5.5z"/></svg>',
  install: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v11M8 7.5l4-4 4 4M7 11H5.5v9.5h13V11H17"/></svg>',
};
// 同じ吹き出しが 3 つ。1 つだけ少し傾いて、色がずれている
const BUBBLES = `<svg class="bubbles" viewBox="0 0 132 64" aria-hidden="true">
  <g fill="#7ab8ff"><path d="M4 8a6 6 0 0 1 6-6h24a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H18l-7 7v-7a6 6 0 0 1-6-6z"/>
  <path d="M48 8a6 6 0 0 1 6-6h24a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H62l-7 7v-7a6 6 0 0 1-6-6z"/></g>
  <path fill="#ff9ecb" transform="rotate(12 110 22)" d="M92 12a6 6 0 0 1 6-6h24a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6h-16l-7 7v-7a6 6 0 0 1-6-6z"/>
</svg>`;

/* ---------- 保存する設定 ---------- */
// localStorage は t-of.github.io のほかのアプリと共有されるので、キーは 'one-off.' で始める
const LS_SETTINGS = 'one-off.settings', LS_RECENT = 'one-off.recent';
function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できなくても遊べる */ } }
let cfg = L.cleanSettings(readJSON(LS_SETTINGS));
let recent = L.cleanRecent(readJSON(LS_RECENT));
const saveCfg = () => writeJSON(LS_SETTINGS, cfg);

let screen = 'setup';
let R = null;              // いまのラウンド
let roundNo = 0;
let scores = {};           // 名前 → 勝ち数（開いている間だけ）

/* ---------- 小物 ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const nm = (i) => `<span class="name">${esc(R.names[i])}</span>`;
const wordHtml = (w) => `<div class="word" style="--len:${[...w].length}">${esc(w)}</div>`;
const isOff = (i) => i === R.oneOff;

/* ---------- 音・振動・画面を消さない ---------- */
// iPhone のマナーモードでも鳴らす（Safari 16.4 以降）。
// 'playback' にすると音楽アプリの曲が止まるので、アプリの音がオンのときだけにする。
function setAudioSession(soundOn) {
  try { if (navigator.audioSession) navigator.audioSession.type = soundOn ? 'playback' : 'auto'; } catch (e) { /* 対応していない */ }
}
setAudioSession(cfg.sound);
let actx = null;
// to を渡すと、freq から to へ音の高さをすべらせる
function tone(freq, dur = 0.12, type = 'sine', vol = 0.16, to = 0) {
  if (!cfg.sound) return;
  try {
    setAudioSession(true);
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
  } catch (e) { /* 鳴らせなくても遊べる */ }
}
const later = (ms, f) => setTimeout(f, ms);
const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* 対応していない */ } };
const SND = {
  click: () => tone(1500, 0.03, 'sine', 0.07),
  peek: () => { tone(330, 0.14, 'sine', 0.2); buzz(15); },
  pass: () => { tone(620, 0.07); later(80, () => tone(830, 0.1)); },
  begin: () => { tone(523, 0.1); later(110, () => tone(659, 0.1)); later(220, () => tone(784, 0.22)); },
  tick: (s) => tone(s <= 3 ? 1040 : 780, 0.06, 'sine', 0.12),
  timeUp: () => { [0, 450, 900].forEach((ms) => later(ms, () => { tone(1047, 0.7, 'sine', 0.16); tone(1568, 0.5, 'sine', 0.05); })); buzz([200, 100, 200, 100, 400]); },
  vote: () => tone(420, 0.05, 'triangle', 0.22),
  flip: () => tone(900, 0.18, 'sine', 0.12, 300),
  minna: () => { tone(523, 0.14); later(140, () => tone(659, 0.14)); later(280, () => tone(784, 0.3)); buzz(80); },
  off: () => { tone(440, 0.14, 'triangle'); later(150, () => tone(587, 0.14, 'triangle')); later(300, () => tone(392, 0.32, 'triangle')); buzz(80); },
};

let wake = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); }
    else if (!on && wake) { await wake.release(); wake = null; }
  } catch (e) { /* 対応していない */ }
}
const inGame = () => screen !== 'setup';
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && inGame()) keepAwake(true); });
window.addEventListener('beforeunload', (e) => { if (inGame() && screen !== 'result') { e.preventDefault(); e.returnValue = ''; } });

/* ---------- タイマー ---------- */
const C = 2 * Math.PI * 100;
let T = null;
function runTimer(sec) {
  stopTimer();
  T = { total: sec * 1000, remain: sec * 1000, end: performance.now() + sec * 1000, paused: false, lastSec: sec };
  T.id = setInterval(tick, 100);
}
function stopTimer() { if (T && T.id) { clearInterval(T.id); T.id = null; } }
function tick() {
  if (!T || T.paused) return;
  T.remain = Math.max(0, T.end - performance.now());
  const s = Math.ceil(T.remain / 1000);
  if (s !== T.lastSec) { T.lastSec = s; if (s > 0 && s <= 10) SND.tick(s); }
  drawRing();
  if (T.remain <= 0) { stopTimer(); R.timeUp = true; SND.timeUp(); markTimeUp(); }
}
function togglePause() {
  if (!T || !T.id) return;
  T.paused = !T.paused;
  if (!T.paused) T.end = performance.now() + T.remain;
  $('#pauseBtn').innerHTML = pauseLabel();
  $('#ring').classList.toggle('paused', T.paused);
}
function addMinute() {
  if (!T) return;
  if (!T.id) {   // 時間切れのあと → 1 分だけ、もう一度数える
    runTimer(60); R.timeUp = false; render(); return;
  }
  T.remain += 60000; T.total += 60000;
  if (!T.paused) T.end += 60000;
  drawRing();
}
const pauseLabel = () => (T && T.paused ? `${ico.play}再開` : `${ico.pause}一時停止`);
function drawRing() {
  const arc = $('#arc');
  if (!T || !arc) return;
  const s = Math.ceil(T.remain / 1000);
  arc.style.strokeDashoffset = C * (1 - T.remain / T.total);
  $('#time').textContent = fmt(s);
  $('#ring').classList.toggle('low', s <= 10 && T.remain > 0);
}
function markTimeUp() {
  const cap = $('#cap'), btn = $('#toVote');
  if (cap) cap.textContent = '時間です！';
  btn && btn.classList.add('pulse');
}

/* ---------- 長押し ---------- */
function hold(el, on, off) {
  let active = false;
  const start = (e) => { if (e.button > 0) return; e.preventDefault(); active = true; try { el.setPointerCapture(e.pointerId); } catch (_) { /* なくてよい */ } on(); };
  const end = () => { if (!active) return; active = false; off(); };
  el.addEventListener('pointerdown', start);
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => el.addEventListener(t, end));
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

/* =========================================================
   画面
   ========================================================= */
const V = {};

V.setup = () => {
  const n = cfg.players.length;
  const board = Object.keys(scores).length ? `
    <div class="panel"><h3>ここまでの勝ち数</h3>
      <div class="roster" style="margin:0; padding:0 4px; background:none; border:0;">
      ${Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="r"><span class="nm">${esc(k)}</span><span class="sc">${v}<small>勝</small></span></div>`).join('')}
      </div>
      <button class="btn text" data-act="resetScores">勝ち数を消す</button>
    </div>` : '';
  return `
  <header class="hero">
    ${BUBBLES}
    <div class="logo">ONE <em>O</em>FF</div>
    <div class="logo-sub">ワンオフ</div>
    <p>ひとりだけ、お題が少しちがう。話のかみ合わなさから、その人を見つけ出す。1 台の端末を回して遊ぶ、3〜10 人の会話ゲーム。</p>
    <div class="links">
      <button class="link" data-act="rules">${ico.book}遊び方</button>
      <button class="link" data-wak="install" ${WebAppKit.canInstall() ? '' : 'hidden'}>${ico.install}アプリにする</button>
      <button class="link" data-wak="share">${ico.share}共有</button>
    </div>
  </header>

  <section class="panel">
    <div class="panel-h"><h3>プレイヤー</h3><span class="count">${n}<small>/ ${L.MAX_P}人</small></span></div>
    <ol class="plist">
      ${cfg.players.map((p, i) => `
      <li><span class="pnum">${i + 1}</span>
        <input data-name="${i}" value="${esc(p)}" maxlength="${L.NAME_MAX}" placeholder="プレイヤー${i + 1}" autocomplete="off" enterkeyhint="done" aria-label="プレイヤー${i + 1}の名前">
        <button class="icon-btn" data-act="delPlayer" data-arg="${i}" ${n <= L.MIN_P ? 'disabled' : ''} aria-label="削除">${ico.x}</button></li>`).join('')}
    </ol>
    <button class="add" data-act="addPlayer" ${n >= L.MAX_P ? 'disabled' : ''}>${ico.plus}プレイヤーを追加</button>
    <p class="hint">座っている順に入れると、端末を回しやすい。</p>
  </section>

  <section class="panel">
    <h3>話す時間</h3>
    <div class="seg">${L.MINUTES.map((m) => `<button class="${cfg.minutes === m ? 'on' : ''}" data-act="minutes" data-arg="${m}">${m}<small>分</small></button>`).join('')}</div>

    <h3>お題のジャンル</h3>
    <div class="chips">${GENRES.map((g) => `<button class="chip ${cfg.genres.includes(g.id) ? 'on' : ''}" data-act="genre" data-arg="${g.id}">${esc(g.name)}</button>`).join('')}</div>

    <label class="toggle">
      <span>逆転チャンス<small>見つかったワンオフが、みんなのお題を当てたら逆転</small></span>
      <input type="checkbox" id="reversal" ${cfg.reversal ? 'checked' : ''}><i></i>
    </label>
  </section>
  ${board}
  <div class="dock"><button class="btn primary big" data-act="start">ゲームを始める</button></div>
  <p class="credit"><a href="/">T.OF...</a> のアプリ・<a href="https://t-of.github.io/contact/">問い合わせ</a></p>`;
};

V.deal = () => {
  const i = R.deal, last = i === R.n - 1;
  return `
  <div class="center">
    <div class="step">お題を見る ${i + 1} / ${R.n}</div>
    <div class="dots">${R.names.map((_, j) => `<i class="${j < i ? 'done' : j === i ? 'cur' : ''}"></i>`).join('')}</div>
    <h2 class="who">${nm(i)} さんの番</h2>
    <p class="sub" style="margin-bottom:14px;">ほかの人は画面を見ないでください</p>
    <div class="rcard" id="rcard" tabindex="0" role="button" aria-label="長押しでお題を見る">
      <div class="rcard-back"><div class="eye">${ico.eye}</div><b>長押しでお題を見る</b><small>指を離すと隠れます</small></div>
      <div class="rcard-face">
        <div class="wl">あなたのお題</div>
        ${wordHtml(L.wordOf(R, i))}
        <p class="rdesc">お題そのものは言わずに話そう。<br>みんなと同じとは限らない。</p>
      </div>
    </div>
  </div>
  <div class="dock">
    <button class="btn primary big" id="dealNext" data-act="dealNext" ${R.seen ? '' : 'disabled'}>
      ${last ? '全員見た' : `確認した <span class="sm">→ 次は ${esc(R.names[i + 1])} さん</span>`}
    </button>
  </div>`;
};

V.ready = () => `
  <div class="step">準備ができた</div>
  <h2>端末をみんなの真ん中に置いて、<br>話し合いを始めよう</h2>
  <p class="sub">話す時間は <b>${cfg.minutes} 分</b>。</p>
  <ul class="tips">
    <li><span>01</span><div>お題そのものは<b>言わない</b>。「どんなときに使う？」「好き？」と聞いてみよう。</div></li>
    <li><span>02</span><div>ひとりだけ、<b>少し違うお題</b>を持っている。本人も気づいていない。</div></li>
    <li><span>03</span><div>自分だけ話が合わないと思ったら……<b>あなたが違うのかも</b>。</div></li>
  </ul>
  <div class="dock"><button class="btn primary big" data-act="beginTalk">話し合いを始める <span class="sm">${cfg.minutes}:00</span></button></div>`;

V.talk = () => `
  <div class="center">
    <div class="step">話し合い</div>
    <div class="ring" id="ring">
      <svg viewBox="0 0 220 220"><circle class="trk" cx="110" cy="110" r="100" fill="none" stroke-width="10"/>
        <circle class="arc" id="arc" cx="110" cy="110" r="100" fill="none" stroke-width="10" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
      <div class="ring-in"><div class="time" id="time">${fmt(Math.ceil(T.remain / 1000))}</div><div class="cap" id="cap">残り時間</div></div>
    </div>
  </div>
  <p class="talk-hint">お題そのものは言わない。「どんなときに使う？」「好き？」と聞いてみよう。自分だけ話が合わないと思ったら……あなたが違うのかも。</p>
  <div class="tools">
    <button class="tool" id="pauseBtn" data-act="pause">${pauseLabel()}</button>
    <button class="tool" data-act="addMinute">${ico.plus}1 分</button>
  </div>
  <div class="dock"><button class="btn primary big" id="toVote" data-act="toVote">投票へ進む</button></div>`;

V.vote = () => {
  const sel = R.tieSel, cand = R.runoff || R.names.map((_, i) => i);
  const head = sel
    ? `<h2>並んだ人を選ぶ</h2><p class="sub">同じ数だけ指された人を、<b>2 人以上</b>タップ。</p>`
    : `<h2>${R.runoff ? '並んだ人だけで、もう一度' : '違うと思う人は？'}</h2>
       <p class="sub"><span class="callout">せーの！</span>で全員いっしょに、違うと思う人を 1 人指さす（自分は指さない）。</p>
       <h3>一番多く指された人をタップ</h3>`;
  const dock = sel
    ? `<button class="btn primary big" data-act="runoff" ${sel.length >= 2 ? '' : 'disabled'}>この人たちでもう一度</button>
       <button class="btn text" data-act="tieCancel">やめる</button>`
    : R.runoff
      ? `<button class="btn text" data-act="tieAgain">また同数（ワンオフの逃げ切り）</button>`
      : `<button class="btn text" data-act="tieStart">同数で並んだ</button>`;
  return `
  <div class="step">${R.runoff ? '決選' : '投票'}</div>
  ${head}
  <div class="pick">${cand.map((i) => `<button class="${sel && sel.includes(i) ? 'on' : ''}" data-act="${sel ? 'tieToggle' : 'accuse'}" data-arg="${i}"><span class="n">${i + 1}</span>${esc(R.names[i])}</button>`).join('')}</div>
  <div class="dock">${dock}</div>`;
};

V.reveal = () => {
  const a = R.accused, off = isOff(a);
  return `
  <div class="center">
    <div class="step">正体</div>
    <h2>${nm(a)} さんは……</h2>
    <div class="flip ${R.flipped ? 'on' : ''}" id="flip" data-act="flip" role="button" tabindex="0" aria-label="タップしてめくる">
      <div class="flip-in">
        <div class="f-back"><div class="q">?</div><small>タップしてめくる</small></div>
        <div class="f-front face-${off ? 'off' : 'minna'}">
          <div class="r-en">${off ? 'ONE OFF' : 'MINNA'}</div><div class="r-ja">${off ? 'ワンオフ' : 'みんな'}</div>
          <p class="rdesc" style="margin-top:4px;">${off ? '見つかった！' : 'ワンオフではなかった……'}</p>
        </div>
      </div>
    </div>
    <div class="fade-late" style="width:100%">
      <p class="sub" style="font-size:16px;">${off ? (L.needsChance(R) ? '<b class="c-off">でも、まだ逆転チャンスがある</b>' : '<b class="c-minna">みんなの勝ち！</b>') : '<b class="c-off">ワンオフの逃げ切り……</b>'}</p>
    </div>
  </div>
  <div class="dock" id="revealDock" ${R.flipped ? '' : 'style="visibility:hidden"'}>
    <button class="btn primary big" id="revealNext" data-act="afterReveal" ${R.flipped ? '' : 'disabled'}>${L.needsChance(R) ? '逆転チャンスへ' : '結果を見る'}</button>
  </div>`;
};

V.chance = () => `
  <div class="step">逆転チャンス</div>
  <h2>${nm(R.oneOff)} さんは、<br>みんなのお題を口で答えてください</h2>
  <p class="sub">答えられるのは 1 回だけ。答えを聞いてから、みんなで下のボタンを押そう（答えはまだ画面に出ません）。</p>
  <div class="dock">
    <button class="btn ghost big" data-act="answer" data-arg="hit">当たり（逆転）</button>
    <button class="btn primary big" data-act="answer" data-arg="miss">はずれ（みんなの勝ち）</button>
  </div>`;

V.result = () => {
  const o = R.outcome, win = L.winners(R);
  const B = {
    minna: { cls: 'minna', k: 'MINNA WIN', t: 'みんなの勝ち', p: `ワンオフは ${nm(R.oneOff)} さんでした。` },
    escape: { cls: 'off', k: 'ONE OFF WINS', t: 'ワンオフの逃げ切り',
      p: R.accused === null ? `決選でも決まらなかった。ワンオフは ${nm(R.oneOff)} さんでした。` : `${nm(R.accused)} さんはみんなの側。ワンオフは ${nm(R.oneOff)} さんでした。` },
    reversal: { cls: 'off', k: 'ONE OFF WINS', t: 'ワンオフの逆転', p: `見つかった ${nm(R.oneOff)} さんが、みんなのお題を当てた！` },
  }[o];
  return `
  <div class="step">Round ${roundNo} · 結果</div>
  <div class="banner ${B.cls}"><div class="k">${B.k}</div><div class="t">${B.t}</div><p>${B.p}</p></div>
  <div class="answers">
    <div class="answer"><div class="l c-minna">みんなのお題</div><div class="w">${esc(R.common)}</div></div>
    <div class="answer"><div class="l c-off">ワンオフのお題</div><div class="w">${esc(R.odd)}</div></div>
  </div>
  <div class="roster">
    ${R.names.map((p, i) => `<div class="r"><span class="tag ${isOff(i) ? 'off' : 'minna'}">${isOff(i) ? 'ワンオフ' : 'みんな'}</span>
      <span class="nm">${esc(p)}<small>${esc(L.wordOf(R, i))}</small></span>
      ${i === R.accused ? '<span class="tag plain">指された</span>' : ''}
      <span class="plus">${win.includes(i) ? '+1' : ''}</span><span class="sc">${scores[p] || 0}<small>勝</small></span></div>`).join('')}
  </div>
  <div class="dock">
    <button class="btn primary big" data-act="nextRound">次のラウンドへ <span class="sm">同じメンバーで</span></button>
    <div class="row2">
      <button class="btn ghost" data-act="shareResult">${ico.share}共有</button>
      <button class="btn ghost" data-act="toSetup">設定を変える</button>
    </div>
  </div>`;
};

/* ---------- 上の帯 ---------- */
function renderTop() {
  const g = inGame();
  $('#top').innerHTML = `
    ${g ? `<span class="mini">ONE OFF</span><span class="round">Round ${roundNo}</span>` : ''}
    <span class="sp"></span>
    <button class="icon-btn" data-act="sound" aria-label="音のオン・オフ">${cfg.sound ? ico.soundOn : ico.soundOff}</button>
    <button class="icon-btn" data-act="rules" aria-label="遊び方">${ico.help}</button>
    ${g ? `<button class="icon-btn" data-act="quit" aria-label="ゲームをやめる">${ico.x}</button>` : ''}`;
}

/* ---------- 描く ---------- */
function go(s) {
  if (s === 'result') applyScore();
  screen = s; render(); window.scrollTo(0, 0);
}
// 結果の画面に入ったときに 1 回だけ勝ち数を足す
function applyScore() {
  if (R.scored) return;
  R.scored = true;
  L.winners(R).forEach((i) => { const p = R.names[i]; scores[p] = (scores[p] || 0) + 1; });
  (R.outcome === 'minna' ? SND.minna : SND.off)();
}
function render() {
  renderTop();
  $('#app').innerHTML = `<section class="screen s-${screen}">${V[screen]()}</section>`;
  AFTER[screen] && AFTER[screen]();
}
const AFTER = {
  setup() {
    document.querySelectorAll('[data-name]').forEach((inp) => {
      inp.addEventListener('input', () => { cfg.players[+inp.dataset.name] = inp.value; saveCfg(); });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
    });
    $('#reversal').addEventListener('change', (e) => { cfg.reversal = e.target.checked; saveCfg(); });
  },
  deal() {
    const card = $('#rcard');
    hold(card, () => { card.classList.add('show'); SND.peek(); }, () => {
      card.classList.remove('show');
      if (!R.seen) { R.seen = true; $('#dealNext').disabled = false; }
    });
  },
  talk() {
    if (T.paused) $('#ring').classList.add('paused');
    drawRing();
    if (R.timeUp) markTimeUp();
  },
  reveal() { if (R.flipped) $('.screen').classList.add('shown'); },
};

/* =========================================================
   操作
   ========================================================= */
function newRound() {
  const pair = L.pickPair(cfg.genres, recent);
  recent = L.pushRecent(recent, pair.key);
  writeJSON(LS_RECENT, { v: 1, pairs: recent });
  R = Object.assign(L.newRound(cfg.players, pair, cfg.reversal), { deal: 0, seen: false, tieSel: null, flipped: false, timeUp: false, scored: false });
  roundNo++;
  T = null;
  go('deal');
}
function endGame() { stopTimer(); T = null; keepAwake(false); go('setup'); }

const ACT = {
  rules: showRules,
  sound() { cfg.sound = !cfg.sound; saveCfg(); setAudioSession(cfg.sound); renderTop(); SND.click(); },
  quit() { confirmDlg('ゲームをやめますか？', 'このラウンドは記録されずに、準備の画面へ戻ります。', 'やめる', endGame); },

  /* 準備 */
  addPlayer() { if (cfg.players.length < L.MAX_P) { cfg.players.push(''); saveCfg(); render(); document.querySelector(`[data-name="${cfg.players.length - 1}"]`)?.focus(); } },
  delPlayer(i) { if (cfg.players.length > L.MIN_P) { cfg.players.splice(+i, 1); saveCfg(); render(); } },
  minutes(m) { cfg.minutes = +m; saveCfg(); render(); },
  genre(id) {
    const on = cfg.genres.includes(id);
    if (on && cfg.genres.length === 1) return toast('ジャンルは 1 つ以上選んでください');
    cfg.genres = on ? cfg.genres.filter((x) => x !== id) : L.GENRE_IDS.filter((x) => x === id || cfg.genres.includes(x));
    saveCfg(); render();
  },
  resetScores() { scores = {}; render(); },
  start() {
    // 空欄はうめ、同じ名前は番号を付けて分ける
    const seen = {};
    cfg.players = cfg.players.map((p, i) => {
      let s = (p || '').trim() || `プレイヤー${i + 1}`; const base = s; let k = 2;
      while (seen[s]) s = `${base}${k++}`;
      seen[s] = 1; return s;
    });
    saveCfg();
    keepAwake(true);
    newRound();
  },

  /* ラウンド */
  dealNext() {
    if (!R.seen) return;
    if (R.deal === R.n - 1) { SND.begin(); return go('ready'); }
    SND.pass();
    R.deal++; R.seen = false; go('deal');
  },
  beginTalk() { SND.begin(); runTimer(cfg.minutes * 60); go('talk'); },
  pause: togglePause,
  addMinute,
  toVote() {
    if (T && T.id && T.remain > 0) return confirmDlg('投票へ進みますか？', 'まだ時間が残っています。', '投票へ', () => { stopTimer(); go('vote'); });
    stopTimer(); go('vote');
  },
  accuse(i) { if (L.accuse(R, +i)) { SND.vote(); R.flipped = false; go('reveal'); } },
  tieStart() { R.tieSel = []; render(); },
  tieCancel() { R.tieSel = null; render(); },
  tieToggle(i) {
    i = +i;
    R.tieSel = R.tieSel.includes(i) ? R.tieSel.filter((x) => x !== i) : [...R.tieSel, i];
    SND.vote(); render();
  },
  runoff() { if (L.startRunoff(R, R.tieSel)) { R.tieSel = null; SND.pass(); render(); window.scrollTo(0, 0); } },
  tieAgain() {
    confirmDlg('決選でもまた同数？', 'ワンオフの逃げ切りになります。', '逃げ切り', () => { if (L.tieAgain(R)) go('result'); });
  },
  flip() {
    if (R.flipped) return;
    R.flipped = true;
    SND.flip();
    $('#flip').classList.add('on');
    $('#revealDock').style.visibility = 'visible';
    $('.screen').classList.add('shown');
    // めくった勢いで先に進まないように、少しだけ押せなくする
    later(400, () => { const b = $('#revealNext'); if (b) b.disabled = false; });
  },
  afterReveal() { go(L.needsChance(R) ? 'chance' : 'result'); },
  answer(v) { if (L.answer(R, v === 'hit')) go('result'); },
  shareResult() { WebAppKit.share({ text: L.shareText(R) }); },
  nextRound() { stopTimer(); newRound(); },
  toSetup: endGame,
};
// 自分の音を持つ操作は、押したときの「コッ」を鳴らさない
const QUIET = new Set(['sound', 'dealNext', 'beginTalk', 'accuse', 'tieToggle', 'runoff', 'flip']);

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const f = ACT[b.dataset.act];
  if (!f) return;
  if (!QUIET.has(b.dataset.act)) SND.click();
  f(b.dataset.arg, b);
});

/* ---------- シート・知らせ ---------- */
let pendingOk = null;
function modal(html) {
  closeModal();
  const m = document.createElement('div');
  m.className = 'modal'; m.id = 'modal';
  m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  m.addEventListener('click', (e) => {
    if (e.target === m || e.target.closest('[data-close]')) closeModal();
    if (e.target.closest('[data-ok]')) { const f = pendingOk; closeModal(); f && f(); }
  });
  document.body.appendChild(m);
  m.querySelector('button')?.focus();
}
function closeModal() { $('#modal')?.remove(); pendingOk = null; }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
function confirmDlg(title, body, okLabel, onOk) {
  modal(`<h2>${title}</h2><p class="sub">${body}</p>
    <div class="row2" style="margin-top:20px;"><button class="btn ghost" data-close>もどる</button><button class="btn danger" data-ok>${okLabel}</button></div>`);
  pendingOk = onOk;
}
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); later(1800, () => t.remove());
}
function showRules() {
  modal(`
    <div class="step" style="margin-top:0">遊び方</div>
    <h2>ONE OFF の遊び方</h2>
    <p class="sub">3〜10 人。1 ラウンド 5 分くらい。</p>
    <div class="sec"><ol>
      <li>端末を回して、ひとりずつ自分のお題をこっそり見る。</li>
      <li>みんな同じお題……のはずが、<b>ひとりだけ少し違うお題</b>（例: みんなは「うどん」、ひとりだけ「そば」）。違う本人も、自分が違うとは知らない。</li>
      <li>お題そのものは言わずに、お題について話す。話がかみ合わない人を探そう。</li>
      <li>時間が来たら「せーの」で、違うと思う人を指さす。一番多く指された人が <b>ワンオフならみんなの勝ち</b>、違えば <b>ワンオフの勝ち</b>。</li>
      <li>見つかったワンオフは、最後に <b>みんなのお題を当てれば逆転勝ち</b>。</li>
    </ol></div>
    <div class="sec"><h4>こまかい決まり</h4>
      <p>一番多く指された人が同数で並んだら、その人たちだけを対象にもう一度「せーの」。それでも同数なら、ワンオフの逃げ切り。<br>
      逆転チャンスは、準備の画面で切れます。</p>
    </div>
    <button class="btn primary" data-close>閉じる</button>`);
}

WebAppKit.init({ title: 'ONE OFF', text: 'ひとりだけ、お題が少しちがう。1 台の端末を回して遊ぶ、3〜10 人の会話ゲーム' });
// オフライン用（file:// で開いたときは登録しない）
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});

render();
// 初めて開いたときは遊び方を 1 回出す
if (!cfg.seenHelp) { cfg.seenHelp = true; saveCfg(); showRules(); }
