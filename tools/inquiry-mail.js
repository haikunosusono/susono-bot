/* ご意見・ご要望の見回り：GitHub Actions から動く。
   アプリの「ご意見・ご要望」（inquiries）に、まだメールしていないものがあれば、
   松風主宰の Apps Script（Google）に頼んで、運営者の Gmail に知らせる。送ったら mailed の印をつける（同じものを2回送らない）。
   DRY_RUN=1 なら、送らず表示だけ。 */
const crypto = require('crypto');
const SENSEI = 'https://script.google.com/macros/s/AKfycbzPL2utUP3yA-wqTJD4a0qKavefh-KNg2dOAtWGA35YFgJTf5t57SaucWRUqTz_9PIX/exec';
const KIND = { req: 'ご意見・ご要望', rights: '権利侵害の申告', gen: 'お問い合わせ', faq: 'ご質問' };
const PROJECT = 'haikunosusono', DRY = process.env.DRY_RUN === '1', MAX_AGE = 7 * 86400000, MAX_DO = 10;
async function token() {
  const sa = JSON.parse(process.env.SA_JSON || '{}'); if (!sa.private_key) return '';
  const now = Math.floor(Date.now() / 1000), b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'RS256', typ: 'JWT' }), body = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
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
(async () => {
  const tk = await token(); if (!tk) { console.log('鍵がありません'); return; }
  const base = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/inquiries';
  let docs = [], pt = '';
  for (let i = 0; i < 10; i++) {
    const r = await fetch(base + '?pageSize=300' + (pt ? '&pageToken=' + encodeURIComponent(pt) : ''), { headers: { Authorization: 'Bearer ' + tk } });
    if (!r.ok) { console.log('読めません ' + r.status + ' ' + (await r.text()).slice(0, 160)); return; }
    const j = await r.json(); docs = docs.concat(j.documents || []); pt = j.nextPageToken || ''; if (!pt) break;
  }
  const now = Date.now(); let sent = 0;
  for (const d of docs) {
    const uid = d.name.split('/').pop(), f = {}; Object.entries(d.fields || {}).forEach(([k, x]) => { f[k] = val(x); });
    const mailed = f.mailed || {};
    for (const k of Object.keys(f).filter((x) => x.charAt(0) === 't' && f[x] && typeof f[x] === 'object').sort()) {
      const q = f[k]; if (!q.text || mailed[k]) continue;
      if (q.at && now - q.at > MAX_AGE) continue; /* 古いものは、もう知らせない（しくみを入れる前のぶん） */
      if (sent >= MAX_DO) break;
      console.log((DRY ? '[表示だけ] ' : '') + uid.slice(0, 6) + ' ' + k + ' ' + (q.kind || '') + ' ' + (q.name || '') + ' ' + String(q.text).slice(0, 40));
      if (DRY) { sent++; continue; }
      let ok = false;
      try {
        const r = await fetch(SENSEI, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ mail: { kind: KIND[q.kind] || q.kind || 'お問い合わせ', name: q.name || '', text: q.text, at: q.at || 0 } }) });
        const o = await r.json(); ok = !!(o && o.ok); if (!ok) console.log('  送れません ' + JSON.stringify(o).slice(0, 120));
      } catch (e) { console.log('  送れません ' + e.message); }
      if (!ok) continue;
      const r2 = await fetch(base + '/' + encodeURIComponent(uid) + '?updateMask.fieldPaths=' + encodeURIComponent('mailed.' + k), { method: 'PATCH', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { mailed: { mapValue: { fields: { [k]: { booleanValue: true } } } } } }) });
      if (!r2.ok) console.log('  印がつけられません ' + r2.status);
      sent++;
    }
  }
  console.log('送ったメール：' + sent + '通');
})();
