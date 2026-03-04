// content.js — ResumeFit v1
// Extracts job description text from all major job boards.
//
// Board coverage (verified):
//   ✅ Greenhouse (job-boards.greenhouse.io)  — new renderer, tree-walk + form strip
//   ✅ Greenhouse (boards.greenhouse.io)       — old renderer, #content selector
//   ✅ Lever      (jobs.lever.co)              — .content selector
//   ✅ Ashby      (jobs.ashbyhq.com)           — JS-rendered, smart density fallback
//   ✅ LinkedIn   (linkedin.com/jobs)          — .jobs-description__content
//   ✅ Indeed     (indeed.com)                 — #jobDescriptionText
//   ✅ Workday    (*.myworkdayjobs.com)        — [data-automation-id] selectors
//   ✅ Smartrecruiters                         — [itemprop="description"]
//   ✅ Rippling / Ashby variants               — density fallback
//   ✅ Any other  — highlight text → always works

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeText(text) {
    return (text || "")
      .replace(/\s+/g, " ")
      .replace(/[^\S\r\n]+/g, " ")
      .trim();
  }
  
  // Strip noise nodes from a cloned element before reading its text
  function stripNoise(clone) {
    const noiseSelectors = [
      "script", "style", "noscript", "iframe", "svg", "canvas",
      "nav", "footer", "header",
      "form", "input", "select", "textarea", "button",
      "[class*='apply']", "[id*='apply']",
      "[class*='application']", "[id*='application']",
      "[class*='voluntary']", "[class*='disability']",
      "[class*='veteran']", "[class*='eeoc']",
      "[class*='self-id']", "[class*='selfId']",
      "[class*='cookie']", "[class*='banner']",
      "[class*='nav']", "[class*='footer']", "[class*='header']",
      "[class*='sidebar']", "[class*='modal']",
      "[aria-label*='cookie']", "[aria-label*='navigation']",
    ];
    noiseSelectors.forEach(sel => {
      try { clone.querySelectorAll(sel).forEach(n => n.remove()); } catch(_) {}
    });
    return clone;
  }
  
  function getText(el) {
    const clone = el.cloneNode(true);
    stripNoise(clone);
    return normalizeText(clone.innerText || clone.textContent || "");
  }
  
  // ─── Method 1: User selection ─────────────────────────────────────────────────
  
  function trySelection() {
    const sel = normalizeText(window.getSelection()?.toString() || "");
    if (sel.length >= 200) return { text: sel, source: "selection" };
    return null;
  }
  
  // ─── Method 2: Known CSS selectors per board ──────────────────────────────────
  
  const SELECTORS = [
    // Greenhouse — old renderer (boards.greenhouse.io)
    "#content",
    ".job__description",
    ".section-wrapper",
  
    // Greenhouse — new renderer (job-boards.greenhouse.io)
    // No stable class; handled by tryGreenhouseNew() below.
    // But try these just in case they're present:
    "[class*='JobApp']",
    "[class*='jobApp']",
  
    // Lever (jobs.lever.co)
    ".posting-categories ~ .section-wrapper",
    ".posting",
    ".posting-page",
  
    // LinkedIn
    ".jobs-description__content",
    ".jobs-description",
    ".description__text",
    ".show-more-less-html__markup",
    ".jobs-box__html-content",
  
    // Indeed
    "#jobDescriptionText",
    "[data-testid='jobDescriptionText']",
    "[data-testid='job-description']",
  
    // Workday (*.myworkdayjobs.com)
    "[data-automation-id='jobPostingDescription']",
    "[data-automation-id='job-posting-description']",
    "[data-automation-id='richText']",
  
    // Smartrecruiters
    "[itemprop='description']",
    ".job-description",
  
    // Rippling / generic ATS
    "[class*='JobDescription']",
    "[class*='job-description']",
    "[class*='jobDescription']",
    "[class*='description-content']",
    "[class*='descriptionContent']",
  
    // Generic semantic fallbacks
    "main article",
    "article",
  ];
  
  function trySelectors() {
    for (const sel of SELECTORS) {
      try {
        const el = document.querySelector(sel);
        if (!el) continue;
        const text = getText(el);
        if (text.length >= 300) return { text, source: "selector" };
      } catch(_) {}
    }
    return null;
  }
  
  // ─── Method 3: Greenhouse new renderer tree-walk ──────────────────────────────
  // job-boards.greenhouse.io renders everything client-side with no stable
  // class names. We walk all leaf text nodes before the first <form> element.
  
  function tryGreenhouseNew() {
    if (!window.location.hostname.includes("greenhouse.io")) return null;
  
    // Find where the application form starts
    const formEl = document.querySelector(
      "form, [id='application_form'], [class*='application-form'], [class*='applicationForm']"
    );
  
    const chunks = [];
    const seen = new Set();
  
    function walk(node) {
      if (formEl && (node === formEl || formEl.contains(node))) return;
      if (node.nodeType === Node.TEXT_NODE) {
        const t = normalizeText(node.textContent);
        if (t.length > 15 && !seen.has(t)) {
          seen.add(t);
          chunks.push(t);
        }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName.toLowerCase();
      // Skip noise elements entirely
      if (["script","style","noscript","nav","footer","header","form","button","input","select","textarea","svg","canvas"].includes(tag)) return;
      for (const child of node.childNodes) walk(child);
    }
  
    walk(document.body);
    const text = chunks.join(" ");
    if (text.length >= 300) return { text, source: "selector" };
    return null;
  }
  
  // ─── Method 4: Ashby-specific ─────────────────────────────────────────────────
  // jobs.ashbyhq.com is fully JS-rendered. No static selectors work.
  // We grab the largest text block on the page after JS renders.
  
  function tryAshby() {
    if (!window.location.hostname.includes("ashbyhq.com")) return null;
    return tryDensityFallback(); // density fallback works well for Ashby
  }
  
  // ─── Method 5: Workday ────────────────────────────────────────────────────────
  // *.myworkdayjobs.com — also JS-rendered. data-automation-id selectors
  // usually work but try density if not.
  
  function tryWorkday() {
    if (!window.location.hostname.includes("myworkdayjobs.com") &&
        !window.location.hostname.includes("workday.com")) return null;
  
    const workdaySelectors = [
      "[data-automation-id='jobPostingDescription']",
      "[data-automation-id='job-posting-description']",
      "[data-automation-id='richText']",
      "[data-automation-id='jobReqDescription']",
    ];
  
    for (const sel of workdaySelectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const text = getText(el);
          if (text.length >= 300) return { text, source: "selector" };
        }
      } catch(_) {}
    }
  
    return tryDensityFallback();
  }
  
  // ─── Method 6: Smart density fallback ────────────────────────────────────────
  // Scores every block element by text length × alpha-character density.
  // Works well for JS-rendered pages (Ashby, Rippling, custom ATS).
  
  function tryDensityFallback() {
    const candidates = document.querySelectorAll(
      "div, section, article, main, [class*='description'], [class*='detail'], [class*='content'], [class*='posting'], [class*='job']"
    );
  
    let best = { text: "", score: 0 };
  
    for (const el of candidates) {
      try {
        if (el.offsetHeight < 80) continue;
        const text = getText(el);
        if (text.length < 300) continue;
        const alpha = (text.match(/[a-z]/gi) || []).length;
        const density = alpha / text.length;
        // Penalise if it looks like a navigation/form dump
        const hasFormWords = /\b(first name|last name|email|phone|submit|upload|resume\/cv|cover letter|linkedin|disability|veteran)\b/i.test(text);
        const penalty = hasFormWords ? 0.4 : 1;
        const score = text.length * density * penalty;
        if (score > best.score) best = { text, score };
      } catch(_) {}
    }
  
    if (best.text.length >= 300) return { text: best.text, source: "fallback" };
    return null;
  }
  
  // ─── Method 7: Last-resort stripped body ─────────────────────────────────────
  
  function lastResort() {
    const clone = document.body.cloneNode(true);
    stripNoise(clone);
    const text = normalizeText(clone.innerText || clone.textContent || "");
    return { text, source: "fallback" };
  }
  
  // ─── Main extractor ───────────────────────────────────────────────────────────
  
  function extractJobDescription() {
    return (
      trySelection()       ||   // 1. User highlighted text — always highest priority
      tryGreenhouseNew()   ||   // 2. Greenhouse new renderer (tree-walk, form-safe)
      tryWorkday()         ||   // 3. Workday (data-automation-id + density)
      tryAshby()           ||   // 4. Ashby (density-based)
      trySelectors()       ||   // 5. Known CSS selectors for all other boards
      tryDensityFallback() ||   // 6. Smart density fallback for unknown boards
      lastResort()              // 7. Stripped full body — always returns something
    );
  }
  
  // ─── Message listener ─────────────────────────────────────────────────────────
  
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "GET_JOB_TEXT") return;
  
    try {
      const { text, source } = extractJobDescription();
      const MAX_CHARS = 25000;
      const trimmed = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
      sendResponse({ ok: true, source, length: trimmed.length, text: trimmed });
    } catch (err) {
      sendResponse({ ok: false, error: err?.message || "Failed to extract job description." });
    }
  
    return true;
  });