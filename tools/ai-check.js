/* AI先生の点検係：GitHub Actions から動かす。結果は「お知らせ（annotation）」に出す。
   1) AI先生（Apps Script）に見本の句を送り、動いているか・どの型かを見る
   2) 最近の句会（kukai）で、松風主宰（benico）の評が AI で書かれたか（ai:true）を数える */
const crypto = require('crypto');
const SENSEI = 'https://script.google.com/macros/s/AKfycbzPL2utUP3yA-wqTJD4a0qKavefh-KNg2dOAtWGA35YFgJTf5t57SaucWRUqTz_9PIX/exec';
const PROJECT = 'haikunosusono';
const note = (title, msg) => console.log('::notice title=' + title + '::' + String(msg).replace(/\r?\n/g, ' ').slice(0, 900));
async function checkSensei() {
  const t0 = Date.now();
  try {
    const r = await fetch(SENSEI, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ ku: '柿くへば鐘が鳴るなり法隆寺' }), redirect: 'follow' });
    const tx = await r.text(); let o = null; try { o = JSON.parse(tx); } catch (_) {}
    const sec = Math.round((Date.now() - t0) / 1000);
    if (o && o.ok) note('AI先生', 'OK（' + (o.model || '?') + '・' + sec + '秒）' + o.text);
    else note('AI先生', 'NG HTTP ' + r.status + ' ' + (o ? (o.err || JSON.stringify(o)) : tx.slice(0, 200)));
  } catch (e) { note('AI先生', 'NG つながらない ' + e.message); }
}
async function token() {
  const sa = JSON.parse(process.env.SA_JSON || '{}'); if (!sa.private_key) return '';
  const now = Math.floor(Date.now() / 1000), b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'RS256', typ: 'JWT' }), body = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const sig = crypto.createSign('RSA-SHA256').update(head + '.' + body).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + head + '.' + body + '.' + sig });
  const j = await r.json(); return j.access_token || '';
}
function val(v) { if (!v) return null; if ('stringValue' in v) return v.stringValue; if ('booleanValue' in v) return v.booleanValue; if ('integerValue' in v) return Number(v.integerValue); if ('mapValue' in v) { const o = {}; Object.entries(v.mapValue.fields || {}).forEach(([k, x]) => { o[k] = val(x); }); return o; } if ('arrayValue' in v) return (v.arrayValue.values || []).map(val); return null; }
async function checkKukai() {
  const tk = await token(); if (!tk) { note('合評の先生の評', 'しらべられません（鍵がない）'); return; }
  const base = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/kukai?pageSize=300&mask.fieldPaths=comments';
  let docs = [], pt = '';
  for (let i = 0; i < 15; i++) {
    const r = await fetch(base + (pt ? '&pageToken=' + encodeURIComponent(pt) : ''), { headers: { Authorization: 'Bearer ' + tk } });
    if (!r.ok) { note('合評の先生の評', 'しらべられません ' + r.status + ' ' + (await r.text()).slice(0, 160)); return; }
    const j = await r.json(); docs = docs.concat(j.documents || []); pt = j.nextPageToken || ''; if (!pt) break;
  }
  const since = Date.now() - 36 * 3600000, lines = [];
  docs.forEach((d) => {
    const id = d.name.split('/').pop(), f = {}; Object.entries(d.fields || {}).forEach(([k, x]) => { f[k] = val(x); });
    const cs = Object.values(f.comments || {}).filter((c) => c && c.uid === 'benico' && (c.at || 0) > since);
    if (!cs.length) return;
    const ai = cs.filter((c) => c.ai === true);
    lines.push(id + '：先生の評 ' + cs.length + '件（AI ' + ai.length + '・決まり文句 ' + (cs.length - ai.length) + '）' + (ai[0] ? ' 例「' + String(ai[0].text).slice(0, 60) + '」' : ''));
  });
  note('合評の先生の評（36時間）', lines.length ? lines.slice(0, 6).join(' ／ ') : 'この36時間に、先生の評のついた句会はありません');
}
(async () => { await checkSensei(); await checkKukai(); })().catch((e) => { note('点検係', 'エラー ' + e.message); });
