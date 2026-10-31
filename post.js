// 俳句の裾野 つぶやきBot（Node 18以上。追加パッケージ不要）
// 環境変数: X_API_KEY X_API_SECRET X_ACCESS_TOKEN X_ACCESS_SECRET
//   INCLUDE_LINK=1 でURLを本文に入れる（いまは入れる設定。URLつきは料金が少し高い）
//   DRY_RUN=1 または鍵なし → 投稿せず、文面だけ表示
//   FORCE_DATE=2026-10-09 / FORCE_KIND=menu|feature  → テスト用（毎朝の1つぶやき）
//   KIND=auto（既定）|daily|announce|start|thanks … どのつぶやきをするか。auto は、いまの時刻で決める
//   TEI_POSTS=announce,thanks（既定）… すその句会（定例）のつぶやきの種類。start を足すと「はじまりました」も出す
//   FORCE_NOW=2026-10-10T21:00:00+09:00 … テスト用に、いまの時刻を指定
const crypto = require('crypto');
const menu = require('./menu.json');
const URL_ = 'https://haikunosusono.web.app';
const TAGS = '#俳句の裾野 #チームすその #俳句 #haiku #俳筋力 #俳句初心者';
const TEI_TAGS = '#俳句の裾野 #チームすその #俳句 #句会 #当季雑詠';
const PROJECT = process.env.FB_PROJECT || 'haikunosusono';
// 時間割：毎日21時「すその句会」＋23時「おかわり句会」＋25時「よなよな句会」。土・日・祝日は10時「おはよう句会」・13時「こんにちは句会」・15時「おやつの句会」に加えて、夜の3回もある。
// 変えるときは、ここと tweet.yml の時刻を。祝日の表は、年がかわったら足す（アプリ本体 index.html の JP_HOL と同じ）
const JP_HOL = new Set(['2026-01-01', '2026-01-12', '2026-02-11', '2026-02-23', '2026-03-20', '2026-04-29', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06', '2026-07-20', '2026-08-11', '2026-09-21', '2026-09-22', '2026-09-23', '2026-10-12', '2026-11-03', '2026-11-23',
  '2027-01-01', '2027-01-11', '2027-02-11', '2027-02-23', '2027-03-21', '2027-03-22', '2027-04-29', '2027-05-03', '2027-05-04', '2027-05-05', '2027-07-19', '2027-08-11', '2027-09-20', '2027-09-23', '2027-10-11', '2027-11-03', '2027-11-23']);
function dayOff(jd) { const w = new Date(jd * 86400000).getUTCDay(); return w === 0 || w === 6 || JP_HOL.has(new Date(jd * 86400000).toISOString().slice(0, 10)); }
function hoursFor(jd) { return dayOff(jd) ? [10, 13, 15, 21, 23, 25] : [21, 23, 25]; }
function hh(h) { return h >= 24 ? h + '時（夜中' + (h - 24) + '時）' : h + '時'; }
function slotName(h) { return h === 21 ? 'すその句会' : h === 23 ? 'おかわり句会' : h === 25 ? 'よなよな句会' : h === 10 ? 'おはよう句会' : h === 13 ? 'こんにちは句会' : h === 15 ? 'おやつの句会' : '定例句会'; }
function teiLine(d) {
  const jd = Math.floor(Date.parse(d + 'T00:00:00Z') / 86400000);
  return dayOff(jd) ? 'きょうの定例句会（デモ）は、10時・13時・15時と、21時・23時・25時の6回（当季雑詠・見学OK）'
    : 'きょうの定例句会（デモ）は、21時「すその句会」・23時「おかわり句会」・25時「よなよな句会」（当季雑詠・見学OK）';
}

