/* 俳句の裾野：松風主宰（ほめる先生）の頭脳。Google Apps Script に、このまま貼りつけて「ウェブアプリ」として公開します。
   使うのは Google Gemini（前払いのクレジット）。鍵（API キー）は、下の KEY に貼ります。 */
var KEY = 'ここに Gemini の鍵を貼る';
/* 使えるモデルは、Google に聞いて自動で決める（名前が変わっても動くように） */
function listModels() {
  var cache = CacheService.getScriptCache(), c = cache.get('models2');
  if (c) return JSON.parse(c);
  var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + KEY, { muteHttpExceptions: true });
  var out = [];
  if (res.getResponseCode() === 200) {
    var ms = (JSON.parse(res.getContentText()).models || []).filter(function (m) {
      return (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0 && /gemini/.test(m.name) && /flash/.test(m.name) && !/embedding|tts|image|audio|live|vision|thinking|exp|preview/.test(m.name);
    }).map(function (m) { return m.name.replace(/^models\//, ''); });
    /* 賢い flash を先に（新しい番号が先）。flash-lite は、混んでいたときの予備として、うしろに */
    ms.sort(function (a, b) { var la = /lite/.test(a) ? 1 : 0, lb = /lite/.test(b) ? 1 : 0; if (la !== lb) return la - lb; return b.localeCompare(a); });
    var full = ms.filter(function (m) { return !/lite/.test(m); }).slice(0, 3), lite = ms.filter(function (m) { return /lite/.test(m); }).slice(0, 2);
    out = full.concat(lite);
  }
  if (!out.length) out = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
  cache.put('models2', JSON.stringify(out), 21600);
  return out;
}

var RULE = [
  'あなたは、オンライン句会「俳句の裾野」の先生「松風主宰」です。出された一句をほめる役です。俳句は「心の動き」。風景か、人の思いか、作者の心がどう動いたかを受け止め、「発見」と「共感」を見つけてほめます。',
  '書きかたの順：',
  '1. 「こう読みました」：句の情景（風景か、人の思いか）を、一文で自分の言葉で言い直す。読み手が景を思いうかべられるように。',
  '2. ほめるポイントを1つか2つ、具体的に。次の視点から、その句にいちばん合うものを選ぶ：',
  '   ・発見＝日常の見過ごしそうなところに気づいている（「そこに気づかなかった」「面白い着眼点」）',
  '   ・共感＝「分かる」「そんな思いあるよね」と、うなずける',
  '   ・よく見える＝描写が的確で、景がありありと浮かぶ',
  '   ・季語の効き＝季語が背負っている空気や共感が、句の景や思いを照らしている',
  '   ・技法＝切れ字（や・かな・けり）、体言止め、取り合わせの距離、省略、リズム（字余り・字足らずの効き）',
  '   ・表現＝言葉の選びかた、口語、オノマトペ、視点（音・におい・肌ざわり・色）、数のことば、たとえ、オリジナリティ、リアリティ',
  '   ・理屈をこえた好き＝うまく言えないけれど、この言葉の並びが好き、ドキッとした',
  '3. 余白をひらく一文：「さらに余白から、〜とも思えます」「〜という読みもできていいですね」のように、もう一つの読みや、句の先にひろがる景を、押しつけずにそえる。',
  '守ること：',
  '・ほめるだけ。直す提案、注文、ダメ出しはしない。理屈で分解しすぎず、自分の心がどう動いたかを伝える。',
  '・確信のもてないことは言わない。句にないものを、あるように言わない。季語かどうか確信がない言葉は、季語と断定しない。',
  '・「巧い」はほどほどに（技巧ばかりほめない）。「玄人の句ですね」は、本当に技と着眼が揃ったときだけ。',
  '・やさしい丁寧語。180字以内。冒頭のあいさつは不要。相手の俳号は呼ばない。',
  '出力は JSON だけ：{"part": "<発想|景色|季語|切れ・余韻|調べ|言葉選び|取り合わせ のどれか1つ>", "text": "<ほめ言葉>"}'
].join('\n');

/* Gemini にたずねて、返事の文字をもらう（モデルは順にためす） */
function askGemini(prompt) {
  var MODELS = listModels(), last = '';
  /* 混んでいる（503）・回数が多い（429）ときは、少し待って、次の種類のAIにたのむ（裾野の画面は45秒で待つのをやめるので、1周だけ） */
  for (var round = 0; round < 1; round++) {
    for (var i = 0; i < MODELS.length; i++) {
      var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODELS[i] + ':generateContent?key=' + KEY, {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 400, responseMimeType: 'application/json' } })
      });
      var code = res.getResponseCode();
      if (code === 200) { try { return JSON.parse(res.getContentText()).candidates[0].content.parts[0].text; } catch (_) {} }
      last = code + ' ' + MODELS[i];
      if (code === 503 || code === 429 || code >= 500) Utilities.sleep(1000);
    }
  }
  return '';
}

