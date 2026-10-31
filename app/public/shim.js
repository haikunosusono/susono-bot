/* Firebase 版の土台。アプリ本体は window.claude.use(名前) で保存先などを受け取るので、
   ここで同じ形のものを Firebase から用意する。 */
(function () {
  'use strict';
  if (!window.firebase || !window.FIREBASE_CONFIG) return;
  firebase.initializeApp(window.FIREBASE_CONFIG);
  var auth = firebase.auth(), fs = firebase.firestore();
  /* update() は、入れ子のオブジェクトを「深い merge」にそろえる（本体がそのつもりで書いている） */
  (function () {
    function plain(v) { return v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype; }
    function flat(obj, pre, out) {
      Object.keys(obj).forEach(function (k) {
        var v = obj[k], key = pre ? pre + '.' + k : k;
        if (plain(v) && Object.keys(v).length) flat(v, key, out); else out[key] = v;
      });
      return out;
    }
    var DR = firebase.firestore.DocumentReference && firebase.firestore.DocumentReference.prototype;
    if (!DR) return;
    var orig = DR.update;
    DR.update = function (data) {
      if (arguments.length === 1 && plain(data)) { var f = flat(data, '', {}); if (!Object.keys(f).length) return Promise.resolve(); return orig.call(this, f); }
      return orig.apply(this, arguments);
    };
  })();
  try { auth.languageCode = 'ja'; } catch (e) {}

  /* ---- ログイン画面 ---- */
  var css = '#fb-gate{position:fixed;inset:0;z-index:9999;background:var(--bg,#eef0ec);color:var(--ink,#1c2230);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 16px;font-family:var(--sans,sans-serif)}' +
    '#fb-gate .card{background:var(--paper,#fafaf7);border:1px solid var(--line,#d3d8d2);border-radius:14px;padding:22px 18px;max-width:420px;width:100%;margin-top:4vh}' +
    '#fb-gate h1{font-family:var(--serif,serif);font-size:1.5rem;margin:0 0 2px}#fb-gate .fb-tag{color:var(--ink-soft,#4b5565);font-size:.85rem;margin:0 0 16px}' +
    '#fb-gate label{display:block;font-size:.85rem;color:var(--ink-soft,#4b5565);margin:10px 0 4px}' +
    '#fb-gate input{width:100%;box-sizing:border-box;font:inherit;font-size:1rem;padding:10px 12px;border:1px solid var(--line,#d3d8d2);border-radius:10px;background:var(--paper,#fff);color:inherit}' +
    '#fb-gate .btn{display:block;width:100%;box-sizing:border-box;font:inherit;font-size:1rem;font-weight:700;padding:12px;border-radius:10px;border:0;margin-top:14px;background:var(--accent,#2a7a6a);color:var(--accent-ink,#fff);cursor:pointer}' +
    '#fb-gate .btn[disabled]{opacity:.55;cursor:default}' +
    '#fb-gate .btn.xb{background:#000;color:#fff}#fb-gate .or{text-align:center;color:var(--ink-soft,#4b5565);font-size:.8rem;margin:14px 0 0}' +
    '#fb-gate .lnk{background:none;border:0;font:inherit;color:var(--accent,#2a7a6a);text-decoration:underline;cursor:pointer;padding:0}' +
    '#fb-gate .row{display:flex;flex-wrap:wrap;gap:6px 16px;justify-content:center;margin-top:14px;font-size:.9rem}' +
    '#fb-gate .msg{margin:10px 0 0;font-size:.9rem;min-height:1.3em}#fb-gate .msg.err{color:var(--warn,#8f5a0c)}' +
    '#fb-gate .note{font-size:.8rem;color:var(--ink-soft,#4b5565);margin:14px 0 0;line-height:1.6}' +
    '#fb-gate .inv{color:var(--ink-soft,#4b5565);font-size:.85rem;text-align:center;margin:12px 0 0;white-space:pre-line}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var mode = 'login', gate = null, busy = false, pendingUser = [];
  function msgFor(e) {
    var c = (e && e.code) || '';
    if (/invalid-email/.test(c)) return 'メールアドレスの形がちがうようです';
    if (/user-not-found|invalid-credential|wrong-password|invalid-login/.test(c)) return 'メールアドレスかパスワードがちがいます。はじめての方は「新しく登録」からどうぞ';
    if (/email-already-in-use/.test(c)) return 'このメールアドレスは登録ずみです。「ログイン」からどうぞ';
    if (/weak-password/.test(c)) return 'パスワードは6文字以上にしてください';
    if (/too-many-requests/.test(c)) return 'しばらく時間をおいてから、もう一度ためしてください';
    if (/network/.test(c)) return 'ネットにつながっていないようです';
    if (/operation-not-allowed/.test(c)) return 'Xでのログインは、いま準備中です。メールアドレスでどうぞ';
    if (/popup-closed|cancelled-popup/.test(c)) return 'Xのログインを、とちゅうでやめました';
    if (/account-exists-with-different-credential/.test(c)) return 'このXアカウントのメールアドレスは、裾野に登録ずみです。メールアドレスでログインしてから、マイページで「Xをつなぐ」を押してください';
    if (/credential-already-in-use/.test(c)) return 'このXアカウントは、べつの裾野のアカウントで使われています';
    if (/provider-already-linked/.test(c)) return 'Xは、もうつながっています';
    return 'うまくいきませんでした（' + (c || (e && e.message) || '不明') + '）';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function drawGate() {
    if (!gate) { gate = document.createElement('div'); gate.id = 'fb-gate'; document.body.appendChild(gate); }
    var email = (gate.querySelector('#fb-email') || {}).value || '';
    var h = '<div class="card"><h1>俳句の<ruby>裾野<rt>すその</rt></ruby></h1><p class="fb-tag">俳句の筋力トレーニング ・ みんなの句会広場</p>';
    if (mode !== 'reset') h += '<p class="note" style="margin:0 0 10px">🍂 俳句を持ちよって、みんなで詠み合う広場です。毎晩21:00の「みんなで句会」、ボットとあそぶ「ひとりで句会」、フレーズと季語でつくる「句づくり」。はじめてでも、チュートリアルつきで安心です。</p>';
    if (mode === 'reset') {
      h += '<p class="note" style="margin:0 0 6px">登録したメールアドレスに、パスワードを決めなおすための案内を送ります。</p>' +
        '<label for="fb-email">メールアドレス</label><input type="email" id="fb-email" autocomplete="email" value="' + esc(email) + '">' +
        '<button class="btn" data-go="reset">案内メールを送る</button>' +
        '<div class="row"><button class="lnk" data-mode="login">ログインにもどる</button></div>';
    } else {
      var signup = mode === 'signup';
      h += '<button class="btn xb" data-go="x">𝕏 Xのアカウントで' + (signup ? 'はじめる' : 'ログイン') + '</button><p class="or">― または、メールアドレスで ―</p>' +
        '<label for="fb-email">メールアドレス</label><input type="email" id="fb-email" autocomplete="email" inputmode="email" value="' + esc(email) + '">' +
        '<label for="fb-pass">パスワード' + (signup ? '（6文字以上。自分で決めます）' : '') + '</label><input type="password" id="fb-pass" autocomplete="' + (signup ? 'new-password' : 'current-password') + '">' +
        '<button class="btn" data-go="' + (signup ? 'signup' : 'login') + '">' + (signup ? '登録してはじめる' : 'ログイン') + '</button>' +
        '<div class="row">' + (signup ? '<button class="lnk" data-mode="login">登録ずみの方はログイン</button>' : '<button class="lnk" data-mode="signup">はじめての方は新しく登録</button><button class="lnk" data-mode="reset">パスワードを忘れた</button>') + '</div>';
      if (signup) h += '<p class="note">メールアドレスは、ログインにだけ使います。句会でほかの人に見えるのは、あとで決める「俳号」だけです。ここは俳句の練習の場です。ほかの人の句は、本人の了解なしに、SNSにのせたり、大会などに投句したりしないでください。</p>';
    }
    h += '<p class="msg" id="fb-msg"></p>';
    if (mode !== 'reset') h += '<div class="row"><button class="lnk" data-skip="1">登録せずに、まずは見てみる（体験句会・チュートリアル）</button></div>';
    h += '<p class="inv">登録はメールアドレスだけ・無料です。\n困ったときは、さそってくれた人に聞いてください。</p></div>';
    gate.innerHTML = h;
    var f = gate.querySelector('#fb-email'); if (f && !email) setTimeout(function () { try { f.focus(); } catch (e) {} }, 50);
  }
  function say(t, err) { var m = gate && gate.querySelector('#fb-msg'); if (m) { m.textContent = t; m.className = 'msg' + (err ? ' err' : ''); } }
  function setBusy(b) { busy = b; if (gate) Array.prototype.forEach.call(gate.querySelectorAll('.btn'), function (x) { x.disabled = b; }); }
  /* Xでログイン：ふつうはポップアップ。ひらけない（スマホのホーム画面アプリなど）ときは、画面ごと移動する */
  function xProvider() { return new firebase.auth.TwitterAuthProvider(); }
  function xSignIn() {
    return auth.signInWithPopup(xProvider()).catch(function (e) {
      if (/popup-blocked|operation-not-supported|web-storage-unsupported/.test((e && e.code) || '')) return auth.signInWithRedirect(xProvider());
      throw e;
    });
  }
  try { auth.getRedirectResult().catch(function (e) { setTimeout(function () { say(msgFor(e), true); }, 300); }); } catch (e) {}
  /* マイページから：いまのアカウント（メール）に、Xもつなぐ。どちらでログインしても、同じ記録になる */
  window.fbHasX = function () { var u = auth.currentUser; return !!(u && (u.providerData || []).some(function (p) { return p && p.providerId === 'twitter.com'; })); };
  window.fbHasMail = function () { var u = auth.currentUser; return !!(u && (u.providerData || []).some(function (p) { return p && p.providerId === 'password'; })); };
  window.fbLinkX = function () {
    var u = auth.currentUser; if (!u) return Promise.reject({ code: 'no-user' });
    return u.linkWithPopup(xProvider()).catch(function (e) { e.msg = msgFor(e); throw e; });
  };
  document.addEventListener('click', function (ev) {
    if (!gate || !gate.contains(ev.target)) return;
    var t = ev.target.closest('[data-mode],[data-go],[data-skip]'); if (!t) return;
    if (t.dataset.skip) { if (gate) { gate.remove(); gate = null; } return; }
    if (t.dataset.mode) { mode = t.dataset.mode; drawGate(); return; }
    if (busy) return;
    if (t.dataset.go === 'x') { setBusy(true); say('Xの画面をひらきます…'); xSignIn().catch(function (e) { say(msgFor(e), true); }).then(function () { setBusy(false); }); return; }
    var email = String((gate.querySelector('#fb-email') || {}).value || '').trim();
    var pw = String((gate.querySelector('#fb-pass') || {}).value || '');
    if (!email) { say('メールアドレスを入れてください', true); return; }
    var go = t.dataset.go, p;
    setBusy(true); say('…');
    if (go === 'reset') p = auth.sendPasswordResetEmail(email).then(function () { say('送りました。メールの案内にそって、パスワードを決めなおしてください'); });
    else if (!pw) { setBusy(false); say('パスワードを入れてください', true); return; }
    else if (go === 'signup') p = auth.createUserWithEmailAndPassword(email, pw);
    else p = auth.signInWithEmailAndPassword(email, pw);
    p.catch(function (e) { say(msgFor(e), true); }).then(function () { setBusy(false); });
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' || !gate || !gate.contains(ev.target)) return;
    var b = gate.querySelector('.btn'); if (b) { ev.preventDefault(); b.click(); }
  });

  var uid = null, authKnown = false, guest = false;
  auth.onAuthStateChanged(function (u) {
    authKnown = true;
    uid = u ? u.uid : null; window.fbUserEmail = u ? (u.email || '') : '';
    if (u) {
      if (gate) { gate.remove(); gate = null; }
      if (guest) { location.reload(); return; } /* 見学モードから登録・ログインしたら、あらためて読みこむ */
      pendingUser.splice(0).forEach(function (r) { r(); }); stopPresence(); startPresence();
    }
    else { stopPresence(); drawGate(); pendingUser.splice(0).forEach(function (r) { r(); }); }
  });
  /* 本体の「登録してはじめる」ボタンから、扉をもう一度ひらく */
  window.fbShowGate = function () { mode = 'signup'; drawGate(); };
  window.fbLogout = function () { stopPresence(true); auth.signOut().then(function () { location.reload(); }); };

  /* ---- だれがひらいているか（presence） ---- */
  var presTimer = null, presUnsub = null, peerFns = [], known = null;
  function presRef() { return fs.collection('presence').doc(uid); }
  function beat() { if (!uid) return; presRef().set({ at: Date.now() }).catch(function () {}); }
  function startPresence() {
    if (!uid || presTimer) return;
    beat(); presTimer = setInterval(beat, 45000);
    presUnsub = fs.collection('presence').onSnapshot(function (s) {
      var now = Date.now(), ids = [];
      s.docs.forEach(function (d) { var o = d.data() || {}; if (now - (o.at || 0) < 120000) ids.push(d.id); });
      if (ids.indexOf(uid) < 0) ids.push(uid);
      var joined = known ? ids.filter(function (i) { return known.indexOf(i) < 0; }) : [];
      known = ids;
      var ch = { peers: ids.map(function (i) { return { id: i, isMe: i === uid }; }), joined: joined.map(function (i) { return { id: i, isMe: i === uid }; }), left: [] };
      peerFns.forEach(function (f) { try { f(ch); } catch (e) {} });
    }, function () {});
  }
  function stopPresence(del) {
    if (presTimer) { clearInterval(presTimer); presTimer = null; }
    if (presUnsub) { try { presUnsub(); } catch (e) {} presUnsub = null; }
    if (del && uid) presRef().delete().catch(function () {});
    known = null;
  }
  window.addEventListener('pagehide', function () { if (uid) presRef().delete().catch(function () {}); });
  var room = {
    presence: function () {},
    onPeers: function (f) { peerFns.push(f); return function () { peerFns = peerFns.filter(function (g) { return g !== f; }); }; },
    emit: function () {}, on: function () { return function () {}; }, join: function () { return room; }, leave: function () {}
  };

  /* ---- 本体から呼ばれる入口 ---- */
  window.claude = {
    use: function (name) {
      if (name === 'db') return Promise.resolve(fs);
      if (name === 'user') return new Promise(function (r) {
        var u = {
          id: function () { return new Promise(function (r2) { function go() { if (!uid) guest = true; r2(uid || null); } if (authKnown) go(); else pendingUser.push(go); }); },
          isOwner: function () { return new Promise(function (r2) { function chk() { var e = auth.currentUser && auth.currentUser.email; r2(!!e && String(e).toLowerCase() === String(window.ADMIN_EMAIL || '').toLowerCase()); } if (authKnown) chk(); else pendingUser.push(chk); }); }
        };
        r(u);
      });
      if (name === 'room') return Promise.resolve(room);
      return Promise.resolve(null); /* sample（AIの返信）は、この版では使わない */
    }
  };
})();