const FEATURES = [
  ['俳筋力トレーニングルーム', '毎日ランダムに兼題が出ます。漢字・カタカナ・テーマの3つがひとまわり。一句つくって、手ごたえ（会心・ふつう・直したい）を残せます。記録は自分だけが見られます。'],
  ['俳句の初心者部屋', '一日一句、日記のように。むずかしい兼題なしで、今日の一句をつくれます。'],
  ['定例句会（デモ）', '毎日、夜9時（21時）の「すその句会」・11時（23時）の「おかわり句会」・夜中1時（25時）の「よなよな句会」。土日祝は、10時「おはよう句会」・13時「こんにちは句会」・15時「おやつの句会」に加えて、夜の3回も。お題は当季雑詠。見学もできます。ひとりのときは、ボットが加わります。'],
  ['句会の練習', '自分と、ボット2〜4名の句会。出す・選ぶ・語らうを、3分ほどで。句はストッ句に残り、参加にも数えられます。'],
  ['縦書き一行の表示', '句は縦一行で、ゆったり読めます。句読点も一字あけも、そのまま。横書きへの切りかえもできます。'],
  ['バッジとトロフィー', '句をつくる、続ける、句会に出る。そのたびにバッジが増えます。はじめの一歩のバッジもあります。'],
  ['広場だより', '兼題や俳句大会の締切、吟行のお誘い、俳句のコツを、運営からお知らせしています。'],
  ['句会の見学', '定例句会は、はじめから終わりまで見学できます。まずは雰囲気だけでも。'],
  ['ルビ（ふりがな）', '句に《 》でルビをつけられます。読ませたい語だけに、そっと。'],
  ['ストッ句', '作った句は、いくつでもためておけます。消すことも直すこともできます。']
];

