// floatingPanel.js — ResumeFit v3.1
// Shadow DOM. Draggable FAB. 4 tabs: Match | Tracker | Info | Settings
// Auto-injects on known job boards. Can also be manually injected from the popup.

(function () {
    if (document.getElementById("rf-host")) return;

    // ── Job-site guard ────────────────────────────────────────
    // Auto-injection (via content_scripts) only fires on known job domains.
    // Manual injection from the popup bypasses this via chrome.scripting,
    // which sets rf_manual_inject = true before calling this script.
    const KNOWN_JOB_PATTERNS = [
      /linkedin\.com\/jobs/i,
      /greenhouse\.io/i,
      /lever\.co/i,
      /ashbyhq\.com/i,
      /myworkdayjobs\.com/i,
      /workday\.com/i,
      /smartrecruiters\.com/i,
      /indeed\.com/i,
      /jobvite\.com/i,
      /icims\.com/i,
      /taleo\.net/i,
      /oraclecloud\.com\/hcmUI/i,
      /rippling\.com\/jobs/i,
      /wellfound\.com\/jobs/i,
      /ycombinator\.com\/jobs/i,
      /careers\.microsoft\.com/i,
      /careers\.google\.com/i,
      /amazon\.jobs/i,
      /meta\.com\/careers/i,
      /apple\.com\/careers/i,
      /netflix\.com\/jobs/i,
    ];

    const isKnownJobPage = KNOWN_JOB_PATTERNS.some(p => p.test(location.href));
    const isManualInject = window.__rf_manual_inject === true;

    if (!isKnownJobPage && !isManualInject) return;
  
    const STORAGE_KEY   = "resume_selector_resumes_min_v1";
    const TRACKER_KEY   = "resumefit_applications_v1";
    const SETTINGS_KEY  = "resumefit_settings_v1";
    const FAB_POS_KEY   = "rf_fab_pos";
    const QUICKINFO_KEY = "resumefit_quickinfo_v1";
  
    const storageGet = (k, fb) => new Promise(r => chrome.storage.local.get([k], d => r(d[k] ?? fb)));
    const storageSet = (k, v)  => new Promise(r => chrome.storage.local.set({ [k]: v }, r));
    const uid = () => Math.random().toString(36).slice(2, 10);
    const norm = t => (t||"").toLowerCase()
      .replace(/[""]/g,'"').replace(/['']/g,"'")
      .replace(/\u00A0/g," ").replace(/\s+/g," ").trim();
  
    // ── Shadow host ───────────────────────────────────────────
    const host = document.createElement("div");
    host.id = "rf-host";
    host.style.cssText = "all:initial!important;position:fixed!important;top:0!important;" +
      "left:0!important;width:0!important;height:0!important;" +
      "z-index:2147483647!important;overflow:visible!important;";
    document.documentElement.appendChild(host);
    const S = host.attachShadow({ mode: "open" });
  
    // ── Styles ────────────────────────────────────────────────
    const styleEl = document.createElement("style");
    styleEl.textContent = `
  *, *::before, *::after {
    box-sizing: border-box; margin: 0; padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  }
  
  /* ── FAB ── */
  #fab {
    position: fixed; top: 72px; right: 20px;
    width: 44px; height: 44px; border-radius: 50%;
    background: #5b4ef8; border: 2px solid rgba(255,255,255,.25);
    cursor: grab; display: flex; align-items: center; justify-content: center;
    font-size: 19px; box-shadow: 0 4px 16px rgba(91,78,248,.5);
    user-select: none; touch-action: none;
    transition: box-shadow .15s, transform .15s; z-index: 2147483647;
  }
  #fab:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(91,78,248,.65); }
  #fab.dragging { cursor: grabbing; transition: none; transform: scale(1.12); }
  #tip {
    position: fixed; background: #111827; color: #fff;
    font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px;
    white-space: nowrap; pointer-events: none; opacity: 0;
    transition: opacity .12s; z-index: 2147483646;
  }
  #tip.show { opacity: 1; }
  
  /* ── Panel ── */
  #panel {
    position: fixed; width: 340px;
    max-height: min(580px, calc(100vh - 24px));
    background: #fff; border-radius: 16px;
    border: 1px solid #e2e4ea;
    box-shadow: 0 0 0 1px rgba(0,0,0,.03), 0 12px 40px rgba(0,0,0,.18);
    display: none; flex-direction: column;
    overflow: hidden; z-index: 2147483646;
  }
  #panel.open {
    display: flex;
    animation: rfpop .18s cubic-bezier(.34,1.5,.64,1) both;
  }
  @keyframes rfpop { from{opacity:0;transform:scale(.88)} to{opacity:1;transform:scale(1)} }
  
  /* ── Header ── */
  .ph {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 14px 11px; border-bottom: 1px solid #f0f1f4; flex-shrink: 0;
  }
  .ph-left { display: flex; align-items: center; gap: 9px; }
  .ph-logo {
    width: 30px; height: 30px; border-radius: 9px; background: #ede9fe;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px; flex-shrink: 0;
  }
  .ph-name { font-size: 13.5px; font-weight: 800; color: #09090b; letter-spacing: -.3px; }
  .ph-sub  { font-size: 10px; color: #9ca3af; margin-top: 1px; }
  .x-btn {
    width: 26px; height: 26px; border-radius: 7px; border: none;
    background: #f3f4f6; color: #6b7280; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; transition: background .1s; flex-shrink: 0;
  }
  .x-btn:hover { background: #e5e7eb; color: #111; }
  
  /* ── Tabs ── */
  .tabs {
    display: flex; border-bottom: 1px solid #f0f1f4;
    padding: 0 14px; flex-shrink: 0;
  }
  .tab-btn {
    font-size: 11px; font-weight: 700; padding: 8px 9px;
    border: none; background: none; cursor: pointer; color: #9ca3af;
    border-bottom: 2px solid transparent; letter-spacing: .01em;
    transition: color .12s, border-color .12s; margin-bottom: -1px;
  }
  .tab-btn.active { color: #5b4ef8; border-bottom-color: #5b4ef8; }
  .tab-btn:hover:not(.active) { color: #6b7280; }
  
  /* ── Body ── */
  .pb {
    overflow-y: auto; overflow-x: hidden;
    padding: 13px 14px; display: flex; flex-direction: column; gap: 11px;
  }
  .pb::-webkit-scrollbar { width: 3px; }
  .pb::-webkit-scrollbar-thumb { background: #e2e4ea; border-radius: 3px; }
  .tab-pane { display: none; flex-direction: column; gap: 11px; }
  .tab-pane.active { display: flex; }
  
  /* ── Action row ── */
  .action-row { display: flex; align-items: center; gap: 6px; }
  .btn-analyze {
    flex: 1; padding: 8px 10px; border-radius: 8px; border: none;
    background: #5b4ef8; color: #fff;
    font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap;
    box-shadow: 0 2px 10px rgba(91,78,248,.3);
    transition: background .12s, transform .12s;
  }
  .btn-analyze:hover:not(:disabled) { background: #4b40e8; transform: translateY(-1px); }
  .btn-analyze:disabled { opacity: .55; cursor: not-allowed; transform: none; }
  .btn-log {
    padding: 7px 10px; border-radius: 8px;
    border: 1px solid #86efac; background: #f0fdf4; color: #15803d;
    font-size: 11.5px; font-weight: 700; cursor: pointer; white-space: nowrap;
    transition: background .12s; flex-shrink: 0;
  }
  .btn-log:hover { background: #dcfce7; }
  .btn-log.hidden { display: none; }
  .src-badge {
    padding: 5px 8px; border-radius: 7px; font-size: 10px; font-weight: 600;
    border: 1px solid; white-space: nowrap; flex-shrink: 0; cursor: default;
  }
  .src-badge.hidden { display: none; }
  .src-sel  { color: #15803d; background: #f0fdf4; border-color: #86efac; }
  .src-css  { color: #4338ca; background: #eef2ff; border-color: #c7d2fe; }
  .src-fall { color: #92400e; background: #fffbeb; border-color: #fcd34d; }
  .logged-tag {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 6px 9px; border-radius: 8px;
    background: #f0fdf4; border: 1px solid #86efac;
    color: #15803d; font-size: 11px; font-weight: 700;
    white-space: nowrap; flex-shrink: 0;
  }
  
  /* ── Score card ── */
  .score-card {
    display: flex; align-items: center; gap: 13px;
    background: #f9fafb; border: 1px solid #e5e7eb;
    border-radius: 12px; padding: 12px 14px;
  }
  .score-ring svg { display: block; overflow: visible; }
  .ring-track { fill: none; }
  .ring-fill  { fill: none; stroke-linecap: round; transition: stroke-dashoffset .65s ease; }
  .ring-num   { font-size: 13px; font-weight: 800; dominant-baseline: central; text-anchor: middle; }
  .ring-pct   { font-size: 6.5px; dominant-baseline: central; text-anchor: middle; }
  .score-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .score-lbl  { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #9ca3af; }
  .score-name {
    font-size: 15px; font-weight: 800; color: #09090b; letter-spacing: -.3px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .score-sub { font-size: 11px; color: #6b7280; }
  .pill {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 9px 3px 7px; border-radius: 20px;
    font-size: 10.5px; font-weight: 700; border: 1px solid; width: fit-content;
  }
  .pill-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .pill-high   { color: #15803d; background: #f0fdf4; border-color: #86efac; }
  .pill-high   .pill-dot { background: #16a34a; }
  .pill-medium { color: #92400e; background: #fffbeb; border-color: #fcd34d; }
  .pill-medium .pill-dot { background: #d97706; }
  .pill-low    { color: #991b1b; background: #fef2f2; border-color: #fca5a5; }
  .pill-low    .pill-dot { background: #dc2626; }
  
  /* ── Skills ── */
  .skills-bar-row { display: flex; align-items: center; gap: 8px; }
  .skills-bar-track { flex: 1; height: 5px; border-radius: 4px; background: #f0f1f4; overflow: hidden; }
  .skills-bar-fill  { height: 100%; border-radius: 4px; transition: width .5s ease; }
  .skills-bar-lbl   { font-size: 10.5px; font-weight: 700; flex-shrink: 0; }
  .skill-section { display: flex; flex-direction: column; gap: 5px; }
  .skill-section-lbl {
    font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #9ca3af;
  }
  .chip-row { display: flex; flex-wrap: wrap; gap: 4px; }
  .chip {
    display: inline-flex; align-items: center;
    font-size: 10.5px; font-weight: 600; padding: 2px 8px;
    border-radius: 5px; font-family: "SF Mono","Fira Code",monospace;
  }
  .chip-match { background: #f0fdf4; color: #15803d; border: 1px solid #86efac; }
  .chip-miss  { background: #fffbeb; color: #92400e; border: 1px solid #fcd34d; }
  
  /* ── Misc ── */
  .divider { height: 1px; background: #f0f1f4; flex-shrink: 0; }
  .empty {
    text-align: center; padding: 28px 14px;
    color: #9ca3af; font-size: 12.5px; line-height: 1.65;
  }
  .empty strong { display: block; color: #6b7280; font-size: 13px; margin-bottom: 5px; }
  @keyframes rfpulse { 0%,100%{opacity:1} 50%{opacity:.25} }
  .loading { animation: rfpulse 1.1s ease infinite; color: #9ca3af; font-style: italic; }
  
  /* ── AI nudge (no key set) ── */
  .ai-nudge {
    display: flex; align-items: center; gap: 7px;
    font-size: 11.5px; color: #9ca3af; cursor: pointer;
    padding: 8px 11px; border-radius: 9px;
    border: 1px dashed #e2e4ea; transition: all .15s;
  }
  .ai-nudge:hover { background: #ede9fe; border-color: #c7d2fe; color: #4338ca; }
  .ai-nudge strong { color: #4338ca; }
  
  /* ── AI suggestions ── */
  .ai-box { background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 10px; padding: 11px 13px; }
  .ai-lbl {
    font-size: 9.5px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .08em; color: #7c3aed; margin-bottom: 7px;
  }
  .ai-body { font-size: 12px; color: #374151; line-height: 1.65; white-space: pre-wrap; }
  
  
  
  
  /* ── Quick-copy icon bar (below match results) ── */
  .qc-bar-lbl {
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .1em; color: #9ca3af; margin-bottom: 7px;
  }
  .qc-bar {
    display: flex; gap: 7px;
  }
  /* Icon-only square buttons — same style as popup */
  .qc-btn {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 4px; flex: 1; padding: 9px 4px 7px;
    border-radius: 9px; border: 1px solid #e5e7eb; background: #f9fafb;
    color: #374151; cursor: pointer; transition: all .13s; min-width: 0;
  }
  .qc-btn:hover { background: #ede9fe; border-color: #c4b5fd; color: #4338ca; }
  .qc-btn.ok    { background: #f0fdf4; border-color: #86efac; color: #15803d; }
  .qc-btn svg   { width: 15px; height: 15px; flex-shrink: 0; }
  .qc-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; white-space: nowrap; }
  
  /* ── TRACKER ── */
  .trk-empty { text-align: center; padding: 28px 14px; color: #9ca3af; font-size: 12px; line-height: 1.6; }
  .trk-empty strong { display: block; color: #6b7280; font-size: 13px; margin-bottom: 5px; }
  .trk-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 7px; }
  .trk-stat {
    background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px;
    padding: 10px 8px; text-align: center;
  }
  .trk-stat-num { font-size: 18px; font-weight: 800; color: #09090b; letter-spacing: -.5px; }
  .trk-stat-lbl { font-size: 10px; color: #9ca3af; margin-top: 2px; font-weight: 600; }
  .trk-list { display: flex; flex-direction: column; gap: 6px; }
  .trk-card {
    background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
    padding: 9px 12px; display: flex; flex-direction: column; gap: 4px;
  }
  .trk-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .trk-title {
    font-size: 12.5px; font-weight: 700; color: #09090b;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0;
  }
  .trk-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; }
  .trk-resume { font-size: 10.5px; color: #6b7280; }
  .trk-score {
    font-size: 10.5px; font-weight: 700; padding: 2px 7px;
    border-radius: 5px; border: 1px solid;
  }
  .trk-score.high   { color: #15803d; background: #f0fdf4; border-color: #86efac; }
  .trk-score.medium { color: #92400e; background: #fffbeb; border-color: #fcd34d; }
  .trk-score.low    { color: #991b1b; background: #fef2f2; border-color: #fca5a5; }
  .trk-date { font-size: 10px; color: #9ca3af; margin-left: auto; white-space: nowrap; }
  .trk-del {
    border: none; background: none; cursor: pointer;
    color: #d1d5db; font-size: 12px; flex-shrink: 0; padding: 0 2px;
  }
  .trk-del:hover { color: #dc2626; }
  .trk-hint {
    font-size: 10.5px; color: #6b7280; line-height: 1.5;
    background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 9px 11px;
  }
  .trk-hint strong { color: #4338ca; }
  
  /* ── QUICK INFO ── */
  /* ── QUICK INFO TAB — matches popup.css form style ── */
  .qi-quick-lbl {
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .1em; color: #9ca3af; margin-bottom: 8px;
  }
  .qi-form-fields { display: flex; flex-direction: column; gap: 9px; }
  .qi-form-row    { display: flex; flex-direction: column; gap: 4px; }
  .qi-form-lbl    { font-size: 12px; font-weight: 600; color: #374151; }
  .qi-form-input {
    background: #f3f4f6; border: 1px solid #e4e4e7; border-radius: 9px;
    color: #09090b; padding: 8px 11px;
    font-size: 12.5px; font-weight: 500; outline: none; width: 100%;
    transition: border-color .15s, box-shadow .15s;
  }
  .qi-form-input:focus {
    border-color: #5b4ef8; box-shadow: 0 0 0 3px rgba(91,78,248,.1);
  }
  .qi-form-input::placeholder { color: #c4c7d0; font-weight: 400; }
  .qi-save-btn {
    width: 100%; padding: 9px; border-radius: 9px; border: none;
    background: #ede9fe; border: 1px solid #c7d2fe; color: #4338ca;
    font-size: 13px; font-weight: 700; cursor: pointer; transition: background .12s;
  }
  .qi-save-btn:hover { background: #ddd6fe; }
  .qi-msg { font-size: 11.5px; color: #15803d; font-weight: 700; min-height: 18px; margin-top: 2px; }
  
  /* ── SETTINGS ── */
  .set-section { display: flex; flex-direction: column; gap: 8px; }
  .set-lbl {
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .09em; color: #9ca3af;
  }
  .set-card {
    background: #f9fafb; border: 1px solid #e5e7eb;
    border-radius: 10px; padding: 12px 13px; display: flex; flex-direction: column; gap: 9px;
  }
  .set-desc  { font-size: 11px; color: #6b7280; line-height: 1.5; }
  .set-select, .set-input {
    width: 100%; padding: 8px 10px; border-radius: 8px;
    border: 1px solid #e5e7eb; background: #fff;
    font-size: 12px; color: #09090b; outline: none; transition: border-color .12s;
  }
  .set-select:focus, .set-input:focus { border-color: #a5b4fc; }
  .set-key-row { display: flex; gap: 6px; }
  .set-key-row .set-input { flex: 1; }
  .set-eye {
    padding: 8px 10px; border-radius: 8px; border: 1px solid #e5e7eb;
    background: #fff; cursor: pointer; font-size: 13px; flex-shrink: 0;
    transition: background .12s;
  }
  .set-eye:hover { background: #f3f4f6; }
  .set-hint { font-size: 10.5px; color: #9ca3af; line-height: 1.4; }
  .set-btn-row { display: flex; gap: 7px; }
  .set-save {
    flex: 1; padding: 8px; border-radius: 8px; border: none;
    background: #5b4ef8; color: #fff; font-size: 12.5px; font-weight: 700;
    cursor: pointer; transition: background .12s;
  }
  .set-save:hover { background: #4b40e8; }
  .set-clear {
    padding: 8px 12px; border-radius: 8px;
    border: 1px solid #fca5a5; background: #fef2f2; color: #dc2626;
    font-size: 12px; font-weight: 600; cursor: pointer; transition: background .12s; white-space: nowrap;
  }
  .set-clear:hover { background: #fee2e2; }
  .set-status { font-size: 11.5px; font-weight: 600; min-height: 18px; }
  .set-ok  { color: #15803d; }
  .set-err { color: #dc2626; }
  .set-privacy { font-size: 10.5px; color: #9ca3af; line-height: 1.5; text-align: center; padding: 4px 0; }
    `;
    S.appendChild(styleEl);
  
    // ── FAB ──────────────────────────────────────────────────
    const fab = document.createElement("button");
    fab.id = "fab"; fab.textContent = "🎯";
    S.appendChild(fab);
  
    const tip = document.createElement("div");
    tip.id = "tip"; tip.textContent = "ResumeFit";
    S.appendChild(tip);
  
    (async () => {
      const pos = await storageGet(FAB_POS_KEY, null);
      if (pos?.top != null) applyFabPos(pos.top, pos.right);
    })();
  
    function applyFabPos(t, r) {
      fab.style.top   = Math.max(8, Math.min(window.innerHeight-52, t)) + "px";
      fab.style.right = Math.max(8, Math.min(window.innerWidth -52, r)) + "px";
    }
  
    let drag = null;
    fab.addEventListener("pointerdown", e => {
      if (e.button) return; e.preventDefault();
      const rc = fab.getBoundingClientRect();
      drag = { sx:e.clientX, sy:e.clientY, ot:rc.top, or:window.innerWidth-rc.right, moved:false };
      fab.setPointerCapture(e.pointerId);
      fab.classList.add("dragging"); tip.classList.remove("show");
    });
    fab.addEventListener("pointermove", e => {
      if (!drag) return;
      const dx=e.clientX-drag.sx, dy=e.clientY-drag.sy;
      if (!drag.moved && (Math.abs(dx)>4||Math.abs(dy)>4)) drag.moved=true;
      if (drag.moved) applyFabPos(drag.ot+dy, drag.or-dx);
    });
    fab.addEventListener("pointerup", () => {
      if (!drag) return;
      fab.classList.remove("dragging");
      if (!drag.moved) {
        togglePanel();
      } else {
        const rc=fab.getBoundingClientRect();
        storageSet(FAB_POS_KEY,{top:rc.top,right:window.innerWidth-rc.right});
        if (panel.classList.contains("open")) placePanel();
      }
      drag=null;
    });
    fab.addEventListener("mouseenter", () => {
      if (drag) return;
      const rc=fab.getBoundingClientRect();
      tip.style.top   =(rc.top+rc.height/2-12)+"px";
      tip.style.right =(window.innerWidth-rc.left+8)+"px";
      tip.style.left  ="auto";
      tip.classList.add("show");
    });
    fab.addEventListener("mouseleave", ()=>tip.classList.remove("show"));
  
    // ── Panel ────────────────────────────────────────────────
    const panel = document.createElement("div");
    panel.id = "panel";
    panel.innerHTML = `
      <div class="ph">
        <div class="ph-left">
          <div class="ph-logo">🎯</div>
          <div>
            <div class="ph-name">ResumeFit</div>
            <div class="ph-sub">Your job application sidekick</div>
          </div>
        </div>
        <button class="x-btn" id="x-btn">✕</button>
      </div>
      <div class="tabs">
        <button class="tab-btn active" data-tab="match">Match</button>
        <button class="tab-btn" data-tab="tracker">Tracker</button>
        <button class="tab-btn" data-tab="info">Info</button>
        <button class="tab-btn" data-tab="settings">Settings</button>
      </div>
      <div class="pb">
        <div class="tab-pane active" id="tab-match">
          <div class="action-row" id="action-row">
            <button class="btn-analyze" id="btn-analyze">⚡ Analyze this job</button>
            <button class="btn-log hidden" id="btn-log">＋ Log</button>
            <span class="src-badge hidden" id="src-badge"></span>
          </div>
          <div id="result"></div>
        </div>
        <div class="tab-pane" id="tab-tracker"><div id="trk-content"></div></div>
        <div class="tab-pane" id="tab-info"><div id="qi-content"></div></div>
        <div class="tab-pane" id="tab-settings"><div id="set-content"></div></div>
      </div>
    `;
    S.appendChild(panel);
  
    S.getElementById("x-btn").addEventListener("click",()=>panel.classList.remove("open"));
    S.querySelectorAll(".tab-btn").forEach(btn=>{
      btn.addEventListener("click",()=>{
        S.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
        S.querySelectorAll(".tab-pane").forEach(p=>p.classList.remove("active"));
        btn.classList.add("active");
        S.getElementById("tab-"+btn.dataset.tab).classList.add("active");
        const t=btn.dataset.tab;
        if(t==="tracker")  renderTracker();
        if(t==="info")     renderQuickInfo();
        if(t==="settings") renderSettings();
        requestAnimationFrame(placePanel);
      });
    });
  
    function placePanel() {
      const PW=340, G=10;
      const fr=fab.getBoundingClientRect();
      let left=fr.left-PW-G;
      if(left<8) left=fr.right+G;
      if(left+PW>window.innerWidth-8) left=window.innerWidth-PW-8;
      let top=Math.max(8,Math.min(fr.top,window.innerHeight-100));
      panel.style.left=left+"px"; panel.style.top=top+"px";
      panel.style.right="auto"; panel.style.bottom="auto";
    }
    function togglePanel(){
      if(panel.classList.contains("open")){ panel.classList.remove("open"); }
      else { placePanel(); panel.classList.add("open"); }
    }
    window.addEventListener("resize",()=>{ if(panel.classList.contains("open")) placePanel(); });
  
    // ── Score ring ────────────────────────────────────────────
    function makeRing(score){
      const R=21, C=2*Math.PI*R;
      const col=score>=75?"#16a34a":score>=50?"#d97706":"#dc2626";
      const trk=score>=75?"#dcfce7":score>=50?"#fef3c7":"#fee2e2";
      const off=C-(score/100)*C;
      return `<svg width="54" height="54" viewBox="0 0 54 54">
        <circle class="ring-track" cx="27" cy="27" r="${R}" stroke="${trk}" stroke-width="5.5"/>
        <circle class="ring-fill" cx="27" cy="27" r="${R}" stroke="${col}" stroke-width="5.5"
          stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"
          transform="rotate(-90 27 27)"/>
        <text x="27" y="25" class="ring-num" fill="${col}">${score}</text>
        <text x="27" y="35" class="ring-pct" fill="#9ca3af">%</text>
      </svg>`;
    }
  
    // ── Scoring ───────────────────────────────────────────────
    // Mirrors utils.js but self-contained in shadow DOM
    const SKILL_LIST = [
      "python","java","javascript","typescript","c++","c#","go","golang","ruby","php",
      "swift","kotlin","sql","scala","rust","r","bash","shell",
      "react","vue","angular","next.js","nextjs","svelte","node","express",
      "django","flask","fastapi","spring","rails","graphql","grpc","rest","rest api",
      "microservices","websocket","oauth","jwt","api",
      "aws","gcp","azure","docker","kubernetes","terraform","ci/cd","git","linux",
      "devops","jenkins","github actions","nginx",
      "machine learning","deep learning","pytorch","tensorflow","nlp","llm","ai","ml",
      "computer vision","data science","scikit-learn","pandas","numpy","spark",
      "postgresql","mysql","mongodb","redis","elasticsearch","kafka","dynamodb",
      "sqlite","snowflake","bigquery","airflow",
      "agile","scrum","product","analytics","a/b testing","growth","seo","figma","ux",
      "ios","android","react native","flutter","security","compliance","testing",
      "unit testing","e2e","observability","monitoring","reliability",
    ];
    function escRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }
    function hasSkill(text,skill){
      const plain=!skill.includes(" ")&&!/[+#.]/.test(skill);
      return plain
        ? new RegExp(`\\b${escRe(skill)}\\b`,"i").test(text)
        : new RegExp(`(^|[^a-z0-9])${escRe(skill)}(?=$|[^a-z0-9])`,"i").test(text);
    }
    const STOP=new Set(["and","or","the","a","an","to","of","in","on","for","with","at","by","from",
      "as","is","are","was","were","be","been","this","that","you","your","we","our","they","will",
      "should","can","could","experience","years","role","work","skills","ability","team","using",
      "build","develop","support","strong","good","great","new","time","based","across","within"]);
  
    function scoreResume(resumeText, jdText) {
      const jdSkills   = SKILL_LIST.filter(s=>hasSkill(jdText,s));
      const matched    = jdSkills.filter(s=>hasSkill(resumeText,s));
      const missing    = jdSkills.filter(s=>!hasSkill(resumeText,s));
      const denom      = Math.max(jdSkills.length,1);
      let score        = Math.round((matched.length/denom)*100);
      // Token frequency bonus
      const toks       = jdText.replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(t=>t.length>=4&&!STOP.has(t));
      const freq       = new Map(); toks.forEach(t=>freq.set(t,(freq.get(t)||0)+1));
      const top        = [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([t])=>t);
      let extra=0; top.forEach(kw=>{ if(new RegExp(`\\b${escRe(kw)}\\b`,"i").test(resumeText)) extra++; });
      score+=Math.min(10,extra);
      if(jdSkills.length<8) score=Math.min(score,92);
      if(jdSkills.length<5) score=Math.min(score,85);
      score=Math.max(0,Math.min(100,score));
      return { score, matched:[...new Set(matched)].slice(0,10), missing:[...new Set(missing)].slice(0,8), jdCount:jdSkills.length };
    }
  
    // Score is PRIMARY signal — jdCount/gap are minor modifiers
    function confLevel(score,gap,jdCount){
      let b=score>=75?2:score>=50?1:0;
      if(jdCount>=8&&gap>=20) b=Math.min(2,b+1);
      if(jdCount<=2&&score<70) b=Math.max(0,b-1);
      return ["Low","Medium","High"][b];
    }
  
    // ── JD Extractor — works on ANY ATS ──────────────────────
    function extractJD(){
      const sel=window.getSelection()?.toString()?.trim();
      if(sel?.length>=200) return {text:sel,src:"sel"};
  
      const CSS_SELS=[
        // LinkedIn
        ".jobs-description__content",".jobs-description-content__text",
        "[data-testid='job-view-description']",
        // Greenhouse (boards.greenhouse.io, coreweave.com?gh_jid=..., any embedded widget)
        "#content","#grnhse_app .job__description",".job__description",
        "[data-automation='job-description']",
        // Lever
        ".posting-description",".posting",
        // Workday
        "[data-automation-id='jobPostingDescription']","[data-automation-id='job-description']",
        // Ashby
        "[class*='ashby-job-posting-brief-description']","[class*='JobPosting_description']",
        // Oracle / Taleo / HCM
        "[id*='jobDescription']","[class*='requisition-description']",
        "[class*='ats-description']",".job-req-section","[class*='jdContent']",
        // SmartRecruiters
        ".job-description","[itemprop='description']",
        // Indeed
        "#jobDescriptionText","[data-testid='jobDescriptionText']",
        // Generic
        "#job-details","[class*='job-details']","[class*='job-content']",
        "[class*='jobDescription']","[class*='job-description']",
        "main article","article",
      ];
  
      for(const sel of CSS_SELS){
        try{
          const el=document.querySelector(sel); if(!el) continue;
          const c=el.cloneNode(true);
          c.querySelectorAll("form,input,select,button,nav,footer,script,style,#rf-host,noscript").forEach(n=>n.remove());
          const t=(c.innerText||"").replace(/\s+/g," ").trim();
          if(t.length>=250) return {text:t,src:"css"};
        }catch(_){}
      }
  
      const penalty=/first name|last name|upload resume|email address|date of birth|disability|equal opportunity/i;
      let best={text:"",score:0};
      document.querySelectorAll("div,section,article,main,p").forEach(el=>{
        try{
          if(el.id==="rf-host"||el.offsetHeight<80) return;
          const c=el.cloneNode(true);
          c.querySelectorAll("form,input,select,button,script,style,nav,footer,header,#rf-host,noscript").forEach(n=>n.remove());
          const t=(c.innerText||"").replace(/\s+/g," ").trim();
          if(t.length<250) return;
          const alpha=(t.match(/[a-z]/gi)||[]).length;
          const pen=penalty.test(t);
          const sc=t.length*(alpha/t.length)*(pen?0.15:1);
          if(sc>best.score) best={text:t,score:sc};
        }catch(_){}
      });
      return {text:best.text,src:"fall"};
    }
  
    // ── State ─────────────────────────────────────────────────
    let currentBest=null, currentConf=null, currentJdText=null, currentUsable=null;
    let hasLogged=false;
  
    // ── Analyze ───────────────────────────────────────────────
    S.getElementById("btn-analyze").addEventListener("click", async()=>{
      const btn     =S.getElementById("btn-analyze");
      const result  =S.getElementById("result");
      const logBtn  =S.getElementById("btn-log");
      const srcBadge=S.getElementById("src-badge");
  
      if(!hasLogged) logBtn.classList.add("hidden");
      srcBadge.className="src-badge hidden"; srcBadge.textContent="";
      btn.disabled=true; btn.textContent="Analyzing…";
      result.innerHTML=`<div class="empty loading">Comparing your resumes…</div>`;
  
      try{
        const resumes=await storageGet(STORAGE_KEY,[]);
        const usable=resumes.filter(r=>r.text&&norm(r.text).length>=50);
  
        if(!usable.length){
          result.innerHTML=`<div class="empty"><strong>No resumes saved yet</strong>Open the ResumeFit popup to add your resumes first.</div>`;
          btn.disabled=false; btn.textContent="⚡ Analyze this job"; return;
        }
  
        const {text:rawJD,src}=extractJD();
        const jdText=norm(rawJD);
  
        if(jdText.length<200){
          result.innerHTML=`<div class="empty"><strong>Job description not found</strong>Try <strong>selecting the job text</strong> on the page, then click Analyze again.</div>`;
          btn.disabled=false; btn.textContent="⚡ Analyze this job"; return;
        }
  
        const scored=usable
          .map(r=>({...r,...scoreResume(norm(r.text),jdText)}))
          .sort((a,b)=>b.score-a.score);
  
        const best=scored[0];
        const second=scored[1]||null;
        const gap=second?Math.max(0,best.score-second.score):25;
        const conf=confLevel(best.score,gap,best.jdCount);
  
        currentBest=best; currentConf=conf; currentJdText=jdText; currentUsable=usable;
  
        // Source badge
        const srcL={sel:"✦ Selection",css:"◈ Detected",fall:"◎ Full page"};
        const srcC={sel:"src-sel",css:"src-css",fall:"src-fall"};
        srcBadge.textContent=srcL[src]||"◎ Full page";
        srcBadge.className=`src-badge ${srcC[src]||"src-fall"}`;
  
        // Log btn
        if(hasLogged){
          logBtn.classList.add("hidden");
          if(!S.getElementById("logged-tag"))
            logBtn.insertAdjacentHTML("afterend",`<span class="logged-tag" id="logged-tag">✓ logged</span>`);
        } else {
          logBtn.classList.remove("hidden");
        }
  
        const pillMap={
          High:  ["pill-high","✅ Strong match"],
          Medium:["pill-medium","🟡 Decent match"],
          Low:   ["pill-low","⚠️ Weak match"],
        };
        const [pillCls,pillLabel]=pillMap[conf];
        const total=best.matched.length+best.missing.length;
        const barPct=total>0?Math.round(best.matched.length/total*100):0;
        const barCol=barPct>=70?"#16a34a":barPct>=45?"#d97706":"#dc2626";
        const mChips=best.matched.slice(0,8).map(s=>`<span class="chip chip-match">${s}</span>`).join("");
        const xChips=best.missing.slice(0,6).map(s=>`<span class="chip chip-miss">${s}</span>`).join("");
  
        result.innerHTML=`
          <div class="score-card">
            <div class="score-ring">${makeRing(best.score)}</div>
            <div class="score-meta">
              <div class="score-lbl">Best resume</div>
              <div class="score-name" title="${best.name}">${best.name}</div>
              <div class="score-sub">${second?`Beats "${second.name}" by ${gap}%`:"Only resume saved"}</div>
              <div class="pill ${pillCls}"><span class="pill-dot"></span>${pillLabel}</div>
            </div>
          </div>
          <div class="skills-bar-row">
            <div class="skills-bar-track">
              <div class="skills-bar-fill" style="width:${barPct}%;background:${barCol}"></div>
            </div>
            <div class="skills-bar-lbl" style="color:${barCol}">${best.matched.length}/${total} skills</div>
          </div>
          ${mChips?`<div class="skill-section">
            <div class="skill-section-lbl">✅ You have</div>
            <div class="chip-row">${mChips}</div>
          </div>`:""}
          ${xChips?`<div class="skill-section">
            <div class="skill-section-lbl">💡 Missing</div>
            <div class="chip-row">${xChips}</div>
          </div>`:`<div style="font-size:11.5px;color:#16a34a;font-weight:700;padding:2px 0">🎉 No skill gaps detected</div>`}
          <div id="qc-slot"></div>
          <div id="ai-slot"></div>
        `;
  
        // Render quick-copy icon bar from saved Info data
        (async()=>{
          const qi=await storageGet(QUICKINFO_KEY,{});
          const ICON_KEYS=["email","linkedin","github","portfolio"];
          const filled=ICON_KEYS.filter(k=>qi[k]);
          const slot=S.getElementById("qc-slot");
          if(!slot||!filled.length) return;
          slot.innerHTML=`
            <div class="divider"></div>
            <div class="qc-bar-lbl">Quick Copy</div>
            <div class="qc-bar" id="qc-bar"></div>`;
          // re-use renderQuickCopyBar pointing at new container
          const bar=S.getElementById("qc-bar");
          const QI_MAP={};
          QI_FIELDS.forEach(f=>{QI_MAP[f.key]=f;});
          bar.innerHTML=filled.map(k=>`
            <button class="qc-btn" data-val="${(qi[k]||"").replace(/"/g,"&quot;")}">
              ${QC_SVG[k]||""}<span class="qc-lbl">${QI_MAP[k]?.label||k}</span>
            </button>`).join("");
          bar.querySelectorAll(".qc-btn").forEach(btn=>{
            btn.addEventListener("click",()=>{
              const val=btn.dataset.val; if(!val) return;
              navigator.clipboard.writeText(val).then(()=>{
                const orig=btn.innerHTML;
                btn.classList.add("ok");
                btn.innerHTML=`${QC_SVG.check}<span class="qc-lbl">Copied!</span>`;
                setTimeout(()=>{ btn.classList.remove("ok"); btn.innerHTML=orig; },1800);
              });
            });
          });
        })();
  
        const st=await storageGet(SETTINGS_KEY,{});
        if(st.provider&&st.provider!=="none"&&st.apiKey){
          const slot=S.getElementById("ai-slot");
          slot.innerHTML=`<div class="ai-box">
            <div class="ai-lbl">✦ AI Suggestions</div>
            <div class="ai-body loading" id="ai-body">Thinking…</div>
          </div>`;
          runAISuggestions(st,jdText,best,usable);
        } else {
          // Show nudge to add API key — same as popup
          const slot=S.getElementById("ai-slot");
          slot.innerHTML=`<div class="ai-nudge" id="ai-nudge">
            ✦ <span>Get AI-powered tips for this job — <strong>add your API key in Settings</strong></span>
          </div>`;
          S.getElementById("ai-nudge").addEventListener("click",()=>{
            S.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
            S.querySelectorAll(".tab-pane").forEach(p=>p.classList.remove("active"));
            S.querySelector('[data-tab="settings"]').classList.add("active");
            S.getElementById("tab-settings").classList.add("active");
            renderSettings();
          });
        }
  
      }catch(err){
        S.getElementById("result").innerHTML=
          `<div class="empty"><strong>Something went wrong</strong>${err.message}</div>`;
      }
      btn.disabled=false; btn.textContent="⚡ Analyze again";
    });
  
    // ── Log button ────────────────────────────────────────────
    S.getElementById("btn-log").addEventListener("click",async()=>{
      if(hasLogged||!currentBest) return;
      hasLogged=true;
      const logBtn=S.getElementById("btn-log");
      const title=document.title.replace(/\s*[-|–—].*$/,"").trim().slice(0,80)||"Job Application";
      const dateStr=new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
      const apps=await storageGet(TRACKER_KEY,[]);
      apps.push({
        id:uid(), jobTitle:title, resumeName:currentBest.name,
        score:currentBest.score, confidence:currentConf,
        date:dateStr, url:location.href, loggedAt:Date.now(),
      });
      await storageSet(TRACKER_KEY,apps);
      logBtn.outerHTML=`<span class="logged-tag" id="logged-tag">✓ logged</span>`;
      // n8n webhook
      const st=await storageGet(SETTINGS_KEY,{});
      if(st.n8nWebhook){
        fetch(st.n8nWebhook,{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            jobTitle:title, company:location.hostname,
            resumeUsed:currentBest.name, score:currentBest.score,
            confidence:currentConf, url:location.href, date:new Date().toISOString(),
          }),
        }).catch(()=>{});
      }
    });
  
    // ── TRACKER TAB ───────────────────────────────────────────
    async function renderTracker(){
      const div=S.getElementById("trk-content");
      const apps=await storageGet(TRACKER_KEY,[]);
      if(!apps.length){
        div.innerHTML=`<div class="trk-empty">
          <strong>No applications logged yet</strong>
          Analyze a job posting and hit <strong>＋ Log</strong> to track it here.
        </div>`;
        return;
      }
      const avgScore=Math.round(apps.reduce((s,a)=>s+(a.score||0),0)/apps.length);
      const highCount=apps.filter(a=>a.confidence==="High").length;
      const recent=[...apps].sort((a,b)=>(b.loggedAt||0)-(a.loggedAt||0)).slice(0,10);
  
      const cards=recent.map(a=>{
        const cls=a.confidence==="High"?"high":a.confidence==="Medium"?"medium":"low";
        const h=(()=>{try{return new URL(a.url).hostname.replace(/^www\./,"");}catch(_){return "";}})();
        return `<div class="trk-card">
          <div class="trk-card-head">
            <div class="trk-title" title="${a.jobTitle||""}">${a.jobTitle||"Job Application"}</div>
            <button class="trk-del" data-id="${a.id}">✕</button>
          </div>
          <div class="trk-meta">
            <span class="trk-resume">📄 ${a.resumeName}</span>
            <span class="trk-score ${cls}">${a.score}% · ${a.confidence}</span>
            <span class="trk-date">${a.date}</span>
          </div>
          ${h?`<div style="font-size:10px;color:#9ca3af;margin-top:1px">${h}</div>`:""}
        </div>`;
      }).join("");
  
      const st=await storageGet(SETTINGS_KEY,{});
      const hasHook=!!st.n8nWebhook;
  
      div.innerHTML=`
        <div class="trk-stats">
          <div class="trk-stat"><div class="trk-stat-num">${apps.length}</div><div class="trk-stat-lbl">Total</div></div>
          <div class="trk-stat"><div class="trk-stat-num">${highCount}</div><div class="trk-stat-lbl">Strong Match</div></div>
          <div class="trk-stat"><div class="trk-stat-num">${avgScore}%</div><div class="trk-stat-lbl">Avg Score</div></div>
        </div>
        <div class="trk-list">${cards}</div>
        ${apps.length>10?`<div style="font-size:10.5px;color:#9ca3af;text-align:center">Showing last 10 of ${apps.length}</div>`:""}
        <div class="trk-hint">
          ${hasHook
            ?"🔁 <strong>Auto-syncing to Google Sheets</strong> — every log fires your n8n webhook."
            :"💡 Connect an <strong>n8n webhook</strong> in Settings to auto-sync every log to Google Sheets, Notion, or Airtable."}
        </div>
      `;
  
      S.querySelectorAll(".trk-del").forEach(btn=>{
        btn.addEventListener("click",async()=>{
          const all=await storageGet(TRACKER_KEY,[]);
          await storageSet(TRACKER_KEY,all.filter(a=>a.id!==btn.dataset.id));
          renderTracker();
        });
      });
    }
  
    // ── QUICK INFO TAB ────────────────────────────────────────
    // SVG icons shared between quick-copy bar and Info tab
    const QC_SVG = {
      email:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
      phone:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.08 3.18 2 2 0 0 1 3.05 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z"/></svg>`,
      linkedin:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>`,
      github:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>`,
      portfolio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
      location:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
      check:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    };
  
    // Renders icon-only quick-copy buttons below Match results (same 4 fields as popup)
    function renderQuickCopyBar(qi){
      const bar = S.getElementById("qc-bar");
      if(!bar) return;
      // Show only the 4 link/contact fields that are actually useful to copy quickly
      const ICON_KEYS = ["email","linkedin","github","portfolio"];
      const filled = ICON_KEYS.filter(k=>qi[k]).map(k=>QI_FIELDS.find(f=>f.key===k));
      if(!filled.length){ bar.innerHTML=""; return; }
      bar.innerHTML = `<div class="qc-bar">${
        filled.map(f=>`
          <button class="qc-btn" data-val="${(qi[f.key]||"").replace(/"/g,"&quot;")}">
            ${f.icon}<span class="qc-lbl">${f.label}</span>
          </button>`).join("")
      }</div>`;
      bar.querySelectorAll(".qc-btn").forEach(btn=>{
        btn.addEventListener("click",()=>{
          const val=btn.dataset.val; if(!val) return;
          navigator.clipboard.writeText(val).then(()=>{
            const orig=btn.innerHTML;
            btn.classList.add("ok");
            btn.innerHTML=`${QC_SVG.check}<span class="qc-lbl">Copied!</span>`;
            setTimeout(()=>{ btn.classList.remove("ok"); btn.innerHTML=orig; },1800);
          });
        });
      });
    }
  
    // Same fields and key names as popup.js INFO_FIELDS — shares storage
    const QI_FIELDS=[
      {key:"email",     label:"Email",     icon:QC_SVG.email,     placeholder:"you@email.com",       type:"email"},
      {key:"phone",     label:"Phone",     icon:QC_SVG.phone,     placeholder:"+1 (555) 000-0000",   type:"tel"  },
      {key:"linkedin",  label:"LinkedIn",  icon:QC_SVG.linkedin,  placeholder:"linkedin.com/in/you", type:"url"  },
      {key:"github",    label:"GitHub",    icon:QC_SVG.github,    placeholder:"github.com/you",      type:"url"  },
      {key:"portfolio", label:"Portfolio", icon:QC_SVG.portfolio, placeholder:"yourportfolio.com",   type:"url"  },
      {key:"location",  label:"Location",  icon:QC_SVG.location,  placeholder:"San Francisco, CA",   type:"text" },
    ];
  
    async function renderQuickInfo(){
      const qi=await storageGet(QUICKINFO_KEY,{});
      const div=S.getElementById("qi-content");
  
      // Icon quick-copy bar at top — only the 4 key fields (same as popup)
      const ICON_KEYS=["email","linkedin","github","portfolio"];
      const filledIcons=ICON_KEYS.filter(k=>qi[k]).map(k=>QI_FIELDS.find(f=>f.key===k));
      const qcBarHTML=filledIcons.length?`
        <div class="qi-quick-lbl">Quick Copy</div>
        <div class="qc-bar qi-qc-row">${
          filledIcons.map(f=>`
            <button class="qc-btn qi-qc-btn" data-val="${(qi[f.key]||"").replace(/"/g,"&quot;")}">
              ${f.icon}<span class="qc-lbl">${f.label}</span>
            </button>`).join("")
        }</div>
        <div class="divider" style="margin:10px 0 6px"></div>`:"";
  
      // Form — matches popup layout exactly: label then input, clean
      const fieldsHTML=QI_FIELDS.map(f=>`
        <div class="qi-form-row">
          <div class="qi-form-lbl">${f.label}</div>
          <input class="qi-form-input" id="qi-${f.key}" type="${f.type}"
            placeholder="${f.placeholder}"
            value="${qi[f.key]?qi[f.key].replace(/"/g,"&quot;"):""}">
        </div>`).join("");
  
      div.innerHTML=`
        ${qcBarHTML}
        <div class="qi-form-fields">${fieldsHTML}</div>
        <div style="margin-top:12px">
          <button class="qi-save-btn" id="qi-save">💾 Save details</button>
        </div>
        <div class="qi-msg" id="qi-msg"></div>
      `;
  
      // Quick copy clicks (both in bar and after save)
      function bindQcClicks(){
        div.querySelectorAll(".qi-qc-btn").forEach(btn=>{
          btn.addEventListener("click",()=>{
            const val=btn.dataset.val; if(!val) return;
            navigator.clipboard.writeText(val).then(()=>{
              const orig=btn.innerHTML;
              btn.classList.add("ok");
              btn.innerHTML=`${QC_SVG.check}<span class="qc-lbl">Copied!</span>`;
              setTimeout(()=>{ btn.classList.remove("ok"); btn.innerHTML=orig; },1800);
            });
          });
        });
      }
      bindQcClicks();
  
      S.getElementById("qi-save").addEventListener("click",async()=>{
        const data={};
        QI_FIELDS.forEach(f=>{
          const v=S.getElementById("qi-"+f.key)?.value?.trim();
          if(v) data[f.key]=v;
        });
        await storageSet(QUICKINFO_KEY,data);
        // Re-render so quick copy bar updates
        renderQuickInfo();
        // Re-render in Match tab too if visible
        renderQuickCopyBar(data);
        const m=S.getElementById("qi-msg");
        if(m){ m.textContent="✅ Saved!"; setTimeout(()=>{if(m)m.textContent="";},2000); }
      });
    }
  
    // ── SETTINGS TAB ─────────────────────────────────────────
    async function renderSettings(){
      const st=await storageGet(SETTINGS_KEY,{provider:"none",apiKey:"",n8nWebhook:""});
      const div=S.getElementById("set-content");
      const hints={
        gemini:{hint:"aistudio.google.com → Get API key · Starts with AIza…"},
        claude:{hint:"console.anthropic.com · Starts with sk-ant-…"},
        openai:{hint:"platform.openai.com/api-keys · Starts with sk-…"},
      };
      div.innerHTML=`
        <div class="set-section">
          <div class="set-lbl">AI Provider</div>
          <div class="set-card">
            <div class="set-desc">Unlock AI suggestions + cover letter generation. Your key stays on your device — never sent to us.</div>
            <select class="set-select" id="set-prov">
              <option value="none"   ${st.provider==="none"   ?"selected":""}>None — keyword engine only</option>
              <option value="gemini" ${st.provider==="gemini" ?"selected":""}>Gemini (Google) — free tier ⭐</option>
              <option value="claude" ${st.provider==="claude" ?"selected":""}>Claude (Anthropic)</option>
              <option value="openai" ${st.provider==="openai" ?"selected":""}>OpenAI (GPT-4o mini)</option>
            </select>
            <div id="set-key-wrap" style="${st.provider==="none"?"display:none":""}">
              <div class="set-key-row">
                <input class="set-input" id="set-key" type="password" placeholder="Paste API key…" value="${st.apiKey||""}">
                <button class="set-eye" id="set-eye">👁</button>
              </div>
              <div class="set-hint" id="set-key-hint">${hints[st.provider]?.hint||""}</div>
            </div>
            <div class="set-btn-row">
              <button class="set-save" id="set-save-ai">💾 Save</button>
              <button class="set-clear" id="set-clear-ai">Clear key</button>
            </div>
            <div class="set-status" id="set-ai-st"></div>
          </div>
        </div>
        <div class="set-section">
          <div class="set-lbl">n8n Automation</div>
          <div class="set-card">
            <div class="set-desc">Every <strong>＋ Log</strong> click fires this webhook. Use n8n to write a row to <strong>Google Sheets</strong>, Notion, Airtable, or anywhere — automatically tracking every application you submit.<br><br><strong>Setup:</strong> n8n → New Workflow → Webhook trigger → copy URL → paste here.</div>
            <input class="set-input" id="set-n8n" type="url" placeholder="https://your-n8n.app/webhook/…" value="${st.n8nWebhook||""}">
            <div class="set-hint">Fires with: title, company, resume, score, confidence, URL, date</div>
            <div class="set-btn-row">
              <button class="set-save" id="set-save-n8n">💾 Save webhook</button>
              <button class="set-clear" id="set-clear-n8n">Clear</button>
            </div>
            <div class="set-status" id="set-n8n-st"></div>
          </div>
        </div>
        <div class="set-privacy">🔒 Fully local · Resume text never leaves your device</div>
      `;
  
      S.getElementById("set-prov").addEventListener("change",e=>{
        const p=e.target.value;
        S.getElementById("set-key-wrap").style.display=p==="none"?"none":"";
        S.getElementById("set-key-hint").textContent=hints[p]?.hint||"";
      });
      S.getElementById("set-eye").addEventListener("click",()=>{
        const inp=S.getElementById("set-key");
        inp.type=inp.type==="password"?"text":"password";
        S.getElementById("set-eye").textContent=inp.type==="password"?"👁":"🙈";
      });
  
      const showSt=(id,msg,ok)=>{
        const el=S.getElementById(id);
        el.textContent=msg; el.className=`set-status ${ok?"set-ok":"set-err"}`;
        setTimeout(()=>{el.textContent="";},2500);
      };
  
      S.getElementById("set-save-ai").addEventListener("click",async()=>{
        const p=S.getElementById("set-prov").value;
        const k=S.getElementById("set-key").value.trim();
        if(p!=="none"&&!k){showSt("set-ai-st","⚠️ Enter your API key.",false);return;}
        const cur=await storageGet(SETTINGS_KEY,{});
        await storageSet(SETTINGS_KEY,{...cur,provider:p,apiKey:k});
        showSt("set-ai-st","✅ Saved!",true);
      });
      S.getElementById("set-clear-ai").addEventListener("click",async()=>{
        const cur=await storageGet(SETTINGS_KEY,{});
        await storageSet(SETTINGS_KEY,{...cur,provider:"none",apiKey:""});
        S.getElementById("set-prov").value="none";
        S.getElementById("set-key").value="";
        S.getElementById("set-key-wrap").style.display="none";
        showSt("set-ai-st","Key cleared.",true);
      });
      S.getElementById("set-save-n8n").addEventListener("click",async()=>{
        const wh=S.getElementById("set-n8n").value.trim();
        const cur=await storageGet(SETTINGS_KEY,{});
        await storageSet(SETTINGS_KEY,{...cur,n8nWebhook:wh});
        showSt("set-n8n-st",wh?"✅ Webhook saved!":"Cleared.",true);
      });
      S.getElementById("set-clear-n8n").addEventListener("click",async()=>{
        const cur=await storageGet(SETTINGS_KEY,{});
        await storageSet(SETTINGS_KEY,{...cur,n8nWebhook:""});
        S.getElementById("set-n8n").value="";
        showSt("set-n8n-st","Cleared.",true);
      });
    }
  
    // ── AI Suggestions ────────────────────────────────────────
    async function runAISuggestions(st,jdText,best,allResumes){
      const others=allResumes.filter(r=>r.id!==best.id).map(r=>r.name).join(", ");
      const prompt=`You are a resume coach.
  
  JOB DESCRIPTION (first 1200 chars):
  ${jdText.slice(0,1200)}
  
  CANDIDATE'S RESUME: "${best.name}"
  MATCHED SKILLS: ${best.matched.join(", ")}
  MISSING SKILLS: ${best.missing.join(", ")}
  ${others?`\nOTHER RESUMES: ${others}`:""}
  
  Give exactly 3 short, specific suggestions (100 words max total):
  1. One bullet point to ADD to this resume (reference JD words)
  2. One keyword to make more prominent
  3. One cover letter tip for this specific role
  
  Plain text, numbered. No markdown.`;
  
      const setAI=t=>{
        const el=S.getElementById("ai-body");
        if(el){el.textContent=t;el.classList.remove("loading");}
      };
      try{
        let out="";
        if(st.provider==="gemini"){
          const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${st.apiKey}`,
            {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});
          const d=await r.json(); out=d?.candidates?.[0]?.content?.parts?.[0]?.text||"No suggestions.";
        } else if(st.provider==="claude"){
          const r=await fetch("https://api.anthropic.com/v1/messages",
            {method:"POST",headers:{"Content-Type":"application/json","x-api-key":st.apiKey,"anthropic-version":"2023-06-01"},
             body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:300,messages:[{role:"user",content:prompt}]})});
          const d=await r.json(); out=d?.content?.[0]?.text||"No suggestions.";
        } else if(st.provider==="openai"){
          const r=await fetch("https://api.openai.com/v1/chat/completions",
            {method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${st.apiKey}`},
             body:JSON.stringify({model:"gpt-4o-mini",max_tokens:300,messages:[{role:"user",content:prompt}]})});
          const d=await r.json(); out=d?.choices?.[0]?.message?.content||"No suggestions.";
        }
        setAI(out.trim());
      }catch(e){setAI(`⚠️ ${e.message}`);}
    }
  
  })();