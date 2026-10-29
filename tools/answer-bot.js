/* 返事係：GitHub Actions から5分ごとに動く。
   アプリを開いていなくても、
   1) ボットの句についた評に、ボットの作者がお礼・返事をする
   2) 作者の問いかけ（聞かせて・教えて・？など）や、主宰への返信に、松風主宰が答える
   ※ アプリ側の返事が先に出ていれば（返信がついていれば）何もしない。DRY_RUN=1 なら、書かずに表示だけ。 */
const crypto = require('crypto');
const SENSEI = 'https://script.google.com/macros/s/AKfycbzPL2utUP3yA-wqTJD4a0qKavefh-KNg2dOAtWGA35YFgJTf5t57SaucWRUqTz_9PIX/exec';
const PROJECT = 'haikunosusono', DRY = process.env.DRY_RUN === '1';
const WAIT_MS = 100 * 1000, MAX_AGE = 6 * 3600 * 1000, MAX_DO = 6;
const ASK_RE = /[？?]|聞かせて|きかせて|教えて|おしえて|どう(でしょう|ですか|思|か)|アドバイス|指摘|ご意見|直し|添削|助言|改善/;
const NOKIGO_RE = /無季|季語(が|は|の)?(な[いく]|無[いく]|見(当た|つか|あた)[らり]|入って(い)?な|ありませ|含まれて(い)?な|不在|欠け)|季語を(入れ|加え|足)/;
const RB_RE = /([一-龥々〇ヶ]+)[《（(][ぁ-ゖァ-ヶー]+[》）)]/g;
const plain = (v) => String(v || '').replace(RB_RE, '$1').replace(/《[^》]*》/g, '');
const BOT_THX = ['ありがとうございます。そこを読んでいただけて、うれしいです。', '温かい評をありがとうございます。励みになります。またぜひ読んでください。', 'ていねいに読んでいただき、ありがとうございます。そう感じていただけて、ほっとしました。'];
const SENSEI_FB = 'ご質問ありがとうございます。わたしは、いまのことばの並びに、作者の実感を感じました。声に出して、いくつか並べくらべてみるのも、よい稽古です。';
async function token() {
  const sa = JSON.parse(process.env.SA_JSON || '{}'); if (!sa.private_key) return '';
  const now = Math.floor(Date.now() / 1000), b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'RS256', typ: 'JWT' }), body = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3000 });
  const sig = crypto.createSign('RSA-SHA256').update(head + '.' + body).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + head + '.' + body + '.' + sig });
  const j = await r.json(); return j.access_token || '';
}
function val(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue; if ('booleanValue' in v) return v.booleanValue; if ('integerValue' in v) return Number(v.integerValue); if ('doubleValue' in v) return v.doubleValue; if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  if ('mapValue' in v) { const o = {}; Object.entries(v.mapValue.fields || {}).forEach(([k, x]) => { o[k] = val(x); }); return o; }
  return null;
}
const note = (t, m) => console.log('::notice title=' + t + '::' + String(m).replace(/\r?\n/g, ' ').slice(0, 900));
async function ask(kind, payload) {
  try {
    const r = await fetch(SENSEI, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload), redirect: 'follow' });
    const o = JSON.parse(await r.text());
    if (o && o.ok && o.text && !NOKIGO_RE.test(o.text)) return String(o.text);
  } catch (e) { console.log(kind + ' AI error ' + e.message); }
  return '';
}
(async () => {
  const tk = await token(); if (!tk) { note('返事係', '鍵がありません'); return; }
  const base = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/kukai';
  let docs = [], pt = '';
  for (let i = 0; i < 15; i++) {
    const r = await fetch(base + '?pageSize=300&mask.fieldPaths=comments&mask.fieldPaths=entries' + (pt ? '&pageToken=' + encodeURIComponent(pt) : ''), { headers: { Authorization: 'Bearer ' + tk } });
    if (!r.ok) { note('返事係', '読めません ' + r.status + ' ' + (await r.text()).slice(0, 160)); return; }
    const j = await r.json(); docs = docs.concat(j.documents || []); pt = j.nextPageToken || ''; if (!pt) break;
  }
  const now = Date.now(); let done = 0, seen = 0;
  for (const d of docs) {
    const sid = d.name.split('/').pop(), f = {}; Object.entries(d.fields || {}).forEach(([k, x]) => { f[k] = val(x); });
    const cm = f.comments || {}, es = f.entries || {}, keys = Object.keys(cm);
    if (!keys.length) continue;
    const replied = {}; keys.forEach((k) => { const re = cm[k] && cm[k].re; if (re) replied[re] = 1; });
    for (const k of keys.sort((a, b) => (cm[a].at || 0) - (cm[b].at || 0))) {
      const c = cm[k]; if (!c || !c.text || !c.at) continue;
      const age = now - c.at; if (age < WAIT_MS || age > MAX_AGE) continue;
      if (c.uid === 'benico' || c.bot || c.anon || replied[k]) continue;
      const e = es[c.eid]; if (!e) continue;
      const ku = plain(String(e.a || '') + String(e.b || '') + String(e.c || '')); if (!ku) continue;
      const q = String(c.text).slice(0, 140);
      const parent = c.re && cm[c.re];
      let kind = '';
      if (e.bot) { if (c.uid !== c.eid) kind = 'bot'; }
      else if (parent && parent.uid === 'benico') kind = 'sensei';
      else if (c.uid === c.eid && ASK_RE.test(c.text)) kind = 'sensei';
      if (!kind) continue;
      seen++;
      if (done >= MAX_DO) continue;
      let text = '', co;
      const nk = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      if (kind === 'bot') {
        const isQ = /[？?]/.test(q);
        text = await ask('bot', { reply: { ku, q: (isQ ? '' : '【質問ではなく評です。お礼と、うれしかった点をひとこと返してください】') + q, name: String(e.haigo || '').replace('（ボット）', '') } });
        if (!text) text = BOT_THX[Math.floor(Math.random() * BOT_THX.length)];
        co = { eid: c.eid, uid: c.eid, text: text.slice(0, 140), tone: 'やさしく', part: [], at: Date.now(), re: k, jiku: true, anon: true, bot: true };
      } else {
        text = await ask('sensei', { ask: { ku, q: ('【先生へ：遠慮せず、気になる点をはっきり一つ挙げ、直した形の案を一つ示してください】' + q).slice(0, 140) } });
        if (!text) text = SENSEI_FB;
        co = { eid: c.eid, uid: 'benico', text: text.slice(0, 320), tone: 'やさしく', part: [], at: Date.now(), re: k };
      }
      console.log((DRY ? '[DRY] ' : '') + sid + ' ' + kind + ' ← 「' + q + '」→ ' + text.slice(0, 80));
      if (!DRY) {
        const fv = (o) => ({ mapValue: { fields: Object.fromEntries(Object.entries(o).map(([a, b]) => [a, typeof b === 'string' ? { stringValue: b } : typeof b === 'boolean' ? { booleanValue: b } : typeof b === 'number' ? { integerValue: String(b) } : { arrayValue: { values: [] } }])) } });
        const r = await fetch(base + '/' + encodeURIComponent(sid) + '?updateMask.fieldPaths=' + encodeURIComponent('comments.' + nk), { method: 'PATCH', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { comments: { mapValue: { fields: { [nk]: fv(co) } } } } }) });
        if (!r.ok) { note('返事係', '書けません ' + r.status + ' ' + (await r.text()).slice(0, 200)); return; }
      }
      replied[k] = 1; done++;
    }
  }
  note('返事係', (DRY ? '[試し] ' : '') + '返事が必要 ' + seen + '件・書いた ' + (DRY ? 0 : done) + '件');
})().catch((e) => { note('返事係', 'エラー ' + e.message); });