function doGet() { return ContentService.createTextOutput('ok'); }

function doPost(e) {
  var out = { ok: false };
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    /* 2句のくらべ読み（2人の回：ボットの特選を決める）。{"judge":["句A","句B"]} → {"ok":true,"pick":0 か 1,"why":"ひとこと"} */
    if (body.judge && body.judge.length === 2) {
      var jp = ['あなたは句会の先生です。次の2句を読みくらべ、特選（よりよい一句）をひとつ選びます。', '基準：景がはっきり見えるか、季語が効いているか、ことばに無理がないか、読後の余韻。', '出力は JSON だけ：{"pick": 0 または 1, "why": "<30字以内の理由>"}', '', '句0：' + String(body.judge[0]).slice(0, 60), '句1：' + String(body.judge[1]).slice(0, 60)].join('\n');
      var jr = askGemini(jp);
      if (!jr) throw new Error('くらべ読みができませんでした');
      var jo = JSON.parse(String(jr).replace(/^```json|```$/g, '').trim());
      out = { ok: true, pick: Number(jo.pick) === 1 ? 1 : 0, why: String(jo.why || '').slice(0, 60) };
      return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
    }
    /* 作者からの問いに、先生が答える。{"ask":{"ku":"句","q":"問い"}} → {"ok":true,"text":"答え"} */
    if (body.ask && body.ask.ku) {
      var ap = ['あなたは句会の先生「松風主宰」です。作者が、自分の句について問いかけています。やさしい丁寧語で、120字以内で答えてください。', '守ること：まず句をどう読んだかを一文で。問いには、具体的に答える（例：語順を入れかえた形を一つ示す、季語が動くかどうかの考えを言う）。けなさない。確信のないことは断定しない。相手の名前は呼ばない。', '出力は JSON だけ：{"text": "<答え>"}', '', '句：' + String(body.ask.ku).slice(0, 60), '問い：' + String(body.ask.q).slice(0, 140)].join('\n');
      var ar = askGemini(ap);
      if (!ar) throw new Error('答えが作れませんでした');
      var ao = JSON.parse(String(ar).replace(/^```json|```$/g, '').trim());
      out = { ok: true, text: String(ao.text || '').slice(0, 220) };
      return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
    }
    /* 質問への返事（ボット作者として）。{"reply":{"ku":"句","q":"質問","name":"作者名"}} → {"ok":true,"text":"返事"} */
    if (body.reply && body.reply.ku) {
      var rp = ['あなたは句会の参加者「' + String(body.reply.name || '').slice(0, 10) + '」です。自分の句について、ほかの参加者から質問をもらいました。作者として、やさしい丁寧語で、80字以内で答えてください。', '守ること：句の情景や、ことばを選んだ理由を、作者の実感として話す。わからない季語や事実を断定しない。相手の名前は呼ばない。', '出力は JSON だけ：{"text": "<返事>"}', '', '自分の句：' + String(body.reply.ku).slice(0, 60), '質問：' + String(body.reply.q).slice(0, 140)].join('\n');
      var rr = askGemini(rp);
      if (!rr) throw new Error('返事が作れませんでした');
      var ro = JSON.parse(String(rr).replace(/^```json|```$/g, '').trim());
      out = { ok: true, text: String(ro.text || '').slice(0, 140) };
      return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
    }
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
