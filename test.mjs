// node test.mjs — 画面を使わない部分のテスト（お題の配り方・投票の決まり・保存データ・お題の中身）
import assert from 'node:assert/strict';
import * as L from './logic.js';
import { GENRES } from './words.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`ok ${name}`); };

// 決まった種から同じ列を返す乱数
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const names = (k) => Array.from({ length: k }, (_, i) => `P${i + 1}`);
const round = (k = 5, reversal = true, seed = 1) => {
  const r = rng(seed);
  return L.newRound(names(k), L.pickPair(L.GENRE_IDS, [], r), reversal, r);
};

test('お題は 8 ジャンル × 25 組、重なりなし、2 つは違う言葉', () => {
  assert.equal(GENRES.length, 8);
  for (const g of GENRES) assert.equal(g.pairs.length, 25, g.id);
  const keys = GENRES.flatMap((g) => g.pairs.map(([a, b]) => L.pairKey(a, b)));
  assert.equal(new Set(keys).size, 200);
  for (const g of GENRES) for (const [a, b] of g.pairs) {
    assert.ok(a && b && a !== b, `${a}/${b}`);
    assert.doesNotMatch(a + b, /狼|ウルフ|人狼/);
  }
});

test('ワンオフはいつも 1 人、みんなのお題とワンオフのお題は違う', () => {
  for (let k = L.MIN_P; k <= L.MAX_P; k++) for (let seed = 1; seed <= 300; seed++) {
    const R = round(k, true, seed * 97 + k);
    const words = R.names.map((_, i) => L.wordOf(R, i));
    assert.ok(R.oneOff >= 0 && R.oneOff < k);
    assert.notEqual(R.common, R.odd);
    assert.equal(words.filter((w) => w === R.odd).length, 1);
    assert.equal(words.filter((w) => w === R.common).length, k - 1);
    assert.deepEqual([R.common, R.odd].sort(), R.key.split('|').sort());
  }
});

test('どちらがみんなのお題になるか・ワンオフの席は偏らない', () => {
  let swapped = 0; const seats = Array(5).fill(0);
  for (let seed = 1; seed <= 2000; seed++) {
    const R = round(5, true, seed);
    if (R.key !== L.pairKey(R.common, R.odd)) swapped++;
    seats[R.oneOff]++;
  }
  assert.ok(swapped > 800 && swapped < 1200, `swapped ${swapped}`);
  for (const s of seats) assert.ok(s > 300, `seats ${seats}`);
});

test('直近に出た組は選ばない。出尽くしたら古いものから解く', () => {
  const r = rng(7);
  let recent = [];
  const food = GENRES.find((g) => g.id === 'food');
  for (let i = 0; i < 25; i++) {
    const p = L.pickPair(['food'], recent, r);
    assert.ok(!recent.includes(p.key), `${i}: ${p.key}`);
    assert.equal(p.genre, 'food');
    recent = L.pushRecent(recent, p.key);
  }
  assert.equal(new Set(recent).size, food.pairs.length);
  // 全部出た → いちばん古い組だけが解かれる
  assert.equal(L.pickPair(['food'], recent, r).key, recent[0]);
  // recent は最大 60 件、新しいものが後ろ
  let big = [];
  for (let i = 0; i < 100; i++) big = L.pushRecent(big, L.pickPair(L.GENRE_IDS, big, r).key);
  assert.equal(big.length, L.RECENT_MAX);
  assert.equal(new Set(big).size, L.RECENT_MAX);
});

test('指された人がみんなの側 → ワンオフの逃げ切り', () => {
  const R = round();
  const other = (R.oneOff + 1) % R.n;
  assert.ok(L.accuse(R, other));
  assert.equal(R.outcome, 'escape');
  assert.deepEqual(L.winners(R), [R.oneOff]);
  assert.equal(L.accuse(R, R.oneOff), false, '決まったあとは変えられない');
});

test('ワンオフが見つかる → 逆転チャンス（当たり → 逆転、はずれ → みんなの勝ち）', () => {
  const A = round();
  L.accuse(A, A.oneOff);
  assert.ok(L.needsChance(A));
  L.answer(A, true);
  assert.equal(A.outcome, 'reversal');
  assert.deepEqual(L.winners(A), [A.oneOff]);

  const B = round();
  L.accuse(B, B.oneOff);
  L.answer(B, false);
  assert.equal(B.outcome, 'minna');
  assert.equal(L.winners(B).length, B.n - 1);
  assert.ok(!L.winners(B).includes(B.oneOff));
});

test('逆転チャンスがオフなら、見つけた時点でみんなの勝ち', () => {
  const R = round(4, false);
  L.accuse(R, R.oneOff);
  assert.equal(R.outcome, 'minna');
  assert.ok(!L.needsChance(R));
  assert.equal(L.answer(R, true), false);
});

test('同数 → 決選 → また同数でワンオフの逃げ切り', () => {
  const R = round(6);
  assert.equal(L.startRunoff(R, [2]), false, '1 人では決選にしない');
  assert.equal(L.tieAgain(R), false, '決選の前に「また同数」はない');
  assert.ok(L.startRunoff(R, [4, 1, 4]));
  assert.deepEqual(R.runoff, [1, 4]);
  assert.equal(L.startRunoff(R, [0, 1]), false, '決選は 1 回だけ');
  assert.ok(L.tieAgain(R));
  assert.equal(R.outcome, 'escape');
  assert.deepEqual(L.winners(R), [R.oneOff]);
});

test('決選では並んだ人しか指せない', () => {
  const R = round(6);
  const tied = [R.oneOff, (R.oneOff + 1) % 6];
  L.startRunoff(R, tied);
  assert.equal(L.accuse(R, (R.oneOff + 2) % 6), false);
  assert.ok(L.accuse(R, R.oneOff));
  assert.ok(L.needsChance(R));
  assert.equal(L.tieAgain(R), false, '指したあとに「また同数」はない');
});

test('保存データ: 読めない・範囲外の値ははじめの値に戻す', () => {
  const d = L.cleanSettings(null);
  assert.deepEqual(d.players.length, 4);
  assert.equal(d.minutes, 3);
  assert.deepEqual(d.genres, L.GENRE_IDS);
  assert.equal(L.cleanSettings({ v: 2, minutes: 5 }).minutes, 3, '版が違えば読まない');
  const s = L.cleanSettings({ v: 1, players: ['あいうえおかきくけこ', 3, 'B'], minutes: 9, genres: ['nope'], reversal: false, sound: 'x' });
  assert.deepEqual(s.players, ['あいうえおかきく', 'B', 'プレイヤー3']);
  assert.equal(s.minutes, 3);
  assert.deepEqual(s.genres, L.GENRE_IDS);
  assert.equal(s.reversal, false);
  assert.equal(s.sound, true);
  assert.equal(L.cleanSettings({ v: 1, players: names(12) }).players.length, L.MAX_P);
  assert.deepEqual(L.cleanSettings({ v: 1, genres: ['ride', 'food'] }).genres, ['food', 'ride']);
  assert.deepEqual(L.cleanRecent({ v: 1, pairs: ['うどん|そば', 'x|y'] }), ['うどん|そば']);
  assert.deepEqual(L.cleanRecent('broken'), []);
});

test('共有の文にプレイヤーの名前を入れない', () => {
  const R = round();
  L.accuse(R, (R.oneOff + 1) % R.n);
  const t = L.shareText(R);
  assert.match(t, /逃げ切られた/);
  for (const p of R.names) assert.ok(!t.includes(p));
});

console.log(`\n${n} tests passed`);
