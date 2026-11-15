const pp=require('puppeteer-core'),fs=require('fs');
const LS={'ikku-first':String(Date.parse('2026-10-20')),'ikku-haigo':'裾野もみじ','ikku-tut':'1','ikku-f-tut':'1','ikku-g-tut':'1'};
const D10='2026-11-10T12:30:00+09:00', D18='2026-11-18T12:30:00+09:00';
const SHOTS=[
 {id:'home',js:"tab='solo';page='';render();1",txt:'今夜のすその句会',dy:-24},
 {id:'home2',js:"tab='solo';page='';render();1",txt:'一句どうぞ',dy:-24},
 {id:'teirei',js:"tab='gohyo';page='';roomOpen=true;render();1",sel:'#room-body'},
 {id:'flat',js:"tab='flat';page='';roomOpen=true;render();1",sel:'#room-body'},
 {id:'aikotoba',js:"tab='together';page='';roomOpen=true;render();1",sel:'#room-body'},
 {id:'monthly',js:"tab='monthly';page='';roomOpen=true;render();1",sel:'#room-body'},
 {id:'monthly2',js:"tab='monthly';page='';roomOpen=true;render();1",txt:'2026年11月の兼題',dy:-30},
 {id:'kintore',now:D18,js:"tab='solo';page='';roomOpen=true;render();1",sel:'#room-body',hide:'きょうのひとこと'},
 {id:'kintore2',now:D18,js:"tab='solo';page='';roomOpen=true;render();1",txt:'練習です',dy:-30},
 {id:'shoshin',js:"tab='diary';page='';roomOpen=true;render();1",sel:'#room-body'},
 {id:'tsuku',js:"tab='diary';page='';roomOpen=true;render();1",click:'[data-act="tk-start"]',sel:'.wrap',dy:0},
 {id:'tut',js:"tab='diary';page='';render();1",click:'[data-act="tut"]',full:1},
 {id:'stock',js:"page='stock';render();1",txt:'短冊で見る',dy:-70},
 {id:'stock-tate',js:"page='stock';render();1",click:'[data-act="st-view"]',txt:'で見る',dy:-20},
 {id:'card1',js:"page='';tab='solo';roomOpen=true;render();1",click:'[data-act="card"]',full:1,into:'#cardimg'},
 {id:'card2',js:"page='';tab='solo';roomOpen=true;render();1",click:'[data-act="card"]',full:1,intoTxt:'色合い（紙の色）'},
 {id:'kigo',js:"page='kigo';render();1",sel:'.wrap',dy:40},
 {id:'kigo2',js:"page='kigo';render();1",sel:'.wrap',dy:760},
 {id:'kushu',js:"page='kushu';render();1",sel:'.wrap',dy:40},
 {id:'senku',js:"page='senku';render();1",sel:'.wrap',dy:40},
 {id:'senku2',js:"page='senku';render();1",sel:'.wrap',dy:800},
 {id:'my',js:"page='my';render();1",sel:'.wrap',dy:40},
 {id:'badge',js:"page='my';render();1",txt:'はじめの一歩',dy:-190},
 {id:'notify',js:"page='notify';render();1",sel:'.wrap',dy:40},
 {id:'faq',js:"page='faq';render();1",sel:'.wrap',dy:40},
 {id:'kata',js:"page='kata';render();1",sel:'.wrap',dy:40},
 {id:'gloss',js:"page='gloss';render();1",sel:'.wrap',dy:40},
 {id:'manner',js:"page='manner';render();1",sel:'.wrap',dy:40},
 {id:'renkan',js:"page='renkan';render();1",sel:'.wrap',dy:40},
 {id:'hyo',js:"page='hyo';render();1",sel:'.wrap',dy:40},
 {id:'trial',js:"page='';tab='solo';render();1",click:'[data-act="trial-start"]',sel:'.wrap',dy:0},
];
const only=process.argv[2]?process.argv[2].split(','):null;
(async()=>{ fs.mkdirSync('cap',{recursive:true});
 const b=await pp.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--hide-scrollbars'],headless:'new'});
 async function fresh(now){ const p=await b.newPage(); await p.setViewport({width:390,height:780,deviceScaleFactor:2});
  await p.evaluateOnNewDocument((t,ls)=>{const R=Date,off=t-R.now();window.Date=class extends R{constructor(...a){if(a.length)super(...a);else super(R.now()+off);}static now(){return R.now()+off;}};try{Object.keys(ls).forEach(k=>localStorage.setItem(k,ls[k]));}catch(e){}},Date.parse(now),LS);
  await p.goto('http://127.0.0.1:8765/appcopy/index.html',{waitUntil:'domcontentloaded'}); await new Promise(r=>setTimeout(r,1300));
  p.T=(c)=>p.evaluate((c)=>{const r=window.__T(c);return typeof r==='object'?JSON.stringify(r):r;},c); p.wait=(ms)=>new Promise(r=>setTimeout(r,ms)); return p; }
 const click=(p,q,n)=>p.evaluate((q,n)=>{const e=[...document.querySelectorAll(q)].filter(e=>e.getBoundingClientRect().width>0)[n||0]; if(e){e.click();return 1;}return 0;},q,n);
 for(const s of SHOTS){ if(only&&only.indexOf(s.id)<0) continue; const p=await fresh(s.now||D10); try{
  await p.T(s.js); await p.wait(350);
  if(s.click){ if(!await click(p,s.click)) console.log(s.id,'no click'); await p.wait(900); }
  if(s.hide){ await p.evaluate((t)=>{ const e=[...document.querySelectorAll('#app *')].find(x=>x.children.length===0&&(x.textContent||'').replace(/\s/g,'').indexOf(t)>=0); if(e){ let q=e; for(let i=0;i<4&&q.parentElement&&q.parentElement.id!=='room-body';i++){ if(/panel|card|box|deck/.test(q.className||'')) break; q=q.parentElement; } q.style.display='none'; } },s.hide); }
  if(s.full){ if(s.into||s.intoTxt) await p.evaluate((s)=>{ let e=s.into?document.querySelector(s.into):[...document.querySelectorAll('summary,b,p')].find(x=>(x.textContent||'').indexOf(s.intoTxt)>=0&&x.getBoundingClientRect().width>0); if(e) e.scrollIntoView({block:'start'}); },s); await p.wait(400); await p.screenshot({path:'cap/'+s.id+'.png'}); console.log(s.id,'vp'); }
  else { const r=await p.evaluate((s)=>{ let e=null; if(s.sel) e=document.querySelector(s.sel); else { e=[...document.querySelectorAll('#app *')].filter(x=>x.children.length===0||/^(BUTTON|H2|H3|B|SUMMARY|P)$/.test(x.tagName)).find(x=>(x.textContent||'').replace(/\s/g,'').indexOf(s.txt)>=0); } if(!e) return null; const q=e.getBoundingClientRect(); return {y:q.top+window.scrollY,H:document.documentElement.scrollHeight}; },s);
   if(!r) console.log(s.id,'no anchor'); else { const y=Math.max(0,Math.min(r.y+(s.dy===undefined?-10:s.dy),r.H-780)); await p.screenshot({path:'cap/'+s.id+'.png',clip:{x:0,y:y,width:390,height:Math.min(780,r.H-y)}}); console.log(s.id,Math.round(y)); } }
 }catch(e){console.log(s.id,'ERR',String(e).slice(0,160));} await p.close(); }
 if(!only||only.indexOf('flow')>=0){ const p=await fresh(D10); const shot=async(n,y)=>{await p.wait(500); await p.screenshot({path:'cap/'+n+'.png',clip:{x:0,y:y||0,width:390,height:780}});};
  await p.T("tab='bot';page='';roomOpen=true;render();1"); await p.wait(300); await click(p,'[data-act="demo-start"]'); await p.wait(800); await p.type('#d-a','木枯や自転車の鍵つめたくて'); await shot('flow1',300);
  await click(p,'[data-act="demo-go"]'); await p.wait(1500); await click(p,'[data-act="demo-vote"][data-kind="toku"]',0); await p.wait(300); await click(p,'[data-act="demo-vote"][data-kind="nami"]',1); await shot('flow2',230);
  await click(p,'[data-act="demo-fin"]'); await p.wait(3500); await p.evaluate(()=>{document.querySelectorAll('.toast,#toast').forEach(e=>e.style.display='none');}); await shot('flow3',200); console.log('flow ok'); await p.close(); }
 await b.close();})();
