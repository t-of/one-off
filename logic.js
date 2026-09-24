// 画面を使わない部分（お題の配り方・投票の決まり・保存データの読み直し）。test.mjs で確かめる。
import { GENRES } from './words.js';

export const MIN_P = 3, MAX_P = 10, NAME_MAX = 8;
export const MINUTES = [2, 3, 4, 5];
export const RECENT_MAX = 60;
export const GENRE_IDS = GENRES.map((g) => g.id);

export const pairKey = (a, b) => `${a}|${b}`;
const rand = (n, rnd) => Math.floor(rnd() * n);

/* ---------- 保存データ ---------- */
// 読めない・範囲外の値ははじめの値に戻す
export function cleanSettings(s) {
  const d = { v: 1, players: ['プレイヤー1', 'プレイヤー2', 'プレイヤー3', 'プレイヤー4'], minutes: 3,
    genres: [...GENRE_IDS], reversal: true, sound: true, seenHelp: false };
  if (!s || typeof s !== 'object' || s.v !== 1) return d;
  if (Array.isArray(s.players)) {
    const p = s.players.filter((x) => typeof x === 'string').slice(0, MAX_P).map((x) => x.slice(0, NAME_MAX));
    while (p.length < MIN_P) p.push(`プレイヤー${p.length + 1}`);
    d.players = p;
  }
  if (MINUTES.includes(s.minutes)) d.minutes = s.minutes;
  if (Array.isArray(s.genres)) {
    const g = GENRE_IDS.filter((id) => s.genres.includes(id));
    if (g.length) d.genres = g;
  }
  for (const k of ['reversal', 'sound', 'seenHelp']) if (typeof s[k] === 'boolean') d[k] = s[k];
  return d;
}

export function cleanRecent(r) {
  const all = new Set(GENRES.flatMap((g) => g.pairs.map(([a, b]) => pairKey(a, b))));
  if (!r || r.v !== 1 || !Array.isArray(r.pairs)) return [];
  return r.pairs.filter((k) => all.has(k)).slice(-RECENT_MAX);
}

// 新しいものを後ろに足す。多すぎたら古いものから落とす
export const pushRecent = (recent, key) => [...recent.filter((k) => k !== key), key].slice(-RECENT_MAX);

/* ---------- お題を配る ---------- */
// 選んだジャンルから、直近に出た組（recent）を避けて 1 組選ぶ。
// 全部出尽くしていたら、recent の古いものから解いていく。
export function pickPair(genreIds, recent, rnd = Math.random) {
  const pool = GENRES.filter((g) => genreIds.includes(g.id))
    .flatMap((g) => g.pairs.map(([a, b]) => ({ a, b, key: pairKey(a, b), genre: g.id })));
  const blocked = [...recent];
  let fresh = pool.filter((p) => !blocked.includes(p.key));
  while (!fresh.length && blocked.length) {
    blocked.shift();
    fresh = pool.filter((p) => !blocked.includes(p.key));
  }
  return fresh[rand(fresh.length, rnd)];
}

// ワンオフはいつも 1 人。組のどちらをみんなのお題にするかもランダム
export function newRound(names, pair, reversal, rnd = Math.random) {
  const swap = rnd() < 0.5;
  return {
    n: names.length, names: [...names], genre: pair.genre, key: pair.key,
    common: swap ? pair.b : pair.a, odd: swap ? pair.a : pair.b,
    oneOff: rand(names.length, rnd), reversal,
    runoff: null,      // 決選のときは並んだ人の番号
    accused: null,     // 一番多く指された人
    outcome: null,     // 'minna'（みんなの勝ち）/ 'escape'（ワンオフの逃げ切り）/ 'reversal'（ワンオフの逆転）
  };
}

export const wordOf = (R, i) => (i === R.oneOff ? R.odd : R.common);

/* ---------- 投票 ---------- */
// 一番多く指された人を決める。決選のときは並んだ人だけ。
// ワンオフでなければ逃げ切り。ワンオフなら逆転チャンス（outcome は null のまま）か、みんなの勝ち。
export function accuse(R, i) {
  if (R.outcome || !(i >= 0 && i < R.n) || (R.runoff && !R.runoff.includes(i))) return false;
  R.accused = i;
  R.outcome = i !== R.oneOff ? 'escape' : R.reversal ? null : 'minna';
  return true;
}

// 同数で並んだ人（2 人以上）だけで、もう一度
export function startRunoff(R, tied) {
  const t = [...new Set(tied)].filter((i) => i >= 0 && i < R.n).sort((a, b) => a - b);
  if (R.runoff || R.outcome || t.length < 2) return false;
  R.runoff = t;
  return true;
}

// 決選でもまた同数ならワンオフの逃げ切り
export function tieAgain(R) {
  if (!R.runoff || R.outcome || R.accused !== null) return false;
  R.outcome = 'escape';
  return true;
}

// 見つかったワンオフが、みんなのお題を当てたか
export function answer(R, hit) {
  if (R.outcome || R.accused !== R.oneOff) return false;
  R.outcome = hit ? 'reversal' : 'minna';
  return true;
}

export const needsChance = (R) => R.accused === R.oneOff && R.outcome === null;

export function winners(R) {
  if (R.outcome === 'minna') return R.names.map((_, i) => i).filter((i) => i !== R.oneOff);
  if (R.outcome === 'escape' || R.outcome === 'reversal') return [R.oneOff];
  return [];
}

// 共有の文。プレイヤーの名前は入れない
export function shareText(R) {
  const tail = { minna: 'ひとりだけ違う人を見つけた', escape: '違う人に逃げ切られた', reversal: '見つけたのに逆転された' }[R.outcome];
  return `ONE OFF で遊んだ！お題は『${R.common}』と『${R.odd}』。${tail}`;
}
