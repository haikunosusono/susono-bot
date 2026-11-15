// 俳句の裾野 つぶやきBot（Node 18以上。追加パッケージ不要）
// 環境変数: X_API_KEY X_API_SECRET X_ACCESS_TOKEN X_ACCESS_SECRET
//   INCLUDE_LINK=1 でURLを本文に入れる（いまは入れる設定。URLつきは料金が少し高い）
//   DRY_RUN=1 または鍵なし → 投稿せず、文面だけ表示
//   FORCE_DATE=2026-10-09 / FORCE_KIND=menu|feature  → テスト用（毎朝の1つぶやき）
//   KIND=auto（既定）|daily|feature|announce|start|thanks … どのつぶやきをするか。auto は、いまの時刻で決める
//   TEI_POSTS=announce,thanks（既定）… すその句会（定例）のつぶやきの種類。start を足すと「はじまりました」も出す
//   FORCE_NOW=2026-10-10T21:00:00+09:00 … テスト用に、いまの時刻を指定
//   写真：機能紹介（昼12時すぎ feature2・19時 feature）は img/parts/、お礼は img/meiku/（名句で作った句碑の見本）を1枚つける
//   TWEET_IMG=0 で写真なし（文だけ）。MEDIA_TEST=1 で、写真をXに送る試験だけ（投稿はしない）
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const menu = require('./menu.json');
// 写真つきの機能紹介（ひとつずつ）と、お礼につける名句の句碑（季節ごと）。写真は tools/shashin の道具で作って、img/ に置いてある
let PARTS = [], MEIKU = {};
try { PARTS = require('./img/parts.json'); } catch (_) {}
try { MEIKU = require('./img/meiku.json'); } catch (_) {}
function imgOn() { return process.env.TWEET_IMG !== '0'; }
function seasonOf(d) { const m = +String(d).slice(5, 7); return m >= 3 && m <= 5 ? 'haru' : m >= 6 && m <= 8 ? 'natsu' : m >= 9 && m <= 11 ? 'aki' : 'fuyu'; }
function hashStr(t) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// お礼につける1枚：その季節の名句で作った「句碑の見本」（2つならべて、ちがいを見せる）。回ごとに変わる
function meikuFor(slot) { const L = MEIKU[seasonOf(slot.date)] || []; if (!L.length) return null; return L[hashStr(slot.sid) % L.length]; }
const MEIKU_SHORT = '📷 写真は、名句で作った句碑の見本です。';
function meikuLine(m) { return '📷 写真は、句碑の見本です（名句：' + m.by + '）。同じ句でも、' + m.what + 'で、こんなに変わります。'; }
// 機能紹介：1日2回（昼・19時）。31個を、順にひとつずつ
function partFor(dayN, second) { if (!PARTS.length) return null; return PARTS[(dayN * 2 + (second ? 0 : 1)) % PARTS.length]; }
function partText(pt) { return '【俳句の裾野でできること】\n' + pt.t + '\n' + pt.x; }
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
  return dayOff(jd) ? 'きょうの定例句会（デモ）は、10時・13時・15時と、21時・23時・25時の6回。投句は、それぞれ開始の時刻まで（当季雑詠・見学OK）'
    : 'きょうの定例句会（デモ）は、21時「すその句会」・23時「おかわり句会」・25時「よなよな句会」。投句は、それぞれ開始の時刻まで（当季雑詠・見学OK）';
}

