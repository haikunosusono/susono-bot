const {open}=require('./lib.js'),fs=require('fs');
const SCREENS=[
 {id:'renshu-flow',title:'句会の練習｜ボットと、ひとりで句会',sub:'出す・選ぶ・語らうを、3分ほどで',ph:[['flow1','① 一句、出す'],['flow2','② 選ぶ（特選・並選）'],['flow3','③ 点と、ひとこと']]},
 {id:'kukai-3',title:'みんなで句会｜3つの集まりかた',sub:'時刻で集まる・ふらっと集まる・仲間で集まる',ph:[['teirei','定例句会（毎日）'],['flat','ふらっと句会'],['aikotoba','合言葉で句会']]},
 {id:'hajimete',title:'はじめての方へ｜まず、一句',sub:'チュートリアルと、句づくりのお手伝い',ph:[['tut','チュートリアル'],['tsuku','句づくり'],['shoshin','初心者部屋']]},
 {id:'stock-flow',title:'ストッ句｜ためて、短冊に',sub:'作った句は、いくつでも。あとから短冊の画像に',ph:[['stock','ためる'],['card1','短冊にする'],['card2','色合いをえらぶ']]},
 {id:'home',title:'ホーム｜きょうの句会が、ひと目で',sub:'',ph:[['home',''],['home2','']],lines:['今夜の句会まで','・あと何時間かが出ます','・そのまま参加できます','','月例句会','・兼題としめきり','','練習の部屋','・句会の練習','・俳筋力トレーニング']},
 {id:'kintore',title:'俳筋力トレーニング｜毎日の兼題',sub:'',ph:[['kintore',''],['kintore2','']],lines:['毎日ひとつ、お題','・漢字','・カタカナ','・テーマ詠','','手ごたえを残す','・かんぺき','・まあまあ','・あとで推敲','','記録は自分だけ']},
 {id:'monthly',title:'月例句会｜月に一度、ゆっくり',sub:'',ph:[['monthly',''],['monthly2','']],lines:['1日','・兼題の発表','15日まで','・投句（1〜3句）','25日まで','・互選','26日','・結果','','5句に満たない月は','流会（おやすみ）']},
 {id:'kigo',title:'季語をしらべる｜約5000の季語',sub:'',ph:[['kigo',''],['kigo2','']],lines:['さがしかた','・ことばで検索','・季節と分類から','・五音の季語集','','歳時記へのリンク','・きごさい歳時記','・季語辞典']},
 {id:'kushu-renkan',title:'句集づくり・連作｜句をまとめる',sub:'',ph:[['kushu','句集づくり'],['renkan','連作の部屋']],lines:['句集のかたち','・年・年度ごと','・自選十句（画像）','・note・ブログ用','・句帳に貼る紙片','','連作','・ストッ句をならべて','　ひとつの作品に']},
 {id:'senku',title:'選句の道具｜ほかの句会の選に',sub:'',ph:[['senku',''],['senku2','']],lines:['手もとの道具です','・句の一覧を貼る','・自句を外す','・予選→並選→特選','・選評をまとめる','','AIは使いません','端末の中だけに','残ります']},
 {id:'mypage',title:'マイページ｜記録とバッジ',sub:'',ph:[['my','マイ統計'],['badge','バッジ']],lines:['見られるもの','・句の数','・つづけた日数','・句会の参加','・トロフィー','','バッジ','・句をつくる','・つづける','・句会に出る','　たびに増えます']},
 {id:'okikata',title:'ホーム画面に置く・よくある質問',sub:'',ph:[['notify','ホーム画面に置く'],['faq','よくある質問']],lines:['アプリのように','・インストール不要','・ホーム画面に置けば','　ワンタップ','・句会の15分前に通知','','こまったら','・よくある質問','・お問い合わせ']},
 {id:'manabu',title:'学ぶ｜俳句の型と、用語集',sub:'',ph:[['kata','型と技の部屋'],['gloss','用語集']],lines:['型と技','・基本の型','・応用の型','・きょうの型','','用語集','・句会のことば','・俳句のことば','・ことばで検索']},
 {id:'manner',title:'句のあつかい｜ここは練習の場',sub:'',ph:[['manner','']],lines:['ここで作った句は','「未発表」のあつかい','','・記録は自分だけ','・句会の句は、参加した人に','・ほかの人の句や選評の','　無断公開は、きんし','','大会に出すときは','募集要項を確かめて']},
];
(async()=>{const {b,p}=await open({});
 await p.addScriptTag({path:__dirname+'/page.js'});
 for(const s of SCREENS){
  const d=await p.evaluate(async(s)=>{ const G=window.G; await document.fonts.ready; const list=[]; for(const a of s.ph){ list.push({img:await G.img('../cap/'+a[0]+'.png'),cap:a[1]}); } return G.jpg(G.phones(s.title,s.sub,list,s.lines),0.88); },s);
  fs.writeFileSync('out/parts/'+s.id+'.jpg',Buffer.from(d.split(',')[1],'base64')); console.log(s.id,fs.statSync('out/parts/'+s.id+'.jpg').size);
 }
 await b.close();})().catch(e=>{console.error(String(e&&e.message||e).slice(0,500));process.exit(1);});
