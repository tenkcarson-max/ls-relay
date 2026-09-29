/* =============================================================================
   Loading screen logic - vanilla JS, no build step.
   Settings live in config.js. Nothing in here needs editing.
   ============================================================================= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var body = document.body;
  var root = document.documentElement;

  function str(v) { return v == null ? '' : String(v).trim(); }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function num(v, lo, hi, dflt) { v = Number(v); return isFinite(v) ? clamp(v, lo, hi) : dflt; }

  /* ---------------------------------------------------------------------------
     Config (a broken config.js must never break the loading screen)
     --------------------------------------------------------------------------- */
  var raw = window.LS_CONFIG;
  if (!raw || typeof raw !== 'object') {
    console.warn('[loadingscreen] config.js is missing or has a syntax error - using defaults');
    raw = {};
  }

  // In game, the server sends its own settings (resource "loadingscreen", config.lua) with the
  // connection. They override the defaults in config.js key by key.
  var handover = window.nuiHandoverData && window.nuiHandoverData.loadscreen;
  if (handover && typeof handover === 'object') {
    var merged = {};
    Object.keys(raw).forEach(function (k) { merged[k] = raw[k]; });
    Object.keys(handover).forEach(function (k) { if (handover[k] != null) merged[k] = handover[k]; });
    raw = merged;
  }

  var CFG = {
    resource: str(raw.resourceName) || 'loadingscreen',
    serverName: str(raw.serverName),
    tagline: str(raw.tagline),
    startVolume: Math.round(num(raw.startVolume, 0, 100, 35)),
    videoZoom: num(raw.videoZoom, 1, 2, 1.2),
    tidyTitles: raw.tidyTitles !== false,
    youtubeRelay: /^https?:\/\//.test(str(raw.youtubeRelay)) ? str(raw.youtubeRelay).trim() : '',
    playlist: parsePlaylist(raw.playlist),
    staff: Array.isArray(raw.staff) ? raw.staff : []
  };

  function parseVideoId(v) {
    var s = str(v);
    if (/^[\w-]{11}$/.test(s)) return s;
    var m = s.match(/(?:[?&]v=|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/|\/v\/)([\w-]{11})/);
    return m ? m[1] : null;
  }

  // "?t=22", "&t=1m30s", "?start=22" inside a pasted link
  function parseStartFromUrl(v) {
    var m = str(v).match(/[?&#](?:t|start)=([\dhms]+)/);
    if (!m) return 0;
    if (/^\d+$/.test(m[1])) return +m[1];
    var total = 0, re = /(\d+)([hms])/g, x;
    while ((x = re.exec(m[1]))) total += +x[1] * (x[2] === 'h' ? 3600 : x[2] === 'm' ? 60 : 1);
    return total;
  }

  function parsePlaylist(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    list.forEach(function (e) {
      if (typeof e === 'string') e = { url: e };
      if (!e || typeof e !== 'object') return;
      var id = parseVideoId(e.id || e.url);
      if (!id) { console.warn('[loadingscreen] playlist entry skipped (no YouTube id):', e); return; }
      var start = Number(e.start);
      start = isFinite(start) && start > 0 ? Math.floor(start) : parseStartFromUrl(e.url);
      out.push({ id: id, start: start, title: str(e.title), artist: str(e.artist) });
    });
    return out;
  }

  /* ---------------------------------------------------------------------------
     Layout: scale the 1920x1080 design to the game resolution
     --------------------------------------------------------------------------- */
  function applyScale() {
    var s = Math.min(window.innerHeight / 1080, window.innerWidth / 1500);
    root.style.setProperty('--ui-scale', clamp(s, 0.8, 2.5).toFixed(4));
  }
  applyScale();
  window.addEventListener('resize', applyScale);
  root.style.setProperty('--video-zoom', String(CFG.videoZoom));

  /* ---------------------------------------------------------------------------
     Logo intro: the logo opens big in the middle, holds while the light sweeps
     across it, then glides into the top left corner as the rest of the UI rises
     in (style.css times the UI to this). If the logo loads late, it just fades
     in at the corner (the CSS default).
     --------------------------------------------------------------------------- */
  (function logoIntro() {
    var mark = $('mark');
    var img = $('markImg');
    if (!mark || !img || typeof mark.animate !== 'function') return;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var done = false;

    function run() {
      if (done) return;
      done = true;
      if (reduced || performance.now() > 1400) return;          // too late for the big entrance
      // everything in design px (the .ui layer is zoomed by --ui-scale); box = .mark in style.css
      var z = parseFloat(root.style.getPropertyValue('--ui-scale')) || 1;
      var W = window.innerWidth / z, H = window.innerHeight / z;
      var ui = getComputedStyle($('ui'));
      var left = (parseFloat(ui.getPropertyValue('--edge-x')) || 56) - 16;
      var top = (parseFloat(ui.getPropertyValue('--edge-y')) || 48) - 14;
      var box = 330, boxH = 218;
      var dx = W / 2 - (left + box / 2);
      var dy = H * 0.47 - (top + boxH / 2);
      var s = clamp((W * 0.3) / box, 1.3, 1.75);
      var mid = 'translate(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px) scale(' + s.toFixed(3) + ')';
      var small = 'translate(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px) scale(' + (s * 0.92).toFixed(3) + ')';
      mark.animate([
        { transform: small, opacity: 0, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
        { transform: mid, opacity: 1, offset: 0.24, easing: 'linear' },
        { transform: mid, opacity: 1, offset: 0.6, easing: 'cubic-bezier(0.7, 0, 0.2, 1)' },
        { transform: 'none', opacity: 1 }
      ], { duration: 3300, fill: 'backwards' });
    }

    if (img.complete && img.naturalWidth) run();
    else {
      img.addEventListener('load', run);
      img.addEventListener('error', function () { done = true; mark.hidden = true; });
    }
  })();

  /* ---------------------------------------------------------------------------
     Title (top left) + team panel (top right)
     --------------------------------------------------------------------------- */
  if (CFG.serverName) {
    $('brandName').textContent = CFG.serverName;
    $('brandTag').textContent = CFG.tagline;
    $('brand').hidden = false;
  }

  (function renderTeam() {
    var groups = [];
    CFG.staff.forEach(function (g) {
      if (!g || typeof g !== 'object') return;
      var names = typeof g.names === 'string' ? g.names.split(',') : g.names;
      names = (Array.isArray(names) ? names : []).map(str).filter(Boolean);
      if (names.length) groups.push({ role: str(g.role), names: names });
    });

    var panel = $('team');
    if (!groups.length) { panel.hidden = true; return; }

    groups.forEach(function (g, i) {
      if (i) {
        var sep = document.createElement('div');
        sep.className = 'team__sep';
        panel.appendChild(sep);
      }
      var role = document.createElement('div');
      role.className = 'team__role';
      role.textContent = g.role;
      var namesEl = document.createElement('div');
      namesEl.className = 'team__names';
      g.names.forEach(function (n) {
        var s = document.createElement('span');
        s.className = 'team__name';
        s.textContent = n;
        namesEl.appendChild(s);
      });
      panel.appendChild(role);
      panel.appendChild(namesEl);
    });
    panel.hidden = false;
  })();

  /* ---------------------------------------------------------------------------
     Loading progress (FiveM posts these to the loading screen window)
     --------------------------------------------------------------------------- */
  var pctEl = $('loadPct');
  var fillEl = $('loadFill');
  var statusEl = $('loadStatus');
  var labelEl = $('loadLabel');

  // Rough share of the total load for each phase, used when loadProgress is sparse.
  var PHASES = {
    INIT_CORE: [0, 0.04],
    INIT_BEFORE_MAP_LOADED: [0.04, 0.22],
    MAP: [0.22, 0.7],
    INIT_AFTER_MAP_LOADED: [0.7, 0.86],
    INIT_SESSION: [0.86, 0.98]
  };
  var PHASE_TEXT = {
    INIT_CORE: 'Starting game',
    INIT_BEFORE_MAP_LOADED: 'Preparing world',
    MAP: 'Loading map data',
    INIT_AFTER_MAP_LOADED: 'Building world',
    INIT_SESSION: 'Joining session'
  };

  var prog = {
    target: 0, shown: 0, rendered: -1, raf: 0, last: 0,
    phase: null, initCount: 0, mapCount: 0, mapDone: 0,
    lastLogAt: 0, done: false, real: false
  };
  var sim = { running: false, pv: 0, lv: 0, startTimer: 0 };   // browser preview (see below)

  function setTarget(f) {
    f = clamp(Number(f) || 0, 0, 1);
    if (f <= prog.target) return;          // never go backwards
    prog.target = f;
    if (!prog.raf) { prog.last = performance.now(); prog.raf = requestAnimationFrame(stepProgress); }
  }

  function phaseProgress(type, f) {
    var r = PHASES[type];
    if (r) setTarget(r[0] + (r[1] - r[0]) * clamp(f, 0, 1));
  }

  function stepProgress(ts) {
    var dt = Math.min(0.1, Math.max(0, (ts - prog.last) / 1000));
    prog.last = ts;
    var diff = prog.target - prog.shown;
    // ease out, but never slower than 8%/s so the last percent doesn't crawl
    var step = Math.max(diff * Math.min(1, dt * 4), Math.min(diff, dt * 0.08));
    prog.shown = diff < 0.0008 ? prog.target : prog.shown + step;
    renderProgress();
    prog.raf = prog.shown < prog.target ? requestAnimationFrame(stepProgress) : 0;
  }

  function renderProgress() {
    var pct = Math.floor(prog.shown * 100 + 1e-6);
    if (pct !== prog.rendered) { pctEl.textContent = pct; prog.rendered = pct; }
    fillEl.style.width = (prog.shown * 100).toFixed(2) + '%';
    if (prog.shown >= 1 && !prog.done) {
      prog.done = true;
      labelEl.textContent = 'Finalizing';
      setStatus('Almost ready', false);
    }
  }

  function setStatus(text, fromLog) {
    var t = str(text).replace(/\^\d/g, '').replace(/\s+/g, ' ').trim();
    if (!t) return;
    if (fromLog) prog.lastLogAt = Date.now();
    else if (Date.now() - prog.lastLogAt < 4000) return;   // real log lines take priority
    if (t.length > 60) t = t.slice(0, 59).replace(/\s+$/, '') + '…';
    if (statusEl.textContent !== t) statusEl.textContent = t;
  }

  var handlers = {
    loadProgress: function (d) { setTarget(d.loadFraction); },
    onLogLine: function (d) { setStatus(d.message, true); },
    startInitFunctionOrder: function (d) {
      prog.phase = d.type;
      prog.initCount = Number(d.count) || 0;
      phaseProgress(d.type, 0);
      setStatus(PHASE_TEXT[d.type] || 'Initializing', false);
    },
    initFunctionInvoking: function (d) {
      if (prog.initCount) phaseProgress(d.type || prog.phase, (Number(d.idx) + 1) / prog.initCount);
    },
    endInitFunction: function (d) { phaseProgress(d.type || prog.phase, 1); },
    startDataFileEntries: function (d) {
      prog.mapCount = Number(d.count) || 0;
      prog.mapDone = 0;
      phaseProgress('MAP', 0);
      setStatus(PHASE_TEXT.MAP, false);
    },
    performMapLoadFunction: function () {
      prog.mapDone++;
      if (prog.mapCount) phaseProgress('MAP', prog.mapDone / prog.mapCount);
    },
    endDataFileEntries: function () { phaseProgress('MAP', 1); }
  };

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || typeof d !== 'object' || typeof d.eventName !== 'string') return;
    if (!d.__lsSim) {                            // real FiveM data arrived - drop the preview
      prog.real = true;
      clearTimeout(sim.startTimer);
      if (sim.running) stopSim();
    }
    if (d.eventName === 'lsDiag') { sendDiag(); return; }   // sent by client/main.lua
    var h = handlers[d.eventName];
    if (h) { try { h(d); } catch (err) { console.warn('[loadingscreen]', err); } }
  });

  /* ---------------------------------------------------------------------------
     Preview mode: outside FiveM there are no load events, so fake them
     --------------------------------------------------------------------------- */
  var inFiveM = typeof window.invokeNative === 'function' || typeof window.GetParentResourceName === 'function' ||
    !!window.nuiHandoverData;
  var SIM_LINES = [
    'Mounting resources',
    'Downloading content (38.4 MB / 126.9 MB)',
    'Loading ox_lib',
    'Loading qbx_core',
    'Loading ox_inventory',
    'Streaming map data',
    'Loading collision',
    'Building world',
    'Initializing session'
  ];

  function startSim() {
    sim.running = true;
    var f = 0, li = 0;
    var post = function (d) { d.__lsSim = true; window.postMessage(d, '*'); };
    post({ eventName: 'onLogLine', message: 'Initializing game' });
    sim.pv = setInterval(function () {
      if (Math.random() < 0.15) return;            // the odd stall, like the real thing
      f = Math.min(1, f + 0.004 + Math.random() * 0.012);
      post({ eventName: 'loadProgress', loadFraction: f });
      if (f >= 1) stopSim();
    }, 320);
    sim.lv = setInterval(function () {
      post({ eventName: 'onLogLine', message: SIM_LINES[li++ % SIM_LINES.length] });
    }, 2600);
  }

  function stopSim() {
    sim.running = false;
    clearInterval(sim.pv);
    clearInterval(sim.lv);
  }

  // In game the first load events arrive right away; the preview only starts if none came.
  if (!inFiveM) sim.startTimer = setTimeout(function () { if (!prog.real) startSim(); }, 2500);

  /* ---------------------------------------------------------------------------
     Diagnostics: one line per player in the server console saying whether the
     music played (and if not, what YouTube answered). Sent to client/main.lua
     through a NUI callback once the resource's client script is running.
     --------------------------------------------------------------------------- */
  var diag = {
    page: location.origin || location.protocol,
    parents: (function () {
      try { return Array.prototype.slice.call(location.ancestorOrigins || []).join(' > '); } catch (e) { return ''; }
    })(),
    handover: handover ? 'config' : (window.nuiHandoverData ? 'no config' : 'none'),
    relay: !!CFG.youtubeRelay,
    result: 'pending',
    videos: {}
  };
  var diagState = { sent: false, busy: false, tries: 0, timer: 0 };

  function sendDiag() {
    if (diagState.sent || diagState.busy || !(inFiveM || prog.real)) return;
    clearTimeout(diagState.timer);
    diagState.busy = true;
    var settled = false;
    var finish = function (ok) {
      if (settled) return;
      settled = true;
      diagState.busy = false;
      if (ok) { diagState.sent = true; return; }
      if (++diagState.tries < 40) diagState.timer = setTimeout(sendDiag, 3000);
    };
    setTimeout(function () { finish(false); }, 4000);
    try {
      fetch('https://' + CFG.resource + '/diag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(diag)
      }).then(function (r) { finish(!!(r && r.ok)); }, function () { finish(false); });
    } catch (err) { finish(false); }
  }

  function diagResult(text) {
    if (diag.result !== 'pending') return;
    diag.result = text;
    sendDiag();
  }

  /* ---------------------------------------------------------------------------
     Music player (YouTube IFrame API) - the videos are the background
     --------------------------------------------------------------------------- */
  var ST = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };
  var list = CFG.playlist;

  var yt = {
    player: null, ready: false, fallback: null,
    index: 0, dir: 1, dead: {}, fails: 0,
    state: ST.UNSTARTED, switching: true,
    intentPlay: true,             // false only when the viewer paused
    muted: false,                 // viewer's own mute (remembered)
    autoMuted: false,             // we muted because autoplay with sound was blocked
    volume: CFG.startVolume,
    apiTimer: 0, readyTimer: 0, apTimer: 0, stallTimer: 0, showTimer: 0, progIv: 0, saveTimer: 0
  };

  var titleEl = $('trkTitle');
  var artistEl = $('trkArtist');
  var progFill = $('trkProg');
  var volRange = $('volRange');
  var btnPlay = $('btnPlay');
  var btnMute = $('btnMute');
  var hintEl = $('soundHint');

  // ---- remembered volume -----------------------------------------------------
  try {
    var sv = localStorage.getItem('ls.volume');
    if (sv !== null && sv !== '' && isFinite(+sv)) yt.volume = Math.round(clamp(+sv, 0, 100));
    yt.muted = localStorage.getItem('ls.muted') === '1';
  } catch (e) { /* storage unavailable - use config defaults */ }

  function savePrefs() {
    clearTimeout(yt.saveTimer);
    yt.saveTimer = setTimeout(function () {
      try {
        localStorage.setItem('ls.volume', String(yt.volume));
        localStorage.setItem('ls.muted', yt.muted ? '1' : '0');
      } catch (e) { /* ignore */ }
    }, 150);
  }

  function call(method) {
    var p = yt.player;
    if (!p || typeof p[method] !== 'function') return undefined;
    try { return p[method].apply(p, Array.prototype.slice.call(arguments, 1)); } catch (e) { return undefined; }
  }

  // ---- track title -------------------------------------------------------------
  var TAG_RE = /\s*[(\[{][^)\]}]*\b(official|video|audio|lyrics?|visuali[sz]er|exclusive|hd|hq|4k|explicit|clean|mv)\b[^)\]}]*[)\]}]/gi;

  // "Wiz Khalifa - Black And Yellow [Official Music Video]" -> Black And Yellow / Wiz Khalifa
  function tidy(title, artist) {
    var t = title.replace(TAG_RE, '').replace(/\s{2,}/g, ' ').trim();
    var a = artist.replace(/\s*-\s*topic$/i, '').replace(/vevo$/i, '').trim();
    var dash = t.match(/^(.+?)\s+[-–—]\s+(.+)$/);
    if (dash) {
      a = dash[1].trim();
      t = dash[2].trim();
    } else {
      var q = t.match(/^(.*?)\s*["“”]([^"“”]+)["“”]/);
      if (q) {
        if (q[1].trim()) a = q[1].trim();
        t = q[2].trim();
      }
    }
    return { title: t || title, artist: a || artist };
  }

  function setTrack(title, artist) {
    var t = str(title), a = str(artist);
    if (CFG.tidyTitles && t) { var c = tidy(t, a); t = c.title; a = c.artist; }
    titleEl.textContent = t || 'Now playing';
    artistEl.textContent = a || ' ';
    titleEl.title = t;
  }

  function current() { return list[yt.index]; }

  function trackFromPlayer() {
    var e = current();
    var d = call('getVideoData');
    if (d && d.title && (!d.video_id || d.video_id === e.id)) setTrack(d.title, d.author);
    else setTrack(e.title, e.artist);
  }

  function setTrackProgress(f) {
    progFill.style.transform = 'scaleX(' + clamp(f || 0, 0, 1).toFixed(4) + ')';
  }

  // ---- UI state ------------------------------------------------------------------
  function silent() { return yt.muted || yt.autoMuted || yt.volume === 0; }

  function syncUI() {
    body.classList.toggle('user-paused', !yt.intentPlay);
    body.classList.toggle('is-audible', yt.state === ST.PLAYING && yt.intentPlay && !silent());
    btnPlay.setAttribute('aria-label', yt.intentPlay ? 'Pause' : 'Play');
    volRange.value = String(yt.volume);
    volRange.style.setProperty('--fill', yt.volume + '%');
    volRange.classList.toggle('is-muted', silent());
    btnMute.setAttribute('data-level', silent() ? '0' : yt.volume < 50 ? '1' : '2');
    btnMute.setAttribute('aria-label', silent() ? 'Unmute' : 'Mute');
  }

  function applyVolume() {
    if (yt.ready) {
      call('setVolume', yt.volume);
      if (yt.muted || yt.autoMuted) call('mute'); else call('unMute');
    }
    syncUI();
  }

  function showVideo(on) {
    clearTimeout(yt.showTimer);
    if (!on) { body.classList.remove('video-on'); return; }
    // tiny delay so the first decoded frame is on screen before fading in
    yt.showTimer = setTimeout(function () {
      if (!yt.fallback && yt.intentPlay && yt.state === ST.PLAYING) body.classList.add('video-on');
    }, 180);
  }

  // ---- fallback: animated gradient only, player removed ---------------------------
  function fallback(reason) {
    if (yt.fallback) return;
    yt.fallback = reason;
    console.warn('[loadingscreen] music video disabled: ' + reason);
    diagResult('failed: ' + reason);
    var off = document.getElementById('musicOff');
    if (off) off.textContent = 'Music unavailable \u00B7 ' + reason;
    body.classList.add('is-fallback');
    body.classList.remove('video-on', 'player-ready', 'is-audible', 'user-paused');
    clearTimeout(yt.readyTimer); clearTimeout(yt.apTimer); clearTimeout(yt.stallTimer); clearTimeout(yt.showTimer);
    clearInterval(yt.progIv);
    hintEl.hidden = true;
    if (yt.player) { call('stopVideo'); call('destroy'); }
    yt.player = null;
    yt.ready = false;
  }

  // ---- playlist navigation ----------------------------------------------------------
  function isDead(i) { return !!yt.dead[list[i].id]; }

  function go(i, dir) {
    if (!yt.ready || yt.fallback) return;
    var n = list.length;
    var idx = ((i % n) + n) % n;
    for (var guard = 0; isDead(idx) && guard < n; guard++) idx = (((idx + dir) % n) + n) % n;
    if (isDead(idx)) { fallback('every video failed to play'); return; }

    yt.index = idx;
    yt.dir = dir;
    yt.switching = true;
    yt.state = ST.UNSTARTED;
    showVideo(false);
    setTrackProgress(0);
    var e = current();
    setTrack(e.title, e.artist);
    var args = { videoId: e.id, startSeconds: e.start || 0 };
    if (yt.intentPlay) call('loadVideoById', args); else call('cueVideoById', args);
    armStallWatch();
    syncUI();
  }

  function next() { if (yt.ready) { yt.intentPlay = true; go(yt.index + 1, 1); } }
  function prev() { if (yt.ready) { yt.intentPlay = true; go(yt.index - 1, -1); } }

  function togglePlay() {
    if (!yt.ready || yt.fallback) return;
    yt.intentPlay = !yt.intentPlay;
    if (yt.intentPlay) {
      call('playVideo');                 // fades back in on PLAYING
      armStallWatch();
    } else {
      call('pauseVideo');
      clearTimeout(yt.stallTimer);
      showVideo(false);                  // fade to the ambient background: YouTube's pause overlay never shows
    }
    syncUI();
  }

  function toggleMute() {
    if (!yt.ready || yt.fallback) return;
    if (yt.autoMuted) { enableSound(); return; }
    yt.muted = !yt.muted;
    if (!yt.muted && yt.volume === 0) yt.volume = Math.max(CFG.startVolume, 10);
    applyVolume();
    savePrefs();
  }

  // ---- autoplay with sound blocked -> play muted + hint ----------------------------
  function forceMutedAutoplay() {
    if (yt.fallback || yt.autoMuted || yt.muted) { call('playVideo'); return; }
    yt.autoMuted = true;
    call('mute');
    call('playVideo');
    hintEl.hidden = false;
    syncUI();
  }

  function enableSound() {
    if (!yt.autoMuted) return;
    yt.autoMuted = false;
    yt.muted = false;
    hintEl.hidden = true;
    applyVolume();
    if (yt.intentPlay) call('playVideo');
    savePrefs();
  }

  function armAutoplayCheck() {
    clearTimeout(yt.apTimer);
    var extra = 0;
    var check = function () {
      if (!yt.ready || yt.fallback || !yt.intentPlay) return;
      var s = call('getPlayerState');
      if (s === ST.PLAYING) return;
      if (s === ST.BUFFERING && extra++ < 4) { yt.apTimer = setTimeout(check, 1500); return; }  // slow network, not blocked
      forceMutedAutoplay();
    };
    yt.apTimer = setTimeout(check, 3000);
  }

  // A video that never starts (and never errors) counts as a failure after 30s.
  function armStallWatch() {
    clearTimeout(yt.stallTimer);
    yt.stallTimer = setTimeout(function () {
      if (!yt.ready || yt.fallback || !yt.intentPlay || yt.state === ST.PLAYING) return;
      onError({ data: 'stalled' });
    }, 30000);
  }

  // ---- player events ---------------------------------------------------------------
  function onReady() {
    if (yt.fallback) return;
    yt.ready = true;
    clearTimeout(yt.readyTimer);
    trackFromPlayer();
    applyVolume();
    yt.progIv = setInterval(progressTick, 250);
    if (yt.pendingSkip) { yt.pendingSkip = false; go(yt.index + 1, 1); }
    else if (yt.intentPlay) call('playVideo');
    armAutoplayCheck();
    armStallWatch();
  }

  function onStateChange(e) {
    if (yt.fallback) return;
    var s = e && typeof e.data === 'number' ? e.data : ST.UNSTARTED;
    yt.state = s;
    if (s === ST.PLAYING) {
      yt.fails = 0;
      yt.switching = false;
      clearTimeout(yt.stallTimer);
      body.classList.add('player-ready');   // controls appear with the first video that actually plays
      if (current()) diag.videos[current().id] = 'playing';
      diagResult('playing');
      trackFromPlayer();
      showVideo(true);
    } else if (s === ST.ENDED) {
      next();
    }
    syncUI();
  }

  // 2 bad parameter, 5 HTML5 player error, 100 removed/private,
  // 101/150 embedding disabled, 153 missing referrer - skip to the next video.
  function onError(e) {
    if (yt.fallback || !list.length) return;
    var code = e ? e.data : '?';
    yt.lastCode = code;
    var entry = current();
    console.warn('[loadingscreen] YouTube error ' + code + ' on ' + entry.id + ' - skipping');
    diag.videos[entry.id] = 'error ' + code;
    if (code !== 5 && code !== 'stalled') yt.dead[entry.id] = true;   // permanent problem: don't retry
    yt.fails++;
    var allDead = list.every(function (x) { return yt.dead[x.id]; });
    if (allDead || yt.fails >= list.length) { fallback('YouTube error ' + code); return; }
    if (!yt.ready) { yt.pendingSkip = true; return; }                 // player API not usable yet
    go(yt.index + yt.dir, yt.dir);
  }

  function progressTick() {
    if (!yt.ready || yt.fallback || yt.switching) return;
    var cur = Number(call('getCurrentTime')) || 0;
    var dur = Number(call('getDuration')) || 0;
    if (dur > 0) setTrackProgress(cur / dur);
    // hop to the next video just before the end so YouTube's end screen never shows
    if (yt.state === ST.PLAYING && dur > 10 && dur - cur < 0.7) next();
  }

  // ---- load the API ------------------------------------------------------------------
  function createPlayer() {
    var first = current();
    var vars = {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      rel: 0,
      iv_load_policy: 3,
      modestbranding: 1,
      playsinline: 1,
      fs: 0,
      enablejsapi: 1,
      start: first.start || 0
    };
    if (window.location.origin && window.location.origin !== 'null') vars.origin = window.location.origin;

    try {
      yt.player = new window.YT.Player('ytPlayer', {
        width: '100%',
        height: '100%',
        videoId: first.id,
        playerVars: vars,
        events: {
          onReady: onReady,
          onStateChange: onStateChange,
          onError: onError,
          onAutoplayBlocked: forceMutedAutoplay
        }
      });
    } catch (err) {
      fallback('could not create the YouTube player');
      return;
    }
    setTrack(first.title, first.artist);
    yt.readyTimer = setTimeout(function () { if (!yt.ready) fallback('YouTube player never became ready'); }, 20000);
  }

  function onApiReady() {
    clearTimeout(yt.apiTimer);
    if (yt.player) return;
    if (yt.fallback) {
      if (yt.fallback !== 'YouTube API timed out') return;
      yt.fallback = null;                      // the API was just slow - recover
      body.classList.remove('is-fallback');
    }
    if (window.YT && typeof window.YT.Player === 'function') createPlayer();
    else fallback('YouTube API unusable');
  }

  // ---- relay: YouTube refuses embeds from pages without a normal web address (error 153),
  // and FiveM loading screens don't have one. The server hosts a tiny page (relay.html) that
  // embeds the player for us; this object mimics YT.Player and talks to it with postMessage.
  function RelayPlayer(elId, opts) {
    var self = this;
    var host = document.getElementById(elId);
    var ifr = document.createElement('iframe');
    ifr.id = host.id;
    ifr.setAttribute('frameborder', '0');
    ifr.setAttribute('allow', 'autoplay; encrypted-media');
    ifr.src = CFG.youtubeRelay;
    host.parentNode.replaceChild(ifr, host);
    this.i = ifr;
    this.ev = opts.events || {};
    this.st = { t: 0, d: 0, s: -1, v: null };
    this.opts = opts;
    this.onMsg = function (e) {
      if (e.source !== ifr.contentWindow) return;
      var m = e.data;
      if (!m || !m.lsRelay) return;
      if (m.type === 'api') {
        yt.relayAlive = true;
        var vars = {};
        for (var k in opts.playerVars) if (k !== 'origin') vars[k] = opts.playerVars[k];
        self.post('create', [opts.videoId, vars]);
      } else if (m.type === 'ready') {
        self.emit('onReady');
      } else if (m.type === 'state') {
        self.st.s = m.data;
        self.emit('onStateChange', m.data);
      } else if (m.type === 'error') {
        self.emit('onError', m.data);
      } else if (m.type === 'autoplayBlocked') {
        self.emit('onAutoplayBlocked');
      } else if (m.type === 'status' && m.data) {
        self.st = m.data;
      }
    };
    window.addEventListener('message', this.onMsg);
  }
  RelayPlayer.prototype.emit = function (name, data) {
    var f = this.ev[name];
    if (f) f({ target: this, data: data });
  };
  RelayPlayer.prototype.post = function (cmd, args) {
    if (this.i && this.i.contentWindow) this.i.contentWindow.postMessage({ lsRelayCmd: cmd, args: args || [] }, '*');
  };
  ['playVideo', 'pauseVideo', 'stopVideo', 'mute', 'unMute', 'setVolume', 'loadVideoById', 'cueVideoById'].forEach(function (n) {
    RelayPlayer.prototype[n] = function () { this.post(n, Array.prototype.slice.call(arguments)); };
  });
  RelayPlayer.prototype.getCurrentTime = function () { return this.st.t || 0; };
  RelayPlayer.prototype.getDuration = function () { return this.st.d || 0; };
  RelayPlayer.prototype.getPlayerState = function () { return this.st.s; };
  RelayPlayer.prototype.getVideoData = function () { return this.st.v; };
  RelayPlayer.prototype.destroy = function () {
    window.removeEventListener('message', this.onMsg);
    var host = document.createElement('div');
    host.id = 'ytPlayer';
    if (this.i && this.i.parentNode) this.i.parentNode.replaceChild(host, this.i);
    this.i = null;
  };

  // relay first; if it doesn't answer, go back to embedding YouTube directly
  function loadRelay() {
    yt.relayTried = true;
    window.YT = { Player: RelayPlayer };
    onApiReady();
    yt.relayTimer = setTimeout(function () {
      if (yt.relayAlive || yt.fallback) return;
      console.warn('[loadingscreen] relay did not answer, embedding YouTube directly');
      clearTimeout(yt.readyTimer);
      if (yt.player) yt.player.destroy();
      yt.player = null;
      window.YT = undefined;
      loadDirect();
    }, 8000);
  }

  function loadApi() {
    if (!list.length) { fallback('playlist is empty'); return; }
    if (CFG.youtubeRelay) { loadRelay(); return; }
    loadDirect();
  }

  function loadDirect() {
    window.onYouTubeIframeAPIReady = onApiReady;
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = function () { fallback('YouTube API failed to load (offline?)'); };
    document.head.appendChild(s);
    yt.apiTimer = setTimeout(function () {
      if (!yt.player) fallback('YouTube API timed out');
    }, 15000);
  }

  // ---- controls ----------------------------------------------------------------------
  $('btnPrev').addEventListener('click', prev);
  $('btnNext').addEventListener('click', next);
  btnPlay.addEventListener('click', togglePlay);
  btnMute.addEventListener('click', toggleMute);
  hintEl.addEventListener('click', enableSound);

  // buttons shouldn't keep focus after a mouse click (keeps Space/arrows for the shortcuts)
  Array.prototype.forEach.call(document.querySelectorAll('.pbtn, .sound-hint'), function (b) {
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
  });

  volRange.addEventListener('input', function () {
    yt.volume = Math.round(clamp(Number(volRange.value) || 0, 0, 100));
    if (yt.volume > 0) {
      yt.muted = false;
      if (yt.autoMuted) { yt.autoMuted = false; hintEl.hidden = true; }
    }
    applyVolume();
    savePrefs();
  });
  // after a mouse drag give focus back to the page so Left/Right skip tracks again
  volRange.addEventListener('pointerup', function () { volRange.blur(); });

  // any click while autoplay-muted counts as "enable sound" (except the volume controls themselves)
  document.addEventListener('pointerdown', function (e) {
    if (!yt.autoMuted) return;
    var t = e.target;
    if (t && t.closest && t.closest('#btnMute, #volRange, #soundHint')) return;
    enableSound();
  }, true);

  // Space = play/pause, Left/Right = previous/next, M = mute
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var key = e.key || '';
    if (key === ' ' || key === 'Spacebar' || (!key && e.code === 'Space')) {
      e.preventDefault();
      if (!e.repeat) togglePlay();
    } else if (key === 'ArrowRight' || key === 'Right' || key === 'ArrowLeft' || key === 'Left') {
      if (e.target === volRange) return;          // a focused slider uses the arrows for volume
      e.preventDefault();
      if (e.repeat) return;
      if (key === 'ArrowRight' || key === 'Right') next(); else prev();
    } else if (key === 'm' || key === 'M') {
      if (!e.repeat) toggleMute();
    }
  });
  document.addEventListener('keyup', function (e) {
    if (e.key === ' ' || e.code === 'Space') e.preventDefault();   // no extra "click" on a focused button
  });

  syncUI();
  loadApi();

  // for debugging in the NUI devtools
  window.LoadingScreen = { config: CFG, player: yt, progress: prog, next: next, prev: prev, togglePlay: togglePlay, toggleMute: toggleMute };
})();
