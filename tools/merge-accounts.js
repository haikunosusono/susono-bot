// アカウントをまとめる：FROM の記録（ストッ句・プロフィール・句会の記録の中の名前）を TO へまとめ、FROM のログインを消す
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
  if (DRY) {
    for (const coll of ['kukai', 'gohyo', 'monthly', 'lounge', 'stats']) { try { const docs = await fs.list(coll, 300); const hit = docs.filter((d) => JSON.stringify(d.data).indexOf(FROM) >= 0); console.log(coll + '：FROM が出てくる記録 ' + hit.length + ' 件' + (hit.length ? '（' + hit.slice(0, 8).map((d) => d.id).join(', ') + (hit.length > 8 ? ' …' : '') + '）' : '')); } catch (e) { console.log(coll, 'が読めません:', e.message); } }
    console.log('DRY：見るだけで終わります'); return;
  }
  for (const d of move) await fs.withRetry(() => fs.patch('data/users/' + TO + '/' + d.id, d.data), 3, '写し');
  // 2段目：句会の記録（出した句・点・選評・トロフィーのもと）の中の「FROM」を、ぜんぶ「TO」に書きかえる
  // 文書の中身を深くたどり、キーが FROM なら TO に（TO がすでにあれば TO を残す）、値が FROM の文字列なら TO に
  function rewrite(v, st) {
    if (Array.isArray(v)) return v.map((x) => rewrite(x, st));
    if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach((k) => { const nk = k === FROM ? TO : k; if (k === FROM) { st.n++; if (v[TO] != null) { st.keep++; return; } } o[nk] = rewrite(v[k], st); }); return o; }
    if (typeof v === 'string' && v === FROM) { st.n++; return TO; }
    return v;
  }
  for (const coll of ['kukai', 'gohyo', 'monthly', 'lounge', 'stats']) {
    let docs = []; try { docs = await fs.withRetry(() => fs.list(coll, 300), 3, coll); } catch (e) { console.log(coll, 'が読めません:', e.message); continue; }
    let hit = 0;
    for (const d of docs) {
      if (JSON.stringify(d.data).indexOf(FROM) < 0) continue;
      const st = { n: 0, keep: 0 }, nd = rewrite(d.data, st); hit++;
      console.log(coll + '/' + d.id + '：' + st.n + ' か所を書きかえ' + (st.keep ? '（' + st.keep + ' か所は TO のものを残した）' : ''));
      const fields = {}; Object.keys(nd).forEach((k) => { fields[k] = nd[k]; });
      await fs.withRetry(() => fs.patch(coll + '/' + d.id, fields), 3, coll + '/' + d.id);
    }
    console.log(coll + '：' + hit + ' 件');
  }
  // uid が文書の名前になっているもの：pushq（通知の宛先）・inquiries（お問い合わせ）・presence は、TO になければ移す
  for (const coll of ['pushq', 'inquiries']) {
    try { const f = await fs.get(coll + '/' + FROM); if (f) { const t = await fs.get(coll + '/' + TO); if (!t) await fs.patch(coll + '/' + TO, f); await fs.del(coll + '/' + FROM); console.log(coll + '：移しました'); } } catch (e) { console.log(coll + '：', e.message); }
  }
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
