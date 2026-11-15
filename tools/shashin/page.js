/* ページの中で動く、写真づくりの道具（自作） */
window.G = (function () {
  var SERIF = '"Noto Serif CJK JP","Noto Serif JP",serif', SANS = '"Noto Sans CJK JP","Noto Sans JP",sans-serif';
  var BG = '#f6f1e6', INK = '#26241f', SOFT = '#6e6757', ACC = '#1f7a63';
  function base(title, sub) {
    var cv = document.createElement('canvas'); cv.width = 1200; cv.height = 1200; var c = cv.getContext('2d');
    c.fillStyle = BG; c.fillRect(0, 0, 1200, 1200);
    c.fillStyle = ACC; c.fillRect(0, 0, 1200, 10);
    c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    c.fillStyle = ACC; c.font = '500 26px ' + SANS; c.fillText('俳句の裾野　機能紹介', 60, 62);
    c.fillStyle = INK; c.font = '700 54px ' + SERIF; c.fillText(title, 58, 128);
    if (sub) { c.fillStyle = SOFT; c.font = '400 27px ' + SANS; c.fillText(sub, 60, 172); }
    c.fillStyle = SOFT; c.font = '400 22px ' + SANS; c.textAlign = 'right'; c.fillText('haikunosusono.web.app', 1140, 62); c.textAlign = 'left';
    return cv;
  }
  function label(c, t, x, y, w) { c.fillStyle = INK; c.font = '500 26px ' + SANS; c.textAlign = 'center'; c.fillText(t, x + w / 2, y); c.textAlign = 'left'; }
  function shadow(c, x, y, w, h) { c.save(); c.shadowColor = 'rgba(60,50,30,.28)'; c.shadowBlur = 18; c.shadowOffsetY = 6; c.fillStyle = '#fff'; c.fillRect(x, y, w, h); c.restore(); }
  /* 4枚ならべる */
  function grid4(title, sub, tiles) {
    var cv = base(title, sub), c = cv.getContext('2d'), S = 440, gx = 60, x0 = (1200 - S * 2 - gx) / 2, y0 = 205, gy = 56;
    tiles.forEach(function (t, i) { var x = x0 + (i % 2) * (S + gx), y = y0 + Math.floor(i / 2) * (S + gy); shadow(c, x, y, S, S); c.drawImage(t.cv, x, y, S, S); label(c, t.label, x, y + S + 36, S); });
    return cv;
  }
  /* 1枚を大きく（右に説明） */
  function one(title, sub, img, lines) {
    var cv = base(title, sub), c = cv.getContext('2d'), S = 760, x = 60, y = 230;
    shadow(c, x, y, S, S); c.drawImage(img, x, y, S, S);
    c.fillStyle = INK; c.font = '500 30px ' + SANS; var ty = 280;
    (lines || []).forEach(function (l) { if (l === '') { ty += 22; return; } c.fillStyle = l.charAt(0) === '・' ? INK : ACC; c.fillText(l, 860, ty); ty += 50; });
    return cv;
  }
  /* スマホの画面（左）と説明（右） */
  function phone(title, sub, img, lines) {
    var cv = base(title, sub), c = cv.getContext('2d'), H = 930, W = Math.round(img.width * H / img.height), x = 70, y = 215;
    if (W > 560) { W = 560; H = Math.round(img.height * W / img.width); }
    c.save(); c.shadowColor = 'rgba(40,35,20,.35)'; c.shadowBlur = 26; c.shadowOffsetY = 8; rr(c, x - 12, y - 12, W + 24, H + 24, 34); c.fillStyle = '#2b2a26'; c.fill(); c.restore();
    c.save(); rr(c, x, y, W, H, 22); c.clip(); c.drawImage(img, x, y, W, H); c.restore();
    var tx = x + W + 60, ty = 300, mw = 1140 - tx;
    (lines || []).forEach(function (l) { if (l === '') { ty += 24; return; } var head = l.charAt(0) !== '・' && l.charAt(0) !== '　'; c.fillStyle = head ? ACC : INK; c.font = (head ? '700 34px ' : '500 29px ') + SANS; wrap(c, l, mw).forEach(function (s) { c.fillText(s, tx, ty); ty += head ? 54 : 46; }); ty += 6; });
    return cv;
  }
  /* 2枚ならべて、ちがいを見せる（横長 1200x800） */
  function pair(title, sub, a, b) {
    var cv = document.createElement('canvas'); cv.width = 1200; cv.height = 800; var c = cv.getContext('2d');
    c.fillStyle = BG; c.fillRect(0, 0, 1200, 800); c.fillStyle = ACC; c.fillRect(0, 0, 1200, 10);
    c.textAlign = 'left'; c.fillStyle = ACC; c.font = '500 24px ' + SANS; c.fillText('俳句の裾野　句碑のデコレーション', 50, 54);
    c.fillStyle = INK; c.font = '700 46px ' + SERIF; c.fillText(title, 48, 112);
    c.fillStyle = SOFT; c.font = '400 25px ' + SANS; c.fillText(sub, 50, 152);
    var S = 530, y = 178; [a, b].forEach(function (t, i) { var x = 50 + i * (S + 40); shadow(c, x, y, S, S); c.drawImage(t.cv, x, y, S, S); label(c, t.label, x, y + S + 38, S); });
    c.fillStyle = SOFT; c.font = '400 20px ' + SANS; c.textAlign = 'right'; c.fillText('haikunosusono.web.app', 1150, 784); c.textAlign = 'left';
    return cv;
  }
  /* スマホの画面を2〜3枚ならべる（横長 1200x900）。2枚のときは、右に説明 */
  function phones(title, sub, list, lines) {
    var cv = document.createElement('canvas'); cv.width = 1200; cv.height = 900; var c = cv.getContext('2d');
    c.fillStyle = BG; c.fillRect(0, 0, 1200, 900); c.fillStyle = ACC; c.fillRect(0, 0, 1200, 10);
    c.textAlign = 'left'; c.fillStyle = ACC; c.font = '500 24px ' + SANS; c.fillText('俳句の裾野でできること', 50, 54);
    c.fillStyle = SOFT; c.font = '400 21px ' + SANS; c.textAlign = 'right'; c.fillText('haikunosusono.web.app', 1150, 54); c.textAlign = 'left';
    c.fillStyle = INK; c.font = '700 46px ' + SERIF; c.fillText(title, 48, 112);
    if (sub) { c.fillStyle = SOFT; c.font = '400 25px ' + SANS; c.fillText(sub, 50, 152); }
    var W = 322, H = 644, y = 182, n = list.length, gap = n === 3 ? 56 : 44, x0 = n === 3 ? (1200 - W * 3 - gap * 2) / 2 : 60;
    list.forEach(function (t, i) {
      var x = x0 + i * (W + gap);
      c.save(); c.shadowColor = 'rgba(40,35,20,.32)'; c.shadowBlur = 22; c.shadowOffsetY = 8; rr(c, x - 9, y - 9, W + 18, H + 18, 30); c.fillStyle = '#2b2a26'; c.fill(); c.restore();
      c.save(); rr(c, x, y, W, H, 22); c.clip(); c.fillStyle = '#fff'; c.fillRect(x, y, W, H); var ih = Math.min(t.img.height, t.img.width * H / W); c.drawImage(t.img, 0, 0, t.img.width, ih, x, y, W, H * (ih / (t.img.width * H / W))); c.restore();
      if (t.cap) { c.fillStyle = INK; c.font = '700 27px ' + SANS; c.textAlign = 'center'; c.fillText(t.cap, x + W / 2, y + H + 52); c.textAlign = 'left'; }
    });
    if (n < 3 && lines) { var tx = x0 + n * (W + gap) + 10, ty = 240, mw = 1150 - tx;
      lines.forEach(function (l) { if (l === '') { ty += 22; return; } var head = l.charAt(0) !== '・' && l.charAt(0) !== '　'; c.fillStyle = head ? ACC : INK; c.font = (head ? '700 32px ' : '500 27px ') + SANS; wrap(c, l, mw).forEach(function (s2) { c.fillText(s2, tx, ty); ty += head ? 50 : 42; }); ty += 6; }); }
    return cv;
  }
  function wrap(c, t, mw) { var out = [], cur = ''; Array.from(t).forEach(function (ch) { if (c.measureText(cur + ch).width > mw && cur) { out.push(cur); cur = (t.charAt(0) === '・' ? '　' : '') + ch; } else cur += ch; }); if (cur) out.push(cur); return out; }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function jpg(cv, q) { return cv.toDataURL('image/jpeg', q || 0.86); }
  function img(url) { return new Promise(function (ok, ng) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = ng; i.src = url; }); }
  return { phones: phones, pair: pair, grid4: grid4, one: one, phone: phone, jpg: jpg, img: img, base: base };
})();
