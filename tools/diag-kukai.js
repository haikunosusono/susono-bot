/* 診断：定例句会の進みぐあいを見る（句の中身は出さない）。GitHub Actions から手で動かす。 */
const crypto = require('crypto');
const PROJECT = 'haikunosusono', DATE = process.env.DATE || '';
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
const jst = (t) => t ? new Date(t + 9 * 3600000).toISOString().replace('T', ' ').slice(5, 19) + ' JST' : '-';
(async () => {
  const tk = await token(); if (!tk) { console.log('no token'); process.exit(1); }
  const base = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/kukai';
  let docs = [], pt = '';
  for (let i = 0; i < 5; i++) {
    const r = await fetch(base + '?pageSize=300' + (pt ? '&pageToken=' + encodeURIComponent(pt) : ''), { headers: { Authorization: 'Bearer ' + tk } });
    const j = await r.json(); docs = docs.concat(j.documents || []); pt = j.nextPageToken || ''; if (!pt) break;
  }
  docs.forEach((d) => {
    const id = d.name.split('/').pop(), o = {}; Object.entries(d.fields || {}).forEach(([k, x]) => { o[k] = val(x); });
    if (DATE && String(o.date || '') !== DATE && id.indexOf(DATE.replace(/-/g, '')) < 0) return;
    if (!DATE && !o.tei) return;
    const es = o.entries || {}, ids = Object.keys(es), bots = ids.filter((k) => es[k] && es[k].bot), hum = ids.filter((k) => !(es[k] && es[k].bot));
    const votes = o.votes || {}, vk = Object.keys(votes), done = vk.filter((k) => votes[k] && votes[k].done);
    const cm = Object.keys(o.comments || {}).length;
    console.log([id, 'date=' + o.date, 'slot=' + o.slot, 'tei=' + !!o.tei, 'status=' + o.status, 'opened=' + !!o.opened, 'humans=' + hum.length, 'bots=' + bots.length, 'votes=' + vk.length + '(done ' + done.length + ')', 'comments=' + cm, 'startedAt=' + jst(o.startedAt), 'selectStart=' + jst(o.selectStart), 'revealAt=' + jst(o.revealAt), 'cmtShift=' + (o.cmtShift || 0)].join('  '));
  });
})();
