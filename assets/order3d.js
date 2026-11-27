/* 訂單完成視窗：3D 店貓（Three.js r149，正交相機）
   背景是固定的居酒屋空景照片；3D 只負責店貓。世界座標 = 背景照片像素座標（1672×941，y 向下），
   所以只要把吧檯檯面、椅面的座標量準，貓的腳掌就會踩在照片裡的檯面上。
   ※ 貓是以三視圖為依據、用幾何體組成的「佔位模型」，不是正式 GLB。
   對外：Order3D.load() → Promise<boolean>；Order3D.ready3d；Order3D.play(stage, opts)；Order3D.stop() */
(function () {
  'use strict';
  var O = window.Order3D = { ready3d: false, load: load, play: play, stop: stop };
  var T, loading, current = null;

  /* ---------- 場景校準（量自 純場景.png，1672×941） ---------- */
  var W = 1672, H = 941;
  var CAL = {
    back: function (x) { return 650 - (x - 660) * 0.1107; },      // 吧檯後緣
    front: function (x) { return 780 - (x - 50) * 0.1171; },      // 吧檯前緣
    walkV: 0.52,                                                   // 走道在後緣→前緣之間的位置（0 後、1 前）
    seat: { x: 1596, y: 716 },                                     // 最右側椅面：貓從這裡蹲低起跳
    land: { x: 1440 },                                             // 落點 x（y 由檯面算出）
    stopX: 1180,                                                   // 走到這裡趴下
    enterX: 1820,                                                  // 進場起點（畫面右外側）
    tilt: Math.atan(0.11),                                         // 檯面往右升高的角度
    px: 250,                                                       // 模型 1 單位 = 幾個像素（比例 1.0 時）
    scaleAt: function (x) { return 1 - (x - 820) / 680 * 0.18; }   // 越往右越遠、越小
  };
  CAL.groundY = function (x) { var b = CAL.back(x), f = CAL.front(x); return b + (f - b) * CAL.walkV; };
  CAL.seatScale = 0.98;

  function loadScript(src) {
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  function load() {
    if (loading) return loading;
    loading = new Promise(function (resolve) {
      try {
        var c = document.createElement('canvas');
        if (!(c.getContext('webgl2') || c.getContext('webgl'))) { resolve(false); return; }
      } catch (e) { resolve(false); return; }
      (window.THREE ? Promise.resolve() : loadScript('assets/three.min.js')).then(function () {
        T = window.THREE; O.ready3d = !!T; resolve(O.ready3d);
      }, function () { resolve(false); });
    });
    return loading;
  }

  /* ---------- 材質與貼圖 ---------- */
  function mat(color, rough, extra) {
    var o = { color: color, roughness: rough == null ? 0.9 : rough, metalness: 0 };
    if (extra) for (var k in extra) o[k] = extra[k];
    return new T.MeshStandardMaterial(o);
  }
  function mesh(geo, m, x, y, z, parent) {
    var o = new T.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(o); return o;
  }
  function blobTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d');
    var r = g.createRadialGradient(64, 64, 4, 64, 64, 62); r.addColorStop(0, 'rgba(18,5,0,.85)'); r.addColorStop(1, 'rgba(18,5,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  }

  /* ---------- 店貓（朝 +x，原點在腳掌著地處）：依三視圖配色 ---------- */
  function buildCat() {
    var cream = mat(0xe6dccd), creamHi = mat(0xf2ebde), white = mat(0xf6f1e8), shade = mat(0xbdb2a2);
    var seal = mat(0x4b382c), taupe = mat(0x7b6452), taupeLt = mat(0x9a8573);
    var maroon = mat(0x5c1622, 0.85), trim = mat(0xe8dcc0, 0.85), blue = mat(0x4f8fd0, 0.25), black = mat(0x111010, 0.3), pink = mat(0xd99a9a, 0.6);
    var tilt = new T.Group(), yawG = new T.Group(), root = new T.Group();
    tilt.add(yawG); yawG.add(root);
    // 身體與胸前長毛
    var body = mesh(new T.SphereGeometry(0.2, 28, 20), cream, 0, 0.34, 0, root); body.scale.set(1.55, 0.95, 0.92);
    mesh(new T.SphereGeometry(0.17, 20, 16), shade, -0.18, 0.28, 0, root).scale.set(1.2, 0.8, 0.95);
    var chest = mesh(new T.SphereGeometry(0.17, 22, 16), creamHi, 0.25, 0.36, 0, root); chest.scale.set(1, 1.12, 1);
    mesh(new T.SphereGeometry(0.15, 20, 16), creamHi, 0.31, 0.43, 0, root).scale.set(0.9, 1, 1.05);
    // 酒紅店服：披在背上與兩側，下緣米白滾邊、背上圓形家紋、側邊蝴蝶結
    var vest = mesh(new T.SphereGeometry(0.205, 28, 12, 0, Math.PI * 2, 0, 1.28), maroon, -0.02, 0.335, 0, root); vest.scale.set(1.5, 0.98, 0.94);
    var hem = mesh(new T.SphereGeometry(0.207, 28, 4, 0, Math.PI * 2, 1.26, 0.07), trim, -0.02, 0.335, 0, root); hem.scale.set(1.5, 0.98, 0.94);
    var crest = mesh(new T.CylinderGeometry(0.052, 0.052, 0.006, 20), trim, -0.02, 0.538, 0, root);
    mesh(new T.CylinderGeometry(0.034, 0.034, 0.008, 20), maroon, -0.02, 0.541, 0, root);
    [-1, 1].forEach(function (s) {
      mesh(new T.BoxGeometry(0.05, 0.04, 0.012), trim, 0.06, 0.33, s * 0.19, root).rotation.z = 0.3;
      mesh(new T.BoxGeometry(0.05, 0.04, 0.012), trim, 0.1, 0.31, s * 0.188, root).rotation.z = -0.3;
      mesh(new T.BoxGeometry(0.03, 0.12, 0.012), trim, 0.08, 0.3, s * 0.19, root);
    });
    // 頭：奶油底、深棕面罩、白色鼻樑與嘴周、深棕耳朵、藍眼
    var head = new T.Group(); head.position.set(0.37, 0.5, 0); root.add(head);
    var skull = mesh(new T.SphereGeometry(0.14, 26, 20), cream, 0, 0, 0, head); skull.scale.set(1, 0.93, 1.07);
    mesh(new T.SphereGeometry(0.12, 22, 16), seal, 0.05, -0.005, 0, head).scale.set(0.9, 0.92, 1.08);
    mesh(new T.SphereGeometry(0.05, 14, 12), white, 0.11, 0.045, 0, head).scale.set(0.6, 1.3, 0.28);                 // 白色鼻樑
    [-1, 1].forEach(function (s) {
      mesh(new T.SphereGeometry(0.052, 14, 12), white, 0.125, -0.045, s * 0.04, head).scale.set(1, 0.75, 0.95);      // 嘴周
      mesh(new T.SphereGeometry(0.075, 16, 12), cream, 0.0, -0.075, s * 0.095, head).scale.set(1, 0.9, 0.75);        // 臉頰長毛
      var ear = mesh(new T.ConeGeometry(0.052, 0.115, 5), seal, -0.02, 0.15, s * 0.09, head); ear.rotation.x = -s * 0.32; ear.rotation.z = 0.08;
      mesh(new T.SphereGeometry(0.026, 12, 10), blue, 0.122, 0.03, s * 0.06, head).scale.set(0.7, 1, 1);
      mesh(new T.SphereGeometry(0.013, 10, 8), black, 0.139, 0.03, s * 0.06, head).scale.set(0.6, 1, 1);
    });
    mesh(new T.SphereGeometry(0.017, 10, 8), pink, 0.157, -0.012, 0, head).scale.set(0.8, 0.7, 1);
    mesh(new T.SphereGeometry(0.115, 18, 14), creamHi, -0.05, -0.1, 0, head).scale.set(0.9, 0.7, 1.05);               // 頸圈長毛
    var lids = [];                                                                                                     // 眼皮（睡著時蓋住藍眼）
    [-1, 1].forEach(function (s) { var l = mesh(new T.SphereGeometry(0.03, 12, 10), seal, 0.124, 0.032, s * 0.06, head); l.scale.set(0.6, 0.05, 1.05); l.visible = false; lids.push(l); });
    var wh = mat(0xf7f2e8, 0.8);
    [-1, 1].forEach(function (s) { [0, 1].forEach(function (i) { var w = mesh(new T.CylinderGeometry(0.0025, 0.0025, 0.14, 4), wh, 0.13, -0.04 - i * 0.018, s * 0.09, head); w.rotation.x = Math.PI / 2; w.rotation.z = (i - 0.5) * 0.3; w.rotation.y = -s * 0.3; }); });
    // 四肢（支點在上端，奶油色粗腿、白色腳掌）
    var legs = [];
    [[0.2, 1], [0.2, -1], [-0.2, 1], [-0.2, -1]].forEach(function (p) {
      var lg = new T.Group(); lg.position.set(p[0], 0.23, p[1] * 0.105); root.add(lg);
      mesh(new T.CylinderGeometry(0.05, 0.043, 0.22, 12), p[0] > 0 ? cream : shade, 0, -0.11, 0, lg);
      mesh(new T.SphereGeometry(0.055, 12, 10), white, 0.014, -0.225, 0, lg).scale.set(1.35, 0.7, 1.05);
      legs.push(lg);
    });
    // 尾巴：蓬鬆深棕，根部偏淡，往後拖
    var tail = new T.Group(); tail.position.set(-0.3, 0.38, 0); root.add(tail);
    var segs = [];
    for (var i = 0; i < 8; i++) {
      var r = [0.06, 0.075, 0.088, 0.096, 0.098, 0.092, 0.078, 0.058][i];
      var sg = mesh(new T.SphereGeometry(r, 14, 12), i < 2 ? taupeLt : taupe, 0, 0, 0, tail); sg.scale.set(1.25, 1, 1.05); segs.push(sg);
    }
    // 腳下陰影
    var blob = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
    return { tilt: tilt, yawG: yawG, root: root, head: head, legs: legs, segs: segs, lids: lids, blob: blob };
  }

  /* ---------- 姿勢套用 ---------- */
  var STEP = 2 * 0.22 * Math.sin(0.55);               // 腳掌每半個步伐在模型上的前後位移
  function applyPose(c) {
    var m = c.m, P = c.p, r = P.rest;
    var sy = P.legScale, walk = P.walk;
    var sw = Math.sin(c.phase) * 0.55 * walk;
    var fl = P.legF + sw, fr = P.legF - sw, rl = P.legR - sw, rr = P.legR + sw;
    var restF = 1.42, restR = -1.35;                  // 趴下：前腳往前平放、後腳收進身體
    m.legs[0].rotation.z = fl * (1 - r) + restF * r; m.legs[1].rotation.z = fr * (1 - r) + restF * r;
    m.legs[2].rotation.z = rl * (1 - r) + restR * r; m.legs[3].rotation.z = rr * (1 - r) + restR * r;
    m.legs.forEach(function (l, i) {
      var s = (i < 2) ? sy * (1 - r * 0.25) : sy * (1 - r * 0.6);
      l.scale.y = s; l.position.y = 0.23 - (i < 2 ? 0.11 : 0.15) * r;
    });
    var drop = -0.23 * (1 - sy) - 0.15 * r;
    var bob = Math.abs(Math.sin(c.phase)) * 0.014 * walk;
    m.root.position.y = drop + bob + P.lift;
    m.root.rotation.z = P.pitch + Math.sin(c.phase) * 0.02 * walk - r * 0.04;
    m.head.position.set(0.37 - r * 0.02 + P.headFwd, 0.5 - r * 0.2 - (1 - sy) * 0.02, 0);
    m.head.rotation.z = P.headPitch - r * 0.38 + Math.sin(c.t * 1.4) * 0.02 * (1 - r);
    var lid = r > 0.8 || P.blink; m.lids.forEach(function (l) { l.visible = !!lid; });
    for (var i = 0; i < m.segs.length; i++) {
      var f = i / (m.segs.length - 1), sway = Math.sin(c.t * 2 - i * 0.55) * 0.05 * (1 + f) * (1 - r * 0.5);
      var curl = r;
      m.segs[i].position.set(-0.06 * i * (1 - curl * 0.45), 0.012 * i * i * 0.35 * (1 - curl) + P.tailLift * f * 0.12 - 0.01 * i * curl,
        sway + curl * Math.pow(f, 1.4) * 0.34);
    }
  }
  function placeCat(c) {
    var m = c.m, s = c.s * CAL.px;
    m.tilt.position.set(c.x, -(c.y) + c.h, 0);
    m.tilt.scale.setScalar(s);
    m.tilt.rotation.z = c.tilt;
    m.yawG.rotation.y = c.yaw;
    var b = m.blob, air = Math.min(1, c.h / 110);
    b.position.set(c.x, -(c.gy != null ? c.gy : c.y), -1); b.scale.set(1.1 * s, 0.32 * s, 1); b.rotation.z = c.tilt;
    b.material.opacity = 0.85 * (1 - air * 0.8); b.scale.x *= 1 - air * 0.15;
  }

  function newPose() { return { legF: 0, legR: 0, legScale: 1, walk: 0, pitch: 0, lift: 0, headFwd: 0, headPitch: 0, tailLift: 0, rest: 0, blink: 0 }; }

  /* ---------- 播放 ---------- */
  function play(stage, opts) {
    stop(); opts = opts || {};
    var canvas = document.createElement('canvas'); canvas.className = 'done-3d'; canvas.setAttribute('aria-hidden', 'true');
    var renderer;
    try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); } catch (e) { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.LinearEncoding; renderer.setClearColor(0x000000, 0);
    var scene = new T.Scene(), cam = new T.OrthographicCamera(0, W, 0, -H, -2000, 2000); cam.position.z = 800;
    scene.add(new T.AmbientLight(0xffd2a4, 0.62));
    var key = new T.DirectionalLight(0xffc380, 0.8); key.position.set(-300, 700, 600); scene.add(key);
    var rim = new T.DirectionalLight(0xff8a3a, 0.45); rim.position.set(600, 200, -300); scene.add(rim);
    var fill = new T.DirectionalLight(0xb9c7e6, 0.18); fill.position.set(200, -100, 700); scene.add(fill);
    var m = buildCat(); scene.add(m.tilt); scene.add(m.blob);
    stage.appendChild(canvas);
    if (opts.debug) stage.appendChild(debugOverlay());

    var c = { m: m, p: newPose(), x: CAL.enterX, y: CAL.seat.y, gy: null, h: 0, s: CAL.seatScale, yaw: Math.PI + 0.32, tilt: 0, phase: 0, t: 0 };
    var alive = true, raf = 0, last = performance.now();
    var api = { stop: function () { alive = false; cancelAnimationFrame(raf); try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) {} if (canvas.parentNode) canvas.parentNode.removeChild(canvas); } };
    current = api;
    function resize() { var w = stage.clientWidth, h = stage.clientHeight; if (w && h) renderer.setSize(w, h, false); }
    resize(); var ro = window.ResizeObserver ? new ResizeObserver(resize) : null; if (ro) ro.observe(stage);
    var origStop = api.stop; api.stop = function () { if (ro) ro.disconnect(); origStop(); };
    function frame(now) {
      if (!alive) return; raf = requestAnimationFrame(frame);
      c.t += Math.min(0.05, (now - last) / 1000); last = now;
      applyPose(c); placeCat(c); renderer.render(scene, cam);
    }
    raf = requestAnimationFrame(frame);

    /* --- 時間軸 --- */
    var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
    function anim(ms, fn) {
      return new Promise(function (res) {
        var t0 = performance.now();
        (function step(now) { if (!alive) return res(); var t = Math.min(1, (now - t0) / ms); fn(t); if (t < 1) requestAnimationFrame(step); else res(); })(performance.now());
      });
    }
    function tween(obj, to, ms) {
      var from = {}; for (var k in to) from[k] = obj[k];
      return anim(ms, function (t) { var e = ease(t); for (var k in to) obj[k] = from[k] + (to[k] - from[k]) * e; });
    }
    function setSurface(x, onSeat) {
      c.x = x; c.gy = null; c.y = onSeat ? CAL.seat.y : CAL.groundY(x); c.s = onSeat ? CAL.seatScale : CAL.scaleAt(x); c.tilt = onSeat ? 0 : CAL.tilt;
    }
    // 沿地面走：腳步頻率跟著位移，腳掌不打滑
    async function walkTo(x1, speed, onSeat) {
      var dir = x1 < c.x ? -1 : 1, last2 = performance.now(), t0 = last2;
      c.p.walk = 1;
      while (alive && Math.abs(x1 - c.x) > 0.5) {
        await new Promise(requestAnimationFrame); var now = performance.now(), dt = Math.min(0.05, (now - last2) / 1000); last2 = now;
        var k = Math.min(1, (now - t0) / 450, Math.abs(x1 - c.x) / 70 + 0.2), dx = Math.min(Math.abs(x1 - c.x), speed * k * dt);
        setSurface(c.x + dir * dx, onSeat);
        c.phase += Math.PI * (dx / (CAL.px * c.s * 0.94)) / STEP;
      }
      c.p.walk = 0;
    }
    function finalPose() {
      setSurface(CAL.stopX, false); c.yaw = Math.PI + 0.32; c.p = newPose(); c.p.rest = 1; c.p.tailLift = 0;
    }
    async function timeline() {
      if (opts.reduced) { finalPose(); if (opts.onPose) opts.onPose('thumb'); if (opts.onSay) opts.onSay('謝謝光臨！示範訂單已建立。'); return; }
      if (opts.onPose) opts.onPose('greet');
      setSurface(CAL.enterX, true);
      await walkTo(CAL.seat.x, 125, true);                                        // 1 從右側走進場，停在椅面
      if (!alive) return;
      if (opts.onPose) opts.onPose('offer');
      await sleep(180);
      await tween(c.p, { legScale: 0.6, pitch: -0.1, headPitch: -0.12, tailLift: -0.5 }, 480); // 2 蹲低蓄力
      await sleep(120);
      // 3 跳上吧檯：沿拋物線，前腳先伸出、後腳跟上
      var x0 = CAL.seat.x, y0 = CAL.seat.y, x1 = CAL.land.x, y1 = CAL.groundY(x1), s1 = CAL.scaleAt(x1), HJ = 110;
      await anim(720, function (t) {
        var e = t;
        c.x = x0 + (x1 - x0) * e; c.y = y0 + (y1 - y0) * e; c.gy = y0 + (y1 - y0) * e; c.s = CAL.seatScale + (s1 - CAL.seatScale) * e;
        c.h = 4 * HJ * t * (1 - t) * (0.6 + 0.4 * c.s); c.tilt = CAL.tilt * ease(t);
        var p = c.p;
        p.legScale = t < 0.2 ? 0.6 + 0.6 * (t / 0.2) : 1.12 - 0.12 * Math.min(1, (t - 0.2) / 0.5);
        p.legF = 1.25 - 0.9 * ease(Math.max(0, (t - 0.45) / 0.5)); p.legR = -1.15 + 0.5 * ease(Math.max(0, (t - 0.6) / 0.4));
        p.pitch = 0.55 - 0.85 * ease(t); p.headPitch = 0.1 - 0.15 * t; p.tailLift = -0.5 + 1.5 * Math.sin(Math.min(1, t * 1.5) * Math.PI);
        p.lift = 0;
      });
      if (!alive) return;
      setSurface(x1, false); c.h = 0; c.gy = null;
      // 前腳先落地，身體下沉，後腳隨後貼上檯面
      await tween(c.p, { legScale: 0.92, pitch: -0.28, legF: 0.3, legR: -0.75, lift: 0.05, headPitch: 0.1, tailLift: 0.4 }, 130);
      await tween(c.p, { legScale: 0.8, pitch: -0.05, legF: 0.1, legR: -0.1, lift: 0, tailLift: 0 }, 150);
      await tween(c.p, { legScale: 1, pitch: 0, legF: 0, legR: 0, headPitch: 0 }, 200);
      if (!alive) return;
      await walkTo(CAL.stopX, 95, false);                                         // 4 沿檯面走幾步
      if (!alive) return;
      await tween(c.p, { headPitch: 0.3 }, 260); await sleep(260); await tween(c.p, { headPitch: 0 }, 220);
      if (opts.onPose) opts.onPose('thumb');
      await tween(c.p, { rest: 1, headPitch: 0, legScale: 1 }, 1300);             // 5 趴下，下巴擱在前腳上
      if (opts.onSay) opts.onSay('謝謝光臨！示範訂單已建立。');
      if (opts.onPose) opts.onPose('bow');
    }
    timeline();
    return api;
  }
  function stop() { if (current) { current.stop(); current = null; } }

  function debugOverlay() {
    var ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 ' + W + ' ' + H); s.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    s.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:7';
    function el(t, a) { var e = document.createElementNS(ns, t); for (var k in a) e.setAttribute(k, a[k]); s.appendChild(e); return e; }
    el('polygon', { points: '660,' + CAL.back(660) + ' 1672,' + CAL.back(1672) + ' 1672,' + CAL.front(1672) + ' 50,' + CAL.front(50), fill: 'rgba(0,255,120,.16)', stroke: '#0f6', 'stroke-width': 3 });
    el('line', { x1: CAL.stopX, y1: CAL.groundY(CAL.stopX), x2: CAL.land.x, y2: CAL.groundY(CAL.land.x), stroke: '#fff', 'stroke-width': 3, 'stroke-dasharray': '10 8' });
    [[CAL.seat.x, CAL.seat.y, '#f33'], [CAL.land.x, CAL.groundY(CAL.land.x), '#39f'], [CAL.stopX, CAL.groundY(CAL.stopX), '#fd0']].forEach(function (p) { el('circle', { cx: p[0], cy: p[1], r: 12, fill: p[2] }); });
    return s;
  }
})();
