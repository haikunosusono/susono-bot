/* 裾野の時計（Google Apps Script）
 * GitHubの予約実行（cron）が数時間おくれる日があるので、Apps Script の「1分ごとのトリガー」から、
 * GitHub Actions の「手で動かす」入口（workflow_dispatch）を、決まった時刻にたたく。
 * GitHub側の cron は保険として残す。二重には動かない（送りずみ・投稿ずみの記録が Firestore にあるので）。
 *
 * つかいかた（はっちゃんの操作）
 *  1. script.google.com で「新しいプロジェクト」→ 名前「裾野の時計」→ この内容をぜんぶ貼る
 *  2. 左の歯車「プロジェクトの設定」→「スクリプト プロパティ」→ 追加：
 *       プロパティ GH_TOKEN ／ 値 GitHubのトークン（細かい権限：この倉庫の Actions = Read and write だけ）
 *  3. 上の関数えらびで setup を選び「実行」→ 権限をゆるす（Googleの確認画面：詳細 → 安全ではないページに移動 → 許可）
 *     これで「1分ごとのトリガー」ができる
 *  4. ためしに checkToken を実行 → 実行ログに「OK」と出れば、つながっている
 * トークンは、このスクリプトのプロパティにだけ置く。日記やチャットには書かない。
 */
var REPO = 'haikunosusono/susono-bot';
/* 日本時間 hh:mm → どの入口を、どの入力でたたくか。時刻は GitHub の cron と同じ（内容・時刻は変えない） */
var TABLE = {
  // スマホ通知（はじまる15分前）
  '09:45': ['push.yml', { dry_run: '0' }], '12:45': ['push.yml', { dry_run: '0' }], '14:45': ['push.yml', { dry_run: '0' }],
  '20:45': ['push.yml', { dry_run: '0' }], '22:45': ['push.yml', { dry_run: '0' }], '00:45': ['push.yml', { dry_run: '0' }],
  // つぶやき
  '07:00': ['tweet.yml', { dry_run: '0', kind: 'auto' }],
  '09:00': ['tweet.yml', { dry_run: '0', kind: 'auto' }], '12:00': ['tweet.yml', { dry_run: '0', kind: 'auto' }], '14:00': ['tweet.yml', { dry_run: '0', kind: 'auto' }],
  '20:00': ['tweet.yml', { dry_run: '0', kind: 'auto' }], '22:00': ['tweet.yml', { dry_run: '0', kind: 'auto' }], '00:00': ['tweet.yml', { dry_run: '0', kind: 'auto' }],
  '10:00': ['tweet.yml', { dry_run: '0', kind: 'auto' }], '13:00': ['tweet.yml', { dry_run: '0', kind: 'auto' }], '15:00': ['tweet.yml', { dry_run: '0', kind: 'auto' }],
  '21:00': ['tweet.yml', { dry_run: '0', kind: 'auto' }], '23:00': ['tweet.yml', { dry_run: '0', kind: 'auto' }], '01:00': ['tweet.yml', { dry_run: '0', kind: 'auto' }],
  '21:10': ['tweet.yml', { dry_run: '0', kind: 'auto' }],
  '11:30': ['tweet.yml', { dry_run: '0', kind: 'auto' }], '14:30': ['tweet.yml', { dry_run: '0', kind: 'auto' }], '16:30': ['tweet.yml', { dry_run: '0', kind: 'auto' }],
  '22:30': ['tweet.yml', { dry_run: '0', kind: 'auto' }], '00:30': ['tweet.yml', { dry_run: '0', kind: 'auto' }], '02:30': ['tweet.yml', { dry_run: '0', kind: 'auto' }]
};
function jstNow() { return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm'); }
/* 1分ごとに呼ばれる。その分に予定があれば、1回だけたたく（同じ分に2回呼ばれても、プロパティで防ぐ） */
function tick() {
  var now = jstNow(), hm = now.slice(11), key = 'done-' + now;
  var job = TABLE[hm]; if (!job) return;
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(key)) return;
  props.setProperty(key, '1');
  dispatch(job[0], job[1], now);
  cleanup(props);
}
function dispatch(file, inputs, label) {
  var token = PropertiesService.getScriptProperties().getProperty('GH_TOKEN');
  if (!token) { console.log('GH_TOKEN がありません'); return; }
  var res = UrlFetchApp.fetch('https://api.github.com/repos/' + REPO + '/actions/workflows/' + file + '/dispatches', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    payload: JSON.stringify({ ref: 'main', inputs: inputs })
  });
  var code = res.getResponseCode();
  console.log((label || '') + ' ' + file + ' → ' + code + (code === 204 ? ' OK' : ' ' + res.getContentText().slice(0, 200)));
  if (code !== 204) { Utilities.sleep(20000); var r2 = UrlFetchApp.fetch('https://api.github.com/repos/' + REPO + '/actions/workflows/' + file + '/dispatches', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }, payload: JSON.stringify({ ref: 'main', inputs: inputs }) }); console.log('もう一度 → ' + r2.getResponseCode()); }
}
/* 古い「done-」の印を消す（残しすぎないように） */
function cleanup(props) {
  var all = props.getProperties(), keys = Object.keys(all).filter(function (k) { return k.indexOf('done-') === 0; });
  if (keys.length < 200) return;
  keys.sort(); keys.slice(0, keys.length - 100).forEach(function (k) { props.deleteProperty(k); });
}
/* はじめに1回だけ実行：1分ごとのトリガーを作る（すでにあれば作り直す） */
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'tick') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('tick').timeBased().everyMinutes(1).create();
  console.log('1分ごとのトリガーを作りました。いまの日本時間: ' + jstNow());
}
/* つながりの確認：トークンでこの倉庫の情報が読めるか */
function checkToken() {
  var token = PropertiesService.getScriptProperties().getProperty('GH_TOKEN');
  if (!token) { console.log('GH_TOKEN がありません（プロジェクトの設定 → スクリプト プロパティ）'); return; }
  var res = UrlFetchApp.fetch('https://api.github.com/repos/' + REPO + '/actions/workflows', { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' } });
  console.log(res.getResponseCode() === 200 ? 'OK：GitHubにつながっています' : 'NG ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
}
/* ためしに1回だけ、通知を「見るだけ（dry）」でたたく */
function testPushDry() { dispatch('push.yml', { dry_run: '1' }, 'test'); }
