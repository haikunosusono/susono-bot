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

/* 定例句会の評の点検：直近の定例句会（開始から4時間以内）で、
   主宰の評・ボットの感想が、AIか「かんたん」か／同じ文のくり返し／返事のこし／評のない句 を数える */
async function checkTei() {
  const tk = await token(); if (!tk) { note('定例句会の点検', 'しらべられません（鍵がない）'); return; }
  const base = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/kukai?pageSize=300&mask.fieldPaths=comments&mask.fieldPaths=entries&mask.fieldPaths=status';
  let docs = [], pt = '';
  for (let i = 0; i < 15; i++) {
    const r = await fetch(base + (pt ? '&pageToken=' + encodeURIComponent(pt) : ''), { headers: { Authorization: 'Bearer ' + tk } });
    if (!r.ok) { note('定例句会の点検', 'しらべられません ' + r.status); return; }
    const j = await r.json(); docs = docs.concat(j.documents || []); pt = j.nextPageToken || ''; if (!pt) break;
  }
  const now = Date.now(), seenText = {}, lines = [];
  const all = docs.map((d) => { const id = d.name.split('/').pop(), f = {}; Object.entries(d.fields || {}).forEach(([k, x]) => { f[k] = val(x); }); return { id, f }; }).filter((x) => /^t\d{8}-\d{2}$/.test(x.id));
  /* 36時間ぶんの文を集めて、同じ文のくり返しを数える */
  all.forEach((x) => Object.values(x.f.comments || {}).forEach((c) => { if (c && (c.uid === 'benico' || c.bot || (x.f.entries && x.f.entries[c.uid] && x.f.entries[c.uid].bot)) && c.text && (now - (c.at || 0)) < 36 * 3600000) { const k = String(c.text).slice(0, 24); seenText[k] = (seenText[k] || 0) + 1; } }));
  const rep = Object.entries(seenText).filter(([, n]) => n >= 3).map(([k, n]) => '「' + k + '…」' + n + '回');
  all.forEach((x) => {
    const m = /^t(\d{4})(\d{2})(\d{2})-(\d{2})$/.exec(x.id), h = +m[4];
    const startMs = Date.UTC(+m[1], +m[2] - 1, +m[3]) - 9 * 3600000 + h * 3600000;
    if (now - startMs > 4 * 3600000 || now < startMs) return;
    const es = x.f.entries || {}, cm = x.f.comments || {}, cs = Object.values(cm).filter(Boolean);
    const humans = Object.keys(es).filter((k) => es[k] && !es[k].bot), bots = Object.keys(es).filter((k) => es[k] && es[k].bot);
    const bens = cs.filter((c) => c.uid === 'benico' && !c.re), benAI = bens.filter((c) => c.ai === true).length;
    const bk = cs.filter((c) => !c.re && c.uid !== 'benico' && es[c.uid] && es[c.uid].bot && es[c.eid] && !es[c.eid].bot), bkAI = bk.filter((c) => c.ai === true).length;
    const noBen = humans.filter((k) => !bens.some((c) => c.eid === k)).length;
    const ng = cs.filter((c) => (c.uid === 'benico' || c.bot) && /無季|季語(が|は)?(な[いく]|ありませ|見当たら)/.test(c.text || '')).length;
    const replied = {}; cs.forEach((c) => { if (c.re && (c.uid === 'benico' || c.bot)) replied[c.re] = 1; });
    const pend = Object.keys(cm).filter((k) => { const c = cm[k]; return c && !c.bot && c.uid !== 'benico' && (now - (c.at || 0)) > 10 * 60000 && ((es[c.eid] && es[c.eid].bot && c.uid !== c.eid) || (c.re && cm[c.re] && cm[c.re].uid === 'benico')) && !replied[k]; }).length;
    lines.push(x.id + '：人' + humans.length + '・ボット' + bots.length + '／主宰の評 ' + bens.length + '件（しっかり ' + benAI + '・かんたん ' + (bens.length - benAI) + '）／ボットの感想 ' + bk.length + '件（しっかり ' + bkAI + '・かんたん ' + (bk.length - bkAI) + '）' + (noBen ? '／評のない句 ' + noBen : '') + (pend ? '／返事のこし ' + pend : '') + (ng ? '／「季語がない」系 ' + ng : ''));
  });
  note('定例句会の評の点検', (lines.length ? lines.join(' ／ ') : '直近4時間に、定例句会はありません') + (rep.length ? ' ／ 同じ文のくり返し（36時間）：' + rep.slice(0, 4).join('、') : ''));
}
(async () => { await checkSensei(); await checkKukai(); await checkTei(); })().catch((e) => { note('点検係', 'エラー ' + e.message); });
