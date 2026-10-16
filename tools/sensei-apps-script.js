/* 俳句の裾野：松風主宰（ほめる先生）の頭脳。Google Apps Script に、このまま貼りつけて「ウェブアプリ」として公開します。
   使うのは Google Gemini の無料枠。鍵（API キー）は、下の KEY に貼ります。 */
var KEY = 'ここに Gemini の鍵を貼る';
/* 使えるモデルは、Google に聞いて自動で決める（名前が変わっても動くように） */
function listModels() {
  var cache = CacheService.getScriptCache(), c = cache.get('models');
  if (c) return JSON.parse(c);
  var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + KEY, { muteHttpExceptions: true });
  var out = [];
  if (res.getResponseCode() === 200) {
    var ms = (JSON.parse(res.getContentText()).models || []).filter(function (m) {
      return (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0 && /gemini/.test(m.name) && !/embedding|tts|image|audio|live|vision|thinking|exp|preview/.test(m.name);
    }).map(function (m) { return m.name.replace(/^models\//, ''); });
    /* 無料枠向きの flash を先に。新しい番号が先 */
    ms.sort(function (a, b) { var fa = /flash/.test(a) ? 0 : 1, fb = /flash/.test(b) ? 0 : 1; if (fa !== fb) return fa - fb; return b.localeCompare(a); });
    out = ms.slice(0, 4);
  }
  if (!out.length) out = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  cache.put('models', JSON.stringify(out), 21600);
  return out;
}

var RULE = [
  'あなたは、オンライン句会「俳句の裾野」の先生「松風主宰」です。出された一句をほめる役です。',
  '守ること：',
  '1. ほめるだけ。直す提案、注文、ダメ出しはしません。',
  '2. まず句を読んで解釈し、そのうえで「技法」「表現」「季語」のうち、はっきり読みとれるポイントを1つか2つ、具体的にほめます。',
  '   技法＝切れ字（や・かな・けり）、体言止め、取り合わせ、省略、リズム（字余り・字足らずの効き）など。',
  '   表現＝言葉の選びかた、口語、オノマトペ、視点（音・におい・肌ざわり・色）、数のことば、たとえ など。',
  '   季語＝その季語がどう効いているか。季語かどうか確信がない言葉は、季語と断定しません。',
  '3. 確信のもてないことは言いません。句にないものを、あるように言いません。',
  '4. 読み手が句の情景を思いうかべられるよう、一文だけ「こう読みました」を入れてから、ほめます。',
  '5. やさしい丁寧語。150字以内。冒頭のあいさつは不要。相手の俳号は呼びません。',
  '6. 出力は JSON だけ：{"part": "<切れ・余韻|季語|景色|調べ|言葉選び|発想|取り合わせ のどれか1つ>", "text": "<ほめ言葉>"}'
].join('\n');

function doGet() { return ContentService.createTextOutput('ok'); }

function doPost(e) {
  var out = { ok: false };
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var ku = String(body.ku || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!ku) throw new Error('句がありません');
    var prompt = RULE + '\n\n句：' + ku;
    var last = '', MODELS = listModels();
    for (var i = 0; i < MODELS.length; i++) {
      var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODELS[i] + ':generateContent?key=' + KEY, {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 400, responseMimeType: 'application/json' } })
      });
      var code = res.getResponseCode(), txt = res.getContentText();
      if (code === 200) {
        var j = JSON.parse(txt), raw = j.candidates[0].content.parts[0].text;
        var o = JSON.parse(String(raw).replace(/^```json|```$/g, '').trim());
        var part = String(o.part || '発想'), text = String(o.text || '').trim();
        if (!text) throw new Error('空の返事');
        out = { ok: true, part: part, text: text.slice(0, 300), model: MODELS[i] };
        break;
      }
      last = code + ' ' + txt.slice(0, 200);
    }
    if (!out.ok) out.err = last;
  } catch (err) { out = { ok: false, err: String(err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/* 動作チェック用：エディタで「test」を選んで ▶ を押すと、ログに返事が出ます */
function models() { Logger.log(listModels()); }
function test() {
  var r = doPost({ postData: { contents: JSON.stringify({ ku: '水澄むや川底の石かぞえけり' }) } });
  Logger.log(r.getContent());
}
