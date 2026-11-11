// アカウントをまとめる：FROM（空、または少ない方）の記録を TO（記録のある方）へ写し、FROM のログインを消す
// そのあと本人が、TO でログインしたまま、マイページの「Xをつなぐ／Googleをつなぐ／メールアドレスをつなぐ」を押せば、ひとつになる
// 動かし方：GitHub Actions「アカウントをまとめる」で FROM と TO の uid を入れる（Firebaseコンソール → Authentication → Users に出る）。DRY=1 なら見るだけ
const fs = require('./tools/fsauth.js');
const FROM = String(process.env.FROM_UID || '').trim(), TO = String(process.env.TO_UID || '').trim(), DRY = process.env.DRY !== '0';
const PROJECT = process.env.FB_PROJECT || 'haikunosusono';
(async () => {
  if (!FROM || !TO || FROM === TO) { console.log('FROM_UID と TO_UID（ちがうもの）を入れてください'); process.exit(1); }
  if (!(await fs.token())) { console.log('サービスアカウントの鍵がありません'); process.exit(1); }
  const fromDocs = await fs.list('data/users/' + FROM, 300), toDocs = await fs.list('data/users/' + TO, 300);
  const toIds = {}; toDocs.forEach((d) => { toIds[d.id] = 1; });
  const mFrom = await fs.get('members/' + FROM), mTo = await fs.get('members/' + TO);
  console.log('FROM', FROM, '：ストッ句', fromDocs.length, '件／俳号', mFrom && mFrom.haigo || '（なし）');
  console.log('TO  ', TO, '：ストッ句', toDocs.length, '件／俳号', mTo && mTo.haigo || '（なし）');
  const move = fromDocs.filter((d) => !toIds[d.id]);
  console.log('写す：', move.length, '件（同じ番号のものは TO を残す）');
  if (DRY) { console.log('DRY：見るだけで終わります'); return; }
  for (const d of move) await fs.withRetry(() => fs.patch('data/users/' + TO + '/' + d.id, d.data), 3, '写し');
  // プロフィールは、TO にない項目だけ FROM から補う（俳号など TO のものを優先）
  if (mFrom) { const fill = {}; Object.keys(mFrom).forEach((k) => { if (mTo == null || mTo[k] == null) fill[k] = mFrom[k]; }); if (Object.keys(fill).length) await fs.patch('members/' + TO, fill); }
  // FROM のログインを消す（Firebase Authentication）。消すと、その X／Google／メールは TO につなげられる
  const tk = await fs.token();
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/projects/' + PROJECT + '/accounts:delete', { method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: FROM }) });
  if (!r.ok) { console.log('FROM のログインを消せませんでした:', r.status, (await r.text()).slice(0, 200)); process.exit(1); }
  for (const d of fromDocs) await fs.del('data/users/' + FROM + '/' + d.id);
  await fs.del('members/' + FROM);
  console.log('できました。本人が TO でログインして、マイページの「つなぐ」を押してください');
})().catch((e) => { console.error(e); process.exit(1); });