function nowMs() { return process.env.FORCE_NOW ? Date.parse(process.env.FORCE_NOW) : Date.now(); }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function slotsAround(t) {
  const jd = Math.floor((t + 9 * 3600000) / 86400000), out = [];
  for (let d = jd - 1; d <= jd + 1; d++) for (const h of hoursFor(d)) {
    const iso = new Date(d * 86400000).toISOString().slice(0, 10);
    out.push({ start: d * 86400000 - 9 * 3600000 + h * 3600000, h, date: iso, sid: 't' + iso.replace(/-/g, '') + '-' + pad(h) });
  }
  return out;
}
// いまの時刻から、どのつぶやきか：開始前100分以内=announce／開始から45分=start／開始の60分後〜3時間=thanks。
// 毎時 :25 をすぎていたら、お礼（thanks）をさきに見る（22:30 は、23時の予告ではなく、21時のお礼）。
// どれでもないとき：朝7時台だけ daily（きょうの兼題）、それ以外は投稿しない（none）
function autoKind(t) {
  const L = slotsAround(t), jm = new Date(t + 9 * 3600000).getUTCMinutes(), jh = new Date(t + 9 * 3600000).getUTCHours();
  const ann = () => { for (const s of L) if (t < s.start && s.start - t <= 100 * 60000) return { kind: 'announce', slot: s }; return null; };
  const stt = () => { for (const s of L) if (t >= s.start && t - s.start < 45 * 60000) return { kind: 'start', slot: s }; return null; };
  const thx = () => { for (const s of L.slice().reverse()) if (t - s.start >= 60 * 60000 && t - s.start <= 3 * 3600000) return { kind: 'thanks', slot: s }; return null; };
  const order = jm >= 25 ? [thx, stt, ann] : [ann, stt, thx];
  for (const f of order) { const r = f(); if (r) return r; }
  return jh === 7 ? { kind: 'daily', slot: null } : { kind: 'none', slot: null };
}
function slotFor(kind, t) {
  const L = slotsAround(t);
  if (kind === 'announce') return L.find(s => t < s.start && s.start - t <= 3 * 3600000) || null;
  if (kind === 'start') return L.filter(s => s.start <= t).pop() || null;
  if (kind === 'thanks') return L.filter(s => s.start <= t - 30 * 60000).pop() || null;
  return null;
}
function whenText(ms) { const m = Math.round(ms / 60000); return m >= 50 ? 'あと1時間' : m >= 3 ? 'あと' + Math.round(m / 5) * 5 + '分' : 'まもなく'; }
function fitTags(variants, link, tagStr) {
  const vs = Array.isArray(variants) ? variants : [variants], all = tagStr.split(' ');
  for (const minTags of [3, 2]) for (const v of vs) for (let n = all.length; n >= minTags; n--) {
    const text = v + link + '\n' + all.slice(0, n).join(' ');
    if (weighted(text) <= 280) return text;
  }
  let body = vs[vs.length - 1];
  while (body.length > 20 && weighted(body + link + '\n' + all.slice(0, 2).join(' ')) > 280) body = body.slice(0, -1);
  return body + link + '\n' + all.slice(0, 2).join(' ');
}
function slotLabel(s) { const d = new Date(s.date + 'T00:00:00Z'); return (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日' + s.h + '時'; }
function announceText(slot, t) {
  const head = '【' + whenText(slot.start - t) + '】' + hh(slot.h) + 'から「' + slotName(slot.h) + '」（定例句会・デモ）', theme = 'お題は「当季雑詠」。いまの季節のことばで、自由に一句。',
    info = '投句は、いつでも受付中（定刻でしめきり）。見学もできます。ひとりなら、ボットが加わります。', warn = 'ほかの人の句や選評の、無断の公開は禁止です。';
  return [[head, theme, info, warn], [head, theme, '投句は受付中。見学もできます。', warn], [head, 'お題は「当季雑詠」。投句は受付中。見学もできます。', warn]].map(v => v.join('\n'));
}
function startText(slot) {
  const head = '【はじまりました】' + hh(slot.h) + 'の「' + slotName(slot.h) + '」（定例句会・デモ）', a = 'お題は「当季雑詠」。いま、披講・点付けがはじまっています。見学もできます。', w = 'ほかの人の句や選評の、無断の公開は禁止です。';
  return [[head, a, w], [head, 'お題は「当季雑詠」。見学もできます。', w]].map(v => v.join('\n'));
}
function teiNextLines(slot) {
  const next = slotsAround(slot.start + 1).filter(x => x.start > slot.start).slice(0, 2);
  const nm = x => (x.date === slot.date ? 'きょう' : 'あす') + (x.h < 12 ? 'あさ' : '') + hh(x.h) + '「' + slotName(x.h) + '」';
  const l1 = next.length ? 'さっそく、つぎの定例句会がオープンしています。つぎは、' + nm(next[0]) + 'にひらきます。お題は「当季雑詠」。' : '';
  const l2 = 'いまからでも、投句を受け付けています。ふらりと一句、お待ちしています。お時間になりましたら、ご着席を。';
  const l3 = next[1] ? nm(next[1]) + 'の回にも、ぜひご参加を。' : '';
  return { l1, l2, l3 };
}
function noshowText(slot) {
  const n = teiNextLines(slot), head = (slot.h < 12 ? 'けさ' : slot.h < 17 ? 'きょう昼' : '今夜') + hh(slot.h) + 'の「' + slotName(slot.h) + '」は、おやすみでした。';
  return [[head, n.l1, n.l2, n.l3], [head, n.l1, n.l2], [head, n.l1, 'いまからでも、投句を受け付けています。']].map(v => v.filter(Boolean).join('\n'));
}
function thanksText(slot, humans, bots) {
  const who = bots ? humans + '人（ほかにボット' + bots + '名）' : humans + '人';
  const n = teiNextLines(slot);
  const head = '【ありがとうございました】' + slotLabel(slot) + '「' + slotName(slot.h) + '」は、終了しました。参加は、' + who + 'でした。';
  return [[head, n.l1, n.l2, n.l3], [head, n.l1, n.l2], [head, n.l1, 'いまからでも、投句を受け付けています。'], [head, n.l1]].map(v => v.filter(Boolean).join('\n'));
}
async function fetchPub(sid) {
  const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/pub/' + sid;
  const r = await fetch(url);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Firestore ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json(), f = j.fields || {}, num = (x) => x ? Number(x.integerValue || x.doubleValue || 0) : 0;
  return { humans: num(f.humans), bots: num(f.bots) };
}
function jstDate() {
  if (process.env.FORCE_DATE) return process.env.FORCE_DATE;
  return new Date(nowMs() + 9 * 3600000).toISOString().slice(0, 10);
}
function weighted(s) { let n = 0; for (const ch of s) n += /[\u0000-ჿ]/.test(ch) ? 1 : 2; return n; }

function menuText(m) {
  const lines = ['今日の機能紹介', '俳筋力トレーニングルーム', 'ランダムに兼題がでます', '漢字シリーズ、カタカナシリーズ、テーマ詠です'];
  if (m.s === 'k') lines.push('今日は「' + m.t + '」を句によみこんで（この文字をいれて）句をつくってみようというお題です');
  if (m.s === 't') lines.push('今日は「' + m.t + '」を句によみこんで（この音をいれて）句をつくってみようというお題です');
  if (m.s === 'm') lines.push('今日のテーマは「' + m.t + '」' + (m.h ? '（' + m.h + '）' : '') + '。ここから想像をふくらませて、句をつくってみようというお題です');
  lines.push('', teiLine(jstDate()));
  return lines.join('\n');
}
function featureText(n) {
  const f = FEATURES[n % FEATURES.length];
  return '今日の機能紹介\n' + f[0] + '\n' + f[1];
}
async function buildAny() {
  const t = nowMs(), want = (process.env.KIND || 'auto').trim() || 'auto';
  if (want === 'custom') { const tx = String(process.env.TEXT || '').replace(/\\n/g, '\n').trim(); return { d: jstDate(), kind: 'custom', text: tx, skip: tx ? '' : 'TEXT が空なので、投稿しません' }; }
  let kind = want, slot = null;
  if (want === 'auto') { const a = autoKind(t); kind = a.kind; slot = a.slot; }
  else if (want !== 'daily') slot = slotFor(want, t);
  if (kind === 'none') return { d: jstDate(), kind, text: '', skip: 'この時刻に合う定例句会がないので、投稿しません' };
  if (kind === 'daily') return Object.assign({ skip: '' }, build());
  const on = (process.env.TEI_POSTS || 'announce,thanks').split(',').map(x => x.trim());
  if (!on.includes(kind)) return { d: jstDate(), kind, text: '', skip: kind + ' は TEI_POSTS に入っていないので、投稿しません' };
  if (!slot) return { d: jstDate(), kind, text: '', skip: '対象の定例句会が見つかりません' };
  const link = process.env.INCLUDE_LINK === '1' ? '\n' + URL_ + '/#' + slot.sid : '';
  let body;
  if (kind === 'announce') body = announceText(slot, t);
  else if (kind === 'start') body = startText(slot);
  else {
    const pub = await fetchPub(slot.sid);
    body = (!pub || !pub.humans) ? noshowText(slot) : thanksText(slot, pub.humans, pub.bots);
  }
  return { d: slot.date, kind, text: fitTags(body, link, TEI_TAGS), skip: '' };
}
function build() {
  const d = jstDate(), m = menu[d];
  const dow = new Date(d + 'T00:00:00Z').getUTCDay();
  const dayN = Math.floor(Date.parse(d + 'T00:00:00Z') / 86400000);
  let kind = process.env.FORCE_KIND || (dow === 0 || !m ? 'feature' : 'menu'); // 日曜は機能紹介
  let body = kind === 'menu' ? menuText(m) : featureText(Math.floor(dayN / 7));
  const link = process.env.INCLUDE_LINK === '1' ? '\n' + URL_ : '';
  const base = kind === 'menu' ? body.replace(/\n\n.*$/s, '') : body;
  const text = fitTags(kind === 'menu' ? [body, base] : [body], link, TAGS);
  return { d, kind, text };
}

function enc(s) { return encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase()); }
function authHeader(method, url, key, secret, token, tokenSecret, extra, fixed) {
  const p = { oauth_consumer_key: key, oauth_nonce: (fixed && fixed.nonce) || crypto.randomBytes(12).toString('hex'), oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: (fixed && fixed.ts) || String(Math.floor(Date.now() / 1000)), oauth_token: token, oauth_version: '1.0' };
  const all = Object.assign({}, p, extra || {});
  const base = [method, enc(url), enc(Object.keys(all).sort().map(k => enc(k) + '=' + enc(all[k])).join('&'))].join('&');
  p.oauth_signature = crypto.createHmac('sha1', enc(secret) + '&' + enc(tokenSecret)).update(base).digest('base64');
  return 'OAuth ' + Object.keys(p).sort().map(k => enc(k) + '="' + enc(p[k]) + '"').join(', ');
}
async function main() {
  const { d, kind, text, skip } = await buildAny();
  if (skip) { console.log('（' + kind + '：' + skip + '）'); return; }
  console.log('--- ' + d + ' (' + kind + ') / 重み付き文字数 ' + weighted(text) + ' ---\n' + text + '\n---');
  const e = process.env, keys = [e.X_API_KEY, e.X_API_SECRET, e.X_ACCESS_TOKEN, e.X_ACCESS_SECRET];
  if (e.DRY_RUN === '1' || keys.some(k => !k)) { console.log('（投稿はしていません：DRY_RUN または鍵が未設定）'); return; }
  const url = 'https://api.x.com/2/tweets';
  const r = await fetch(url, { method: 'POST', headers: { Authorization: authHeader('POST', url, ...keys), 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  const j = await r.text();
  console.log(r.status, j);
  if (!r.ok) {
    const dup = /duplicate/i.test(j);
    console.log((dup ? '::notice title=X::同じ文の投稿なので、Xに断られました（失敗あつかいにしません）' : '::error title=X::' + r.status + ' ') + (dup ? '' : j.replace(/\r?\n/g, ' ').slice(0, 400)));
    if (!dup) process.exit(1);
  }
}
if (require.main === module) main().catch(err => { console.error(err); process.exit(1); });
module.exports = { build, buildAny, autoKind, slotsAround, weighted, authHeader, announceText, thanksText };