const FEATURES = [
  ['定例句会', '毎日 21時・23時・25時、土日祝は 10時・13時・15時も。お題は当季雑詠。投句は開始の時刻まで。乗り遅れても、つぎの回にどうぞ。見学もできます。'],
  ['俳筋力トレーニングルーム', '毎日ランダムに兼題が出ます。漢字・カタカナ・テーマの3つがひとまわり。一句つくって、手ごたえ（会心・ふつう・直したい）を残せます。記録は自分だけが見られます。'],
  ['俳句の初心者部屋', '一日一句、日記のように。むずかしい兼題なしで、今日の一句をつくれます。'],
  ['句会の練習', '自分と、ボット2〜4名の句会。出す・選ぶ・語らうを、3分ほどで。句はストッ句に残り、参加にも数えられます。'],
  ['ストッ句', '作った句は、いくつでもためておけます。消すことも直すこともできます。ためた句から、短冊や句集もつくれます。'],
  ['縦書き一行の表示', '句は縦一行で、ゆったり読めます。句読点も一字あけも、そのまま。横書きへの切りかえもできます。'],
  ['ルビ（ふりがな）', '句に《 》でルビをつけられます。読ませたい語だけに、そっと。短冊や句碑にも、ルビのまま出ます。'],
  ['短冊', '自分の句を、短冊の画像に。色合い38（季節の限定紙も）・模様15・枠7・飾り11（猫・春夏秋冬…）・書体44・落款のかたち5。🎲おまかせ、🍃句にあわせて、📅きょうの短冊も。'],
  ['句碑', '句会で優勝すると、その句が石の句碑に。「優勝記念」の銘板つきで、山・川・海・お寺・神社など14の場所、石8種・かたち6種・苔4種・書体12種から選べます。'],
  ['写真俳句', '自分の写真に、句を重ねて一枚の画像に。文字の色と置き場所、写真の暗さを選べます。'],
  ['句集', 'ためた句から、本のかたちの句集を。見開きでめくれて、PDFファイルにして保存もできます。'],
  ['Xでシェア', '短冊・写真俳句・優勝の句碑は、そのままXに投稿できます。投稿の文は、出す前に見て直せます。'],
  ['季語をしらべる', '約5000の季語を、季節と分類から探せます。五音の季語集もあり、きごさい歳時記・季語辞典へのリンクも。'],
  ['推敲の記録', 'ストッ句の句を直すと、直す前のかたちが残ります。あとで見くらべられます。'],
  ['選句の道具', 'ほかの句会（夏雲システムなど）で選をするときの、手元の道具。自句を外す→えらぶ→並べる→選評を書く、の順に。段の名前・数・記号は句会ごとに自由。AIは使いません。'],
  ['夏雲システムへの橋', '夏雲システムの句会の投句ページとログイン情報を覚えておけます。ルビは夏雲の書きかた（｜漢字（かな））に直してコピー。'],
  ['句会の見学', '定例句会は、はじめから終わりまで見学できます。まずは雰囲気だけでも。'],
  ['バッジとトロフィー', '句をつくる、続ける、句会に出る。そのたびにバッジが増えます。はじめの一歩のバッジもあります。'],
  ['広場だより', '兼題や俳句大会の締切、吟行のお誘い、俳句のコツを、運営からお知らせしています。'],
  ['スマホの通知', '🔔を押しておくと、定例句会のはじまる15分前にスマホに通知が来ます。もう一度押せばOFF。'],
  ['ログインの方法', 'メールアドレス、X、Googleのどれでも。あとからマイページで、ほかの方法もつなげられます。'],
  ['俳号とプロフィール', 'マイページで俳号を決められます。あとから変えることもできます。'],
  ['ふらっと句会', '席がひらいているとき、ふらっと入って、その場の人と小さな句会。お題は当季雑詠。'],
  ['月例句会', '1日に兼題発表、15日しめきり、25日まで互選、26日に結果と句会報。登録した人はだれでも参加できます。見るだけも。'],
  ['談話室', 'みんなの待合室。句会の前後に、ひとこと。俳句のことも、そうでないことも。'],
  ['きょうの時間割', 'ホームに、きょうとあすの定例句会の回が出ます。カレンダーに入れることもできます。'],
  ['海外からも', 'どこからでも使えます。句会の時刻は日本時間なので、お住まいの時差を足し引きして。'],
  ['保存のしくみ', '句と記録はログインした人だけが見られます。選句の道具のメモは、端末の中だけに残ります。'],
  ['合言葉で集まる句会', '合言葉や招待リンクで、メンバーだけの句会。題・選の種類・回数も、自分たちで決められます。'],
  ['お問い合わせ', 'アプリの中から、運営に質問や相談を送れます。こまったときは、どうぞ。']
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
  return jh === 7 ? { kind: 'daily', slot: null } : jh === 19 ? { kind: 'feature', slot: null } : { kind: 'none', slot: null };
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
    info = '投句は' + hh(slot.h) + 'までに（定刻でしめきり）。' + hh(slot.h) + 'に句会が始まります。見学もできます。', warn = 'ほかの人の句や選評の、無断の公開は禁止です。';
  return [[head, theme, info, warn], [head, theme, '投句は' + hh(slot.h) + 'まで。見学もできます。', warn], [head, 'お題は「当季雑詠」。投句は' + hh(slot.h) + 'まで。見学もできます。', warn]].map(v => v.join('\n'));
}
// 実況：21時「すその句会」が、実際にはじまったとき（句を出した人が1人以上）だけ。人数は、公開の小さな記録（pub）にある実数
function liveText(slot, humans) {
  const head = '【いま開催中】' + hh(slot.h) + 'の「' + slotName(slot.h) + '」（定例句会・デモ）に、' + humans + '人が集まっています。';
  return [[head, 'お題は「当季雑詠」。見学もできます。', 'ほかの人の句や選評の、無断の公開は禁止です。'], [head, 'お題は「当季雑詠」。見学もできます。']].map(v => v.join('\n'));
}
function startText(slot) {
  const head = '【はじまりました】' + hh(slot.h) + 'の「' + slotName(slot.h) + '」（定例句会・デモ）', a = 'お題は「当季雑詠」。いま、披講・点付けがはじまっています。見学もできます。', w = 'ほかの人の句や選評の、無断の公開は禁止です。';
  return [[head, a, w], [head, 'お題は「当季雑詠」。見学もできます。', w]].map(v => v.join('\n'));
}
function teiNextLines(slot) {
  const next = slotsAround(slot.start + 1).filter(x => x.start > slot.start).slice(0, 2);
  const nm = x => (x.date === slot.date ? 'きょう' : 'あす') + (x.h < 12 ? 'あさ' : '') + hh(x.h) + '「' + slotName(x.h) + '」';
  const l1 = next.length ? 'さっそく、つぎの定例句会がオープンしています。つぎは、' + nm(next[0]) + 'にひらきます。お題は「当季雑詠」。' : '';
  const l2 = 'つぎの回の投句は、いまから受付中です。開始の時刻までに、ふらりと一句どうぞ。';
  const l3 = next[1] ? nm(next[1]) + 'の回にも、ぜひご参加を。' : '';
  return { l1, l2, l3 };
}
function noshowText(slot, ml) {
  const ms = ml ? MEIKU_SHORT : '', n = teiNextLines(slot), head = (slot.h < 12 ? 'けさ' : slot.h < 17 ? 'きょう昼' : '今夜') + hh(slot.h) + 'の「' + slotName(slot.h) + '」は、おやすみでした。';
  return [[head, n.l1, n.l2, ml], [head, n.l1, ml], [head, 'つぎの回の投句は、いまから受付中です。', ml], [head, 'つぎの回の投句は、いまから受付中です。', ms], [head, ms], [head, n.l1, n.l2, n.l3], [head, n.l1, n.l2], [head, n.l1, 'つぎの回の投句は、いまから受付中です。']].filter(v => ml ? true : (v.indexOf(ml) < 0 && v.indexOf(ms) < 0)).map(v => v.filter(Boolean).join('\n'));
}
function thanksText(slot, humans, bots, ml) {
  const who = bots ? humans + '人（ほかにボット' + bots + '名）' : humans + '人';
  const n = teiNextLines(slot), ms = ml ? MEIKU_SHORT : '';
  const head = '【ありがとうございました】' + slotLabel(slot) + '「' + slotName(slot.h) + '」は、終了しました。参加は、' + who + 'でした。';
  return [[head, n.l1, n.l2, ml], [head, n.l1, ml], [head, 'つぎの回の投句は、いまから受付中です。', ml], [head, 'つぎの回の投句は、いまから受付中です。', ms], [head, ms], [head, n.l1, n.l2, n.l3], [head, n.l1, n.l2], [head, n.l1, 'つぎの回の投句は、いまから受付中です。'], [head, n.l1]].filter(v => ml ? true : (v.indexOf(ml) < 0 && v.indexOf(ms) < 0)).map(v => v.filter(Boolean).join('\n'));
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
  if (kind === 'daily') return Object.assign({ skip: '', key: 'daily-' + jstDate() }, build());
  if (kind === 'feature' || kind === 'feature2') { // 昼12時すぎ（feature2）と19時（feature）：できることを、ひとつずつ。写真つき
    const d = jstDate(), dayN = Math.floor(Date.parse(d + 'T00:00:00Z') / 86400000), pt = partFor(dayN, kind === 'feature2');
    const lk = process.env.INCLUDE_LINK === '1' ? '\n' + URL_ : '';
    if (!pt) { if (kind === 'feature2') return { d, kind, text: '', skip: '写真つきの紹介の一覧（img/parts.json）がないので、投稿しません' }; return { d, kind, text: fitTags([featureText(dayN)], lk, TAGS), skip: '', key: 'feature-' + d }; }
    return { d, kind, text: fitTags([partText(pt)], lk, TAGS), skip: '', key: kind + '-' + d, img: imgOn() ? 'img/parts/' + pt.id + '.jpg' : '', imgNote: pt.t };
  }
  const on = (process.env.TEI_POSTS || 'announce,thanks').split(',').map(x => x.trim());
  // 21時の実況（人が集まった回だけ・1回につき最大1つ）は、変数 TEI_LIVE=0 でとめられる（ふだんは出す）
  const liveOn = kind === 'start' && slot && slot.h === 21 && process.env.TEI_LIVE !== '0';
  if (!on.includes(kind) && !liveOn) return { d: jstDate(), kind, text: '', skip: kind + ' は TEI_POSTS に入っていないので、投稿しません' };
  if (!slot) return { d: jstDate(), kind, text: '', skip: '対象の定例句会が見つかりません' };
  const link = process.env.INCLUDE_LINK === '1' ? '\n' + URL_ + '/#' + slot.sid : '';
  let body, mk = null;
  if (kind === 'announce') body = announceText(slot, t);
  else if (kind === 'start' && liveOn) {
    const pub = await fetchPub(slot.sid);
    if (!pub || !pub.humans) return { d: slot.date, kind, text: '', skip: 'まだ句を出した人の記録がないので、実況は出しません' };
    body = liveText(slot, pub.humans);
  }
  else if (kind === 'start') body = startText(slot);
  else {
    const pub = await fetchPub(slot.sid);
    mk = imgOn() ? meikuFor(slot) : null;
    const ml = mk ? meikuLine(mk) : '';
    body = (!pub || !pub.humans) ? noshowText(slot, ml) : thanksText(slot, pub.humans, pub.bots, ml);
  }
  const text = fitTags(body, link, liveOn ? '#俳句の裾野 #俳句 #句会' : TEI_TAGS);
  return { d: slot.date, kind, text, skip: '', key: kind + '-' + slot.sid, img: mk ? 'img/meiku/' + mk.f : '', imgNote: mk ? '句碑の見本（' + mk.what + '）' + mk.ku + '　' + mk.by : '' };
}
function build() {
  const d = jstDate(), m = menu[d];
  const dow = new Date(d + 'T00:00:00Z').getUTCDay();
  const dayN = Math.floor(Date.parse(d + 'T00:00:00Z') / 86400000);
  let kind = process.env.FORCE_KIND || (dow === 0 || !m ? 'feature' : 'menu'); // 日曜は機能紹介
  let body = kind === 'menu' ? menuText(m) : featureText(Math.floor(dayN / 7) + 11); // 19時の分とかぶらないように、ずらす
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
// 写真をXに送って、番号（media id）をもらう。うまくいかなければ ''（文だけで投稿する）
async function uploadImage(file, keys) {
  const url = 'https://api.x.com/2/media/upload', buf = fs.readFileSync(path.join(__dirname, file));
  const tryOnce = async (how) => {
    let r;
    if (how === 'json') r = await fetch(url, { method: 'POST', headers: { Authorization: authHeader('POST', url, ...keys), 'Content-Type': 'application/json' }, body: JSON.stringify({ media: buf.toString('base64'), media_category: 'tweet_image' }) });
    else { const fd = new FormData(); fd.append('media', new Blob([buf], { type: 'image/jpeg' }), path.basename(file)); fd.append('media_category', 'tweet_image'); r = await fetch(url, { method: 'POST', headers: { Authorization: authHeader('POST', url, ...keys) }, body: fd }); }
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (_) {}
    const id = j && j.data && (j.data.id || j.data.media_id_string || j.data.media_id) || (j && j.media_id_string) || '';
    console.log('写真の送信（' + how + '）: ' + r.status + (id ? ' OK' : ' ' + t.replace(/\r?\n/g, ' ').slice(0, 300)));
    return r.ok && id ? String(id) : '';
  };
  for (const how of ['json', 'form']) { try { const id = await tryOnce(how); if (id) return id; } catch (e) { console.log('写真の送信（' + how + '）でつまずき: ' + e.message); } }
  return '';
}
async function main() {
  const { d, kind, text, skip, key, img, imgNote } = await buildAny();
  if (skip) { console.log('（' + kind + '：' + skip + '）'); return; }
  // 投稿ずみの記録（Firestore の oplog/tweet-<種類-回>）。送り直し・念のための2回目で、二重に投稿しないため
  let fsa = null; try { fsa = require('./tools/fsauth.js'); } catch (_) {}
  const logPath = key ? 'oplog/tweet-' + key : '', canLog = !!(fsa && logPath && await fsa.token());
  if (canLog && process.env.DRY_RUN !== '1') {
    try { const lg = await fsa.withRetry(() => fsa.get(logPath), 3, '投稿記録の読み込み'); if (lg && lg.done) { console.log('（' + key + ' は投稿ずみなので、何もしません）'); return; } }
    catch (e) { console.log('投稿記録が読めませんでした（二重投稿をさけるため、投稿せずに終わります）:', e.message); process.exit(1); }
  }
  const markDone = async (how) => { if (!canLog) return; try { await fsa.withRetry(() => fsa.patch(logPath, { key, done: true, how: how || 'posted', at: new Date().toISOString() }), 3, '投稿記録の保存'); } catch (e) { console.log('投稿記録を保存できませんでした:', e.message); } };
  console.log('--- ' + d + ' (' + kind + ') / 重み付き文字数 ' + weighted(text) + ' ---\n' + text + '\n---');
  const hasImg = !!(img && fs.existsSync(path.join(__dirname, img)));
  console.log(img ? '写真: ' + img + (hasImg ? '（' + (imgNote || '') + '）' : '（ファイルが見つからないので、文だけ）') : '写真: なし');
  const e = process.env, keys = [e.X_API_KEY, e.X_API_SECRET, e.X_ACCESS_TOKEN, e.X_ACCESS_SECRET];
  if (e.MEDIA_TEST === '1') { // 写真を送る試験だけ（投稿はしない・記録もしない）
    if (keys.some(k => !k)) { console.log('（鍵が未設定なので、試験できません）'); return; }
    const tf = hasImg ? img : (PARTS[0] ? 'img/parts/' + PARTS[0].id + '.jpg' : '');
    if (!tf) { console.log('（試験に使う写真がありません）'); return; }
    const tid = await uploadImage(tf, keys);
    console.log(tid ? '::notice title=写真の試験::Xに写真を送れました（' + tf + '）。投稿はしていません' : '::error title=写真の試験::Xに写真を送れませんでした。上の記録を見てください');
    if (!tid) process.exit(1);
    return;
  }
  if (e.DRY_RUN === '1' || keys.some(k => !k)) { console.log('（投稿はしていません：DRY_RUN または鍵が未設定）'); return; }
  const url = 'https://api.x.com/2/tweets';
  let mediaId = '';
  if (hasImg) { mediaId = await uploadImage(img, keys); if (!mediaId) console.log('::warning title=写真::写真を送れなかったので、文だけで投稿します'); }
  const payload = mediaId ? { text, media: { media_ids: [mediaId] } } : { text };
  let r = await fetch(url, { method: 'POST', headers: { Authorization: authHeader('POST', url, ...keys), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!r.ok && mediaId && r.status !== 429 && r.status < 500) { // 写真つきで断られたら、文だけでもう一度（同じ文の二重投稿にはならない：1回目は投稿されていない）
    const j0 = await r.text(); console.log(r.status, j0);
    if (!/duplicate/i.test(j0)) { console.log('::warning title=写真::写真つきの投稿が断られたので、文だけで投稿します'); mediaId = ''; r = await fetch(url, { method: 'POST', headers: { Authorization: authHeader('POST', url, ...keys), 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }); }
    else { console.log('::notice title=X::同じ文の投稿なので、Xに断られました（失敗あつかいにしません）'); await markDone('duplicate'); return; }
  }
  const j = await r.text();
  console.log(r.status, j);
  if (!r.ok) {
    const dup = /duplicate/i.test(j);
    console.log((dup ? '::notice title=X::同じ文の投稿なので、Xに断られました（失敗あつかいにしません）' : '::error title=X::' + r.status + ' ') + (dup ? '' : j.replace(/\r?\n/g, ' ').slice(0, 400)));
    if (dup) await markDone('duplicate');
    if (!dup) process.exit(1);
    return;
  }
  await markDone(mediaId ? 'posted+img:' + img : 'posted');
  console.log(mediaId ? '::notice title=写真つき::' + kind + ' に ' + img + ' を付けました（' + (imgNote || '') + '）' : '（文だけで投稿しました）');
}
if (require.main === module) main().catch(err => { console.error(err); process.exit(1); });
module.exports = { partFor, meikuFor, uploadImage, liveText, build, buildAny, autoKind, slotsAround, weighted, authHeader, announceText, thanksText };
