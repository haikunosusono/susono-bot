const {open}=require('./lib.js'),fs=require('fs');
const save=(f,d)=>fs.writeFileSync(f,Buffer.from(d.split(',')[1],'base64'));
(async()=>{const {b,p}=await open({});
 await p.addScriptTag({path:__dirname+'/page.js'});
 const res=await p.evaluate(async()=>{
  const T=window.__T, drawCard=T('drawCard'), drawKuhi=T('drawKuhi'), drawTrophy=T('drawTrophy'), DEF=T('CARD_DEF'), TH=T('CARD_THEMES'), PT=T('CARD_PATTERNS'), FR=T('CARD_FRAMES'), MO=T('CARD_MOTIFS'), SS=T('SEAL_SHAPES'), WF=T('WEB_FONTS'), SC=T('KUHI_SCENES'), ST=T('KUHI_STONES'), SH=T('KUHI_SHAPES'), MOSS=T('KUHI_MOSS'), kp=T('kuhiPref'), MEIKU=T('MEIKU'), hash=T('hash');
  const PD=['松尾芭蕉','与謝蕪村','小林一茶','正岡子規','夏目漱石','加賀千代女','向井去来','野沢凡兆','宝井其角','服部嵐雪'];
  const all=[]; Object.keys(MEIKU).forEach(s=>MEIKU[s].forEach(x=>{ if(PD.indexOf(x[1])>=0 && !/[《》｜（）()\s]/.test(x[0]) && x[0].length<=18) all.push({s:s,ku:x[0],by:x[1],src:x[2]||''}); }));
  const find=(sub,by)=>all.find(x=>x.ku.indexOf(sub)>=0)||all.find(x=>x.by===by);
  await document.fonts.ready;
  const fidx=(n)=>WF.findIndex(x=>x.n===n);
  async function fontReady(i,text){ try{ const fam=(WF[i].f.match(/"([^"]+)"/)||[])[1]; if(fam && WF[i].g) await document.fonts.load('600 60px "'+fam+'"', text+'俳句の裾野'); }catch(e){} }
  const card=async(k,P)=>{ P=Object.assign({},DEF,P||{}); await fontReady(P.font||0,k.ku+k.by); return drawCard({text:k.ku,haigo:k.by},P); };
  const kuhi=async(k,pref,plaque)=>{ Object.assign(kp,{sc:null,st:null,sh:null,moss:null,f:null},pref||{}); if(kp.f!=null) await fontReady(kp.f,k.ku+k.by); const cv=drawKuhi({text:k.ku,haigo:k.by,plaque:plaque||['名句の見本']}); Object.assign(kp,{sc:null,st:null,sh:null,moss:null,f:null}); return cv; };
  const thId=(n)=>TH.find(x=>x[1]===n)[0], id=(A,n)=>A.find(x=>x[1].indexOf(n)===0)[0];
  const out={parts:{},meiku:{},pick:{}};
  const G=window.G;
  const kA=find('法隆寺','正岡子規'), kB=find('菜の花や','与謝蕪村'), kC=find('古池や','松尾芭蕉'), kD=find('名月を','小林一茶')||find('名月','小林一茶'), kE=find('朝顔に','加賀千代女'), kF=find('荒海や','松尾芭蕉'), kG=find('雪とけて','小林一茶'), kH=find('春の海','与謝蕪村'), kI=find('いくたびも','正岡子規')||find('雪','正岡子規'), kJ=find('閑さや','松尾芭蕉'), kK=find('五月雨','松尾芭蕉'), kL=find('やせ蛙','小林一茶');
  out.pick={kA,kB,kC,kD,kE,kF,kG,kH,kI,kJ,kK,kL};
  const g4=async(pid,title,sub,k,list,mk)=>{ const tiles=[]; for(const it of list){ tiles.push({cv:await mk(it),label:it.label}); } out.parts[pid]=G.jpg(G.grid4(title,sub+'　句：'+k.by,tiles)); };
  await g4('tanzaku-iro1','短冊｜色合いをえらぶ','同じ句でも、紙の色でこんなにちがいます',kA,['墨','紙','藍','桜'].map(n=>({label:n,P:{theme:thId(n)}})),it=>card(kA,it.P));
  await g4('tanzaku-iro2','短冊｜色合いは38種','きょうの気分で、えらべます',kB,['抹茶','山吹','瑠璃','紅'].map(n=>({label:n,P:{theme:thId(n)}})),it=>card(kB,it.P));
  await g4('tanzaku-kisetsu','短冊｜季節の限定紙','春夏秋冬の、とくべつな紙',kC,['花吹雪','七夕','紅葉狩','雪景色'].map(n=>({label:n,P:{theme:thId(n)}})),it=>card(kC,it.P));
  await g4('tanzaku-moyo1','短冊｜模様をえらぶ','模様は15種。まずは4つ',kD,[['霞','kami'],['金箔ちらし','sumi'],['青海波','ai'],['星空','yozora']].map(a=>({label:a[0],P:{pattern:id(PT,a[0]),theme:TH.find(x=>x[0]===a[1])?a[1]:thId('夜空')}})),it=>card(kD,it.P));
  await g4('tanzaku-moyo2','短冊｜季節の模様','紅葉・雪・竹・月',kE,[['紅葉ちらし','紙'],['雪','藍'],['竹','抹茶'],['月','夜空']].map(a=>({label:a[0],P:{pattern:id(PT,a[0]),theme:thId(a[1])}})),it=>card(kE,it.P));
  await g4('tanzaku-waku','短冊｜枠をえらぶ','枠は7種。ふちどりで、ぐっと変わります',kF,['二重線','金縁','和紙のふち','短冊のかたち'].map(n=>({label:n,P:{frame:id(FR,n),theme:thId('紙')}})),it=>card(kF,it.P));
  await g4('tanzaku-kazari','短冊｜飾りをそえる','猫、月とすすき、雪だるま、富士…',kG,[['猫','紙'],['秋','柿渋'],['冬','空'],['富士','生成り']].map(a=>({label:MO.find(x=>x[1].indexOf(a[0])===0)[1],P:{motif:id(MO,a[0]),theme:thId(a[1])}})),it=>card(kG,it.P));
  await g4('tanzaku-shotai1','短冊｜書体をえらぶ','書体は44種。字のかたちで、句の表情が変わります',kH,['しっぽり明朝','教科書体','筆文字','丸ゴシック'].map(n=>({label:n,P:{font:fidx(n),theme:thId('紙')}})),it=>card(kH,it.P));
  await g4('tanzaku-shotai2','短冊｜筆やポップな書体も','太い筆、手書き、飾り明朝、ポップ',kJ,['太い筆','手書き','飾り明朝','はちまるポップ'].map(n=>({label:n,P:{font:fidx(n),theme:thId('生成り')}})),it=>card(kJ,it.P));
  await g4('tanzaku-rakkan','短冊｜落款（はんこ）','かたち5種。文字と色も、えらべます',kK,[['角（白文）','#b8402f','裾'],['角（朱文）','#9b1b30','句'],['丸（白文）','#2d3a6b','月'],['縦長','#2f6b4a','俳']].map(a=>({label:a[0],P:{sealShape:SS.find(x=>x[1]===a[0])[0],sealCol:a[1],seal:a[2],theme:thId('紙')}})),it=>card(kK,it.P));
  const sc=(n)=>SC.findIndex(x=>x.n===n);
  await g4('kuhi-basho1','句碑｜場所をえらぶ','句碑を建てる場所は14か所',kF,['野原','川べり','海辺','神社の杜'].map(n=>({label:n,pref:{sc:sc(n),st:0,sh:0,moss:0}})),it=>kuhi(kF,it.pref));
  await g4('kuhi-basho2','句碑｜季節や時刻の景色','雪景色、夕暮れ、月夜、紅葉のころ',kD,['雪景色','夕暮れ','月夜','紅葉のころ'].map(n=>({label:n,pref:{sc:sc(n),st:1,sh:0,moss:0}})),it=>kuhi(kD,it.pref));
  await g4('kuhi-ishi','句碑｜石をえらぶ','石は8種。色と肌ざわりが、ちがいます',kC,['灰の自然石','黒御影','白御影','赤御影'].map(n=>({label:n,pref:{sc:sc('公園'),st:ST.findIndex(x=>x.n===n),sh:0,moss:0}})),it=>kuhi(kC,it.pref));
  await g4('kuhi-katachi','句碑｜かたちをえらぶ','かたちは6種',kJ,['自然石','丸い石','板碑（とがり）','横長の石'].map(n=>({label:n,pref:{sc:sc('お寺の庭'),st:0,sh:SH.findIndex(x=>x.n===n),moss:0}})),it=>kuhi(kJ,it.pref));
  await g4('kuhi-koke','句碑｜苔のぐあい','年月をへた句碑に、育てられます',kL,MOSS.map((n,i)=>({label:n,pref:{sc:sc('神社の杜'),st:0,sh:0,moss:i}})),it=>kuhi(kL,it.pref));
  out.parts['kuhi-meiban']=G.jpg(G.one('句碑｜優勝すると、句碑が建ちます','写真は、名句で作った見本です　句：'+kA.by,await kuhi(kA,{sc:sc('紅葉のころ'),st:1,sh:0,moss:1},['優勝記念','すその句会','特選2・並選1']),['銘板つき','・優勝記念','・どの句会か','・成績','','えらべるもの','・場所 14','・石 8','・かたち 6','・苔 4','・書体 12']));
  out.parts['trophy']=G.jpg(G.one('トロフィー｜優勝のしるし','写真は、名句で作った見本です　句：'+kB.by,drawTrophy({text:kB.ku,haigo:kB.by,head:'すその句会',res:'特選2・並選1'}),['句会で','いちばんの点','をとると…','','・トロフィー','・句碑','・マイページ','　に残ります']));
  /* お礼・結果のつぶやき用：名句の句碑・短冊（季節ごとに20枚） */
  const SCN={haru:['野原','山のふもと','川べり','神社の杜','公園','桜のころ'],natsu:['野原','山のふもと','川べり','海辺','神社の杜','橋のたもと','雨の日'],aki:['野原','山のふもと','お寺の庭','橋のたもと','夕暮れ','月夜','紅葉のころ'],fuyu:['山のふもと','お寺の庭','雪景色','夕暮れ','月夜','神社の杜']};
  const THS={haru:['桜','若草','花吹雪','紙','桃'],natsu:['空','藍','浅葱','七夕','水'],aki:['柿渋','紅葉狩','月見','茶','山吹'],fuyu:['雪景色','墨','鼠','白','藍']};
  const KF=['しっぽり明朝','教科書体','筆文字','太い筆','古風な明朝','ひな明朝','手書き','丸ゴシック','飾り明朝'].map(fidx).filter(i=>i>0&&i<12);
  const pick2=(arr,h)=>{ const i=h%arr.length; let j=Math.floor(h/arr.length)%(arr.length-1); if(j>=i) j++; return [arr[i],arr[j]]; };
  for(const s of ['haru','natsu','aki','fuyu']){
   const pool=all.filter(x=>x.s===s).sort((a,b)=>hash(a.ku)-hash(b.ku)), cnt={}, sel=[];
   for(const x of pool){ if((cnt[x.by]||0)>=5) continue; cnt[x.by]=(cnt[x.by]||0)+1; sel.push(x); if(sel.length>=20) break; }
   out.meiku[s]=[];
   for(let i=0;i<sel.length;i++){ const k=sel[i], h=hash(k.ku+'m'), h2=Math.floor(h/97), scs=SCN[s].map(sc), base={sc:scs[h%scs.length],st:h2%8,sh:Math.floor(h2/8)%6,moss:Math.floor(h2/64)%2,f:null};
    let A,B,what;
    const mode=i%5;
    if(mode===0){ const q=pick2(scs,h2); what='場所ちがい'; A={pref:Object.assign({},base,{sc:q[0]}),label:'場所：'+SC[q[0]].n}; B={pref:Object.assign({},base,{sc:q[1]}),label:'場所：'+SC[q[1]].n}; }
    else if(mode===1){ const q=pick2([0,1,2,3,4,5,6,7],h2); what='石ちがい'; A={pref:Object.assign({},base,{st:q[0]}),label:'石：'+ST[q[0]].n}; B={pref:Object.assign({},base,{st:q[1]}),label:'石：'+ST[q[1]].n}; }
    else if(mode===2){ const q=pick2([0,1,2,3,4,5],h2); what='かたちちがい'; A={pref:Object.assign({},base,{sh:q[0]}),label:'かたち：'+SH[q[0]].n}; B={pref:Object.assign({},base,{sh:q[1]}),label:'かたち：'+SH[q[1]].n}; }
    else if(mode===3){ const q=pick2(KF,h2); what='書体ちがい'; A={pref:Object.assign({},base,{f:q[0]}),label:'書体：'+WF[q[0]].n}; B={pref:Object.assign({},base,{f:q[1]}),label:'書体：'+WF[q[1]].n}; }
    else { what='苔のぐあい'; A={pref:Object.assign({},base,{moss:0}),label:MOSS[0]}; B={pref:Object.assign({},base,{moss:2+(h2%2)}),label:MOSS[2+(h2%2)]}; }
    A.cv=await kuhi(k,A.pref); B.cv=await kuhi(k,B.pref);
    const cv=G.pair('同じ句でも、'+what+'で、こんなに変わります','名句で作った見本です　'+k.ku+'　'+k.by,A,B);
    out.meiku[s].push({ku:k.ku,by:k.by,src:k.src,what:what,img:cv.toDataURL('image/jpeg',0.84)}); }
  }
  return out;
 });
 console.log(JSON.stringify(Object.fromEntries(Object.entries(res.pick).map(([k,v])=>[k,v&&v.ku+'/'+v.by]))));
 let tot=0; for(const k in res.parts){ save('out/parts/'+k+'.jpg',res.parts[k]); tot+=fs.statSync('out/parts/'+k+'.jpg').size; }
 const mj={}; for(const s in res.meiku){ mj[s]=res.meiku[s].map((x,i)=>{const f=s+'-'+String(i+1).padStart(2,'0')+'.jpg'; save('out/meiku/'+f,x.img); tot+=fs.statSync('out/meiku/'+f).size; return {f:f,ku:x.ku,by:x.by,src:x.src,what:x.what};}); }
 fs.writeFileSync('out/meiku.json',JSON.stringify(mj,null,1));
 console.log('parts',Object.keys(res.parts).length,'meiku',Object.values(mj).map(a=>a.length).join(','),'bytes',tot);
 await b.close();})().catch(e=>{console.error(String(e&&e.message||e).slice(0,600));process.exit(1);});
