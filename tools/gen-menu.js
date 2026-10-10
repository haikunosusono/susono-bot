// アプリ本体(index.html)から「今日の兼題」と同じ計算をして menu.json を作ります。
// 使い方: node tools/gen-menu.js ../public/index.html 400
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2] || '../public/index.html', 'utf8');
const days = parseInt(process.argv[3] || '400', 10);
const scripts = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const js = scripts.sort((a, b) => b.length - a.length)[0];
const a = js.indexOf('var G1 ='), b0 = js.indexOf('var SER = {'), b = js.indexOf('};', b0) + 2;
const c0 = js.indexOf('function dayNum()'), c1 = js.indexOf('/* ---- 状態');
if (a < 0 || b0 < 0 || c0 < 0 || c1 < 0) throw new Error('index.html の形が想定と違います');
const code = js.slice(a, b) + '\n' + js.slice(c0, c1) + '\nthis.out = { plan, promptFor, hintFor, SER, dayNum };';
const ctx = { Array, Math, Date, String, Object, JSON }; vm.createContext(ctx); vm.runInContext(code, ctx);
const o = ctx.out, start = o.dayNum(), res = {};
for (let n = start - 2; n < start + days; n++) {
  const s = o.plan(n).series;
  res[new Date(n * 86400000).toISOString().slice(0, 10)] = { s, name: o.SER[s].name, t: o.promptFor(s, n), h: o.hintFor(s, n) };
}
fs.writeFileSync(__dirname + '/../menu.json', JSON.stringify(res, null, 1));
console.log('menu.json', Object.keys(res).length, '日分');
