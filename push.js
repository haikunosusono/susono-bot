// スマホ通知（Web Push）：はじまる15分前に、ONの人へ通知を送る。GitHub Actions（push.yml）から動く
// 必要なもの：GitHubのSecretsに VAPID_PRIVATE_KEY。公開鍵はアプリ（index.html）と同じもの
const webpush = require('web-push');
const PROJECT = process.env.FB_PROJECT || 'haikunosusono';
const PUB = 'BAkyv8J-yNlH2PIRuLSfLcE_yfeAbcZrpyHD85DcLr7MxqOj_qQngT-S6d0c4lfrETLBn_bVAmXHNKV0K4Doh4o';
const DRY = process.env.DRY_RUN === '1';
const JP_HOL = new Set(['2026-01-01', '2026-01-12', '2026-02-11', '2026-02-23', '2026-03-20', '2026-04-29', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06', '2026-07-20', '2026-08-11', '2026-09-21', '2026-09-22', '2026-09-23', '2026-10-12', '2026-11-03', '2026-11-23',
  '2027-01-01', '2027-01-11', '2027-02-11', '2027-02-23', '2027-03-21', '2027-03-22', '2027-04-29', '2027-05-03', '2027-05-04', '2027-05-05', '2027-07-19', '2027-08-11', '2027-09-20', '2027-09-23', '2027-10-11', '2027-11-03', '2027-11-23']);
function dayOff(jd) { const w = new Date(jd * 86400000).getUTCDay(); return w === 0 || w === 6 || JP_HOL.has(new Date(jd * 86400000).toISOString().slice(0, 10)); }
function hoursFor(jd) { return dayOff(jd) ? [10, 13, 15, 21, 23, 25] : [21, 23, 25]; }
function slotName(h) { return h === 21 ? 'だれでも句会' : h === 23 ? 'おかわり句会' : h === 25 ? 'よなよな句会' : h === 10 ? 'おはよう句会' : h === 13 ? 'こんにちは句会' : 'おやつの句会'; }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function sidOf(jd, h) { return 't' + new Date(jd * 86400000).toISOString().slice(0, 10).replace(/-/g, '') + '-' + pad(h); }
function startOf(jd, h) { return jd * 86400000 - 9 * 3600000 + h * 3600000; }
// いま（または NOW_MS）から見て、「これから0〜35分以内にはじまる回」を探す（Actionsの遅れを見込む）
function findSlot(now) {
  const jd = Math.floor((now + 9 * 3600000) / 86400000);
  for (let d = jd - 1; d <= jd + 1; d++) for (const h of hoursFor(d)) { const st = startOf(d, h), diff = st - now; if (diff > 0 && diff <= 35 * 60000) return { jd: d, h, st, sid: sidOf(d, h) }; }
  return null;
}
async function listSubs() {
  const out = []; let tok = '';
  for (let i = 0; i < 20; i++) {
    const r = await fetch('https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/pushq?pageSize=300' + (tok ? '&pageToken=' + tok : ''));
    if (!r.ok) throw new Error('Firestore ' + r.status);
    const j = await r.json();
    (j.documents || []).forEach((d) => {
      const f = d.fields || {};
      const sub = f.sub && f.sub.stringValue, on = f.on && f.on.booleanValue, all = f.all && f.all.booleanValue;
      const sids = ((f.sids && f.sids.arrayValue && f.sids.arrayValue.values) || []).map((v) => v.stringValue);
      if (sub && on) out.push({ sub: JSON.parse(sub), all: !!all, sids });
    });
    tok = j.nextPageToken || ''; if (!tok) break;
  }
  return out;
}
(async () => {
  const now = process.env.NOW_MS ? Number(process.env.NOW_MS) : Date.now(), slot = findSlot(now);
  if (!slot) { console.log('いま通知する回はありません'); return; }
  const mins = Math.max(1, Math.round((slot.st - now) / 60000));
  const body = (slot.h === 25 ? '夜中1時' : slot.h + '時') + '「' + slotName(slot.h) + '」が、あと' + mins + '分ではじまります。一句を出して、ひらいてください。';
  console.log('対象:', slot.sid, body);
  const subs = (await listSubs()).filter((s) => s.all || s.sids.indexOf(slot.sid) >= 0);
  console.log('通知先:', subs.length + '件');
  if (DRY) { console.log('DRY_RUN：送りません'); return; }
  if (!process.env.VAPID_PRIVATE_KEY) { console.log('VAPID_PRIVATE_KEY が未設定のため、送りません'); return; }
  webpush.setVapidDetails('mailto:hattyam@gmail.com', PUB, process.env.VAPID_PRIVATE_KEY);
  let ok = 0, ng = 0;
  for (const s of subs) {
    try { await webpush.sendNotification(s.sub, JSON.stringify({ title: '俳句の裾野', body, url: 'https://haikunosusono.web.app/', tag: slot.sid }), { TTL: 1800 }); ok++; } catch (e) { ng++; }
  }
  console.log('送信 成功', ok, '失敗', ng);
})().catch((e) => { console.error(e); process.exit(1); });
