// Firestore を、サービスアカウント（GitHubの Secrets: FIREBASE_SERVICE_ACCOUNT → 環境変数 SA_JSON）で読み書きする小さな道具
// 鍵がないときは token() が '' を返すので、呼ぶ側は「鍵なしでも読める範囲」で動くこと
const crypto = require('crypto');
const PROJECT = process.env.FB_PROJECT || 'haikunosusono';
const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/';
let cached = '';
async function token() {
  if (cached) return cached;
  let sa = null; try { sa = JSON.parse(process.env.SA_JSON || ''); } catch (_) {}
  if (!sa || !sa.private_key) return '';
  const now = Math.floor(Date.now() / 1000), b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'RS256', typ: 'JWT' }), body = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const sig = crypto.createSign('RSA-SHA256').update(head + '.' + body).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + head + '.' + body + '.' + sig });
  const j = await r.json(); cached = j.access_token || ''; return cached;
}
async function headers() { const t = await token(); return t ? { Authorization: 'Bearer ' + t } : {}; }
// 少し待って、もう一度（一時的なつまずき向け）。最大 tries 回
async function withRetry(fn, tries, label) {
  let last;
  for (let i = 0; i < (tries || 3); i++) { try { return await fn(); } catch (e) { last = e; console.log((label || '') + ' つまずき ' + (i + 1) + '回目: ' + e.message); if (i < (tries || 3) - 1) await new Promise((r) => setTimeout(r, 2000 * (i + 1))); } }
  throw last;
}
function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  if (typeof v === 'object') { const f = {}; Object.keys(v).forEach((k) => { f[k] = enc(v[k]); }); return { mapValue: { fields: f } }; }
  return { stringValue: String(v) };
}
function dec(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue; if ('booleanValue' in v) return v.booleanValue; if ('integerValue' in v) return Number(v.integerValue); if ('doubleValue' in v) return v.doubleValue; if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(dec);
  if ('mapValue' in v) { const o = {}; Object.entries(v.mapValue.fields || {}).forEach(([k, x]) => { o[k] = dec(x); }); return o; }
  return null;
}
async function get(path) {
  const r = await fetch(BASE + path, { headers: await headers() });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Firestore ' + r.status + ' ' + (await r.text()).slice(0, 160));
  const j = await r.json(), o = {}; Object.entries(j.fields || {}).forEach(([k, x]) => { o[k] = dec(x); }); return o;
}
async function list(coll, pageSize) {
  const out = []; let tok = '';
  for (let i = 0; i < 30; i++) {
    const r = await fetch(BASE + coll + '?pageSize=' + (pageSize || 300) + (tok ? '&pageToken=' + encodeURIComponent(tok) : ''), { headers: await headers() });
    if (!r.ok) throw new Error('Firestore ' + r.status + ' ' + (await r.text()).slice(0, 160));
    const j = await r.json();
    (j.documents || []).forEach((d) => { const o = {}; Object.entries(d.fields || {}).forEach(([k, x]) => { o[k] = dec(x); }); out.push({ id: d.name.split('/').pop(), data: o }); });
    tok = j.nextPageToken || ''; if (!tok) break;
  }
  return out;
}
// 書く（指定した項目だけ上書き。文書がなければ作る）
async function patch(path, fields) {
  const keys = Object.keys(fields), q = keys.map((k) => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
  const f = {}; keys.forEach((k) => { f[k] = enc(fields[k]); });
  const r = await fetch(BASE + path + '?' + q, { method: 'PATCH', headers: Object.assign({ 'Content-Type': 'application/json' }, await headers()), body: JSON.stringify({ fields: f }) });
  if (!r.ok) throw new Error('Firestore ' + r.status + ' ' + (await r.text()).slice(0, 160));
}
async function del(path) {
  const r = await fetch(BASE + path, { method: 'DELETE', headers: await headers() });
  if (!r.ok && r.status !== 404) throw new Error('Firestore ' + r.status + ' ' + (await r.text()).slice(0, 160));
}
module.exports = { token, get, list, patch, del, withRetry };
