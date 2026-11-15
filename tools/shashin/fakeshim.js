/* 画面の写真をとるための、にせの保存先（端末の中だけ・ネットにつながない） */
(function () {
  var store = {}, subs = [];
  var DEL = { __del: 1 }, TS = { __ts: 1 };
  window.firebase = { firestore: { FieldValue: { delete: function () { return DEL; }, serverTimestamp: function () { return TS; }, increment: function (n) { return { __inc: n }; }, arrayUnion: function () { return { __au: [].slice.call(arguments) }; }, arrayRemove: function () { return { __ar: [].slice.call(arguments) }; } } } };
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v) && !v.__del && !v.__ts && v.__inc === undefined && !v.__au && !v.__ar; }
  function val(v, old) { if (v === TS) return Date.now(); if (v && v.__inc !== undefined) return (Number(old) || 0) + v.__inc; if (v && v.__au) return (old || []).concat(v.__au.filter(function (x) { return (old || []).indexOf(x) < 0; })); if (v && v.__ar) return (old || []).filter(function (x) { return v.__ar.indexOf(x) < 0; }); return isObj(v) ? merge({}, v) : v; }
  function merge(t, s) { Object.keys(s).forEach(function (k) { var v = s[k]; if (k.indexOf('.') > 0) { var ps = k.split('.'), o = t; for (var i = 0; i < ps.length - 1; i++) { if (!isObj(o[ps[i]])) o[ps[i]] = {}; o = o[ps[i]]; } var o2 = {}; o2[ps[ps.length - 1]] = v; merge(o, o2); return; } if (v === DEL) delete t[k]; else if (isObj(v)) { if (!isObj(t[k])) t[k] = {}; merge(t[k], v); } else t[k] = val(v, t[k]); }); return t; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fire() { setTimeout(function () { subs.slice().forEach(function (s) { try { s(); } catch (e) { console.log('sub err ' + e); } }); }, 0); }
  function dsnap(path) { var d = store[path]; return { id: path.split('/').pop(), exists: !!d, data: function () { return d ? clone(d) : undefined; }, get: function (k) { return d ? d[k] : undefined; }, ref: doc(path) }; }
  function doc(path) {
    return { id: path.split('/').pop(), path: path,
      get: function () { return Promise.resolve(dsnap(path)); },
      set: function (data, opt) { store[path] = merge(opt && opt.merge && store[path] ? store[path] : {}, data); fire(); return Promise.resolve(); },
      update: function (data) { store[path] = merge(store[path] || {}, data); fire(); return Promise.resolve(); },
      delete: function () { delete store[path]; fire(); return Promise.resolve(); },
      onSnapshot: function (cb) { var f = function () { cb(dsnap(path)); }; subs.push(f); setTimeout(f, 0); return function () { subs = subs.filter(function (x) { return x !== f; }); }; },
      collection: function (n) { return col(path + '/' + n); } };
  }
  function col(path, q) {
    q = q || { w: [], o: null, l: 0 };
    function run() {
      var n = path.split('/').length + 1, ds = Object.keys(store).filter(function (p) { return p.indexOf(path + '/') === 0 && p.split('/').length === n; }).map(dsnap);
      q.w.forEach(function (w) { ds = ds.filter(function (d) { var v = d.data()[w[0]]; return w[1] === '==' ? v === w[2] : w[1] === '>=' ? v >= w[2] : w[1] === '>' ? v > w[2] : w[1] === '<=' ? v <= w[2] : w[1] === '<' ? v < w[2] : w[1] === 'in' ? w[2].indexOf(v) >= 0 : true; }); });
      if (q.o) ds.sort(function (a, b) { var x = q.o[0] === '__name__' ? a.id : a.data()[q.o[0]], y = q.o[0] === '__name__' ? b.id : b.data()[q.o[0]]; return (x < y ? -1 : x > y ? 1 : 0) * (q.o[1] === 'desc' ? -1 : 1); });
      if (q.l) ds = ds.slice(0, q.l);
      return { docs: ds, size: ds.length, empty: !ds.length, forEach: function (f) { ds.forEach(f); }, docChanges: function () { return ds.map(function (d) { return { type: 'added', doc: d }; }); } };
    }
    return { id: path.split('/').pop(), path: path,
      doc: function (id) { return doc(path + '/' + (id || 'auto' + Math.random().toString(36).slice(2, 10))); },
      add: function (data) { var d = this.doc(); return d.set(data).then(function () { return d; }); },
      get: function () { return Promise.resolve(run()); },
      onSnapshot: function (cb) { var f = function () { cb(run()); }; subs.push(f); setTimeout(f, 0); return function () { subs = subs.filter(function (x) { return x !== f; }); }; },
      where: function (a, b, c) { return col(path, { w: q.w.concat([[a, b, c]]), o: q.o, l: q.l }); },
      orderBy: function (a, b) { return col(path, { w: q.w, o: [a, b || 'asc'], l: q.l }); },
      limit: function (n) { return col(path, { w: q.w, o: q.o, l: n }); } };
  }
  var db = { collection: function (p) { return col(p); }, doc: function (p) { return doc(p); },
    runTransaction: function (fn) { return Promise.resolve(fn({ get: function (r) { return r.get(); }, set: function (r, d, o) { r.set(d, o); }, update: function (r, d) { r.update(d); }, delete: function (r) { r.delete(); } })); },
    batch: function () { var ops = []; return { set: function (r, d, o) { ops.push(function () { r.set(d, o); }); }, update: function (r, d) { ops.push(function () { r.update(d); }); }, delete: function (r) { ops.push(function () { r.delete(); }); }, commit: function () { ops.forEach(function (f) { f(); }); return Promise.resolve(); } }; } };
  window.__store = store; window.__seed = function (o) { Object.keys(o).forEach(function (k) { store[k] = o[k]; }); fire(); };
  if (window.__SEED) Object.keys(window.__SEED).forEach(function (k) { store[k] = window.__SEED[k]; });
  var room = { presence: function () {}, onPeers: function () { return function () {}; }, emit: function () {}, on: function () { return function () {}; }, join: function () { return room; }, leave: function () {} };
  window.fbHasX = window.fbHasMail = window.fbHasG = function () { return true; }; window.fbShowGate = window.fbLogout = function () {};
  window.claude = { use: function (name) {
    if (name === 'db') return Promise.resolve(db);
    if (name === 'user') return Promise.resolve({ id: function () { return Promise.resolve(window.__UID === undefined ? 'demo' : window.__UID); }, isOwner: function () { return Promise.resolve(false); } });
    if (name === 'room') return Promise.resolve(room);
    return Promise.resolve(null); } };
})();
