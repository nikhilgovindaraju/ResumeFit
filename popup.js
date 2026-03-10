// popup.js — ResumeFit v2

const utils = window.ResumeSelectorUtils;

const els = {
  // Header
  aiBadge:          document.getElementById("aiBadge"),
  footerEngine:     document.getElementById("footerEngine"),

  // Tabs
  tabs:             document.querySelectorAll(".tab"),
  tabPanes:         document.querySelectorAll(".tabPane"),

  // Resume section
  resumeSelect:     document.getElementById("resumeSelect"),
  resumeControls:   document.getElementById("resumeControls"),
  emptyResumeState: document.getElementById("emptyResumeState"),
  addResumeBtn:     document.getElementById("addResumeBtn"),
  editResumeBtn:    document.getElementById("editResumeBtn"),
  deleteResumeBtn:  document.getElementById("deleteResumeBtn"),
  resumeCount:      document.getElementById("resumeCount"),

  // Editor
  editor:           document.getElementById("editor"),
  editorTitle:      document.getElementById("editorTitle"),
  closeEditorBtn:   document.getElementById("closeEditorBtn"),
  saveResumeBtn:    document.getElementById("saveResumeBtn"),
  resumeName:       document.getElementById("resumeName"),
  resumeText:       document.getElementById("resumeText"),

  // Match
  analyzeBtn:       document.getElementById("analyzeBtn"),
  jdMeta:           document.getElementById("jdMeta"),
  resultCard:       document.getElementById("resultCard"),
  resultMain:       document.getElementById("resultMain"),
  resultSub:        document.getElementById("resultSub"),
  pillContainer:    document.getElementById("pillContainer"),
  whyList:          document.getElementById("whyList"),

  // AI advice
  aiAdviceBlock:    document.getElementById("aiAdviceBlock"),
  aiAdviceContent:  document.getElementById("aiAdviceContent"),
  aiNudge:          document.getElementById("aiNudge"),

  // Log app
  logAppBlock:      document.getElementById("logAppBlock"),
  logAppBtn:        document.getElementById("logAppBtn"),
  logAppStatus:     document.getElementById("logAppStatus"),

  // Tracker
  trackerEmpty:     document.getElementById("trackerEmpty"),
  trackerStats:     document.getElementById("trackerStats"),
  trackerList:      document.getElementById("trackerList"),
  trackerFilter:    document.getElementById("trackerFilter"),
  exportCsvBtn:     document.getElementById("exportCsvBtn"),

  // Settings
  aiProvider:       document.getElementById("aiProvider"),
  apiKeyRow:        document.getElementById("apiKeyRow"),
  apiKeyInput:      document.getElementById("apiKeyInput"),
  apiKeyLabel:      document.getElementById("apiKeyLabel"),
  apiKeyHint:       document.getElementById("apiKeyHint"),
  toggleKeyBtn:     document.getElementById("toggleKeyBtn"),
  saveSettingsBtn:  document.getElementById("saveSettingsBtn"),
  clearSettingsBtn: document.getElementById("clearSettingsBtn"),
  settingsStatus:   document.getElementById("settingsStatus"),
  n8nWebhook:       document.getElementById("n8nWebhook"),
  saveN8nBtn:       document.getElementById("saveN8nBtn"),
  clearN8nBtn:      document.getElementById("clearN8nBtn"),
  n8nStatus:        document.getElementById("n8nStatus"),
};

const STORAGE_KEY      = "resume_selector_resumes_min_v1";
const TRACKER_KEY      = "resumefit_applications_v1";
const QUICKINFO_KEY    = "resumefit_quickinfo_v1";
const SETTINGS_KEY     = "resumefit_settings_v1";
const MAX_RESUMES      = 5;

let editorMode     = "add";
let editorResumeId = null;

// Last analysis result — used when logging an application
let lastAnalysis = null;

// ── Storage ────────────────────────────────────────────────
async function storageGet(key, fallback = null) {
  return new Promise(r => chrome.storage.local.get([key], d => r(d[key] ?? fallback)));
}
async function storageSet(key, value) {
  return new Promise(r => chrome.storage.local.set({ [key]: value }, r));
}

async function storageGetAll()      { return storageGet(STORAGE_KEY, []); }
async function storageSetAll(v)     { return storageSet(STORAGE_KEY, v); }
async function getApplications()    { return storageGet(TRACKER_KEY, []); }
async function setApplications(v)   { return storageSet(TRACKER_KEY, v); }
async function getSettings()        { return storageGet(SETTINGS_KEY, { provider: "none", apiKey: "" }); }
async function setSettings(v)       { return storageSet(SETTINGS_KEY, v); }

function uid() { return Math.random().toString(36).slice(2, 10); }

// ── Tabs ───────────────────────────────────────────────────
els.tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    els.tabs.forEach(t => t.classList.remove("active"));
    els.tabPanes.forEach(p => p.classList.add("hidden"));
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.remove("hidden");
    if (tab.dataset.tab === "tracker") renderTracker();
    if (tab.dataset.tab === "info") renderInfoTab();
  });
});

// ── Status helpers ─────────────────────────────────────────
function setStatus(main, sub, isEmpty = false) {
  els.resultMain.textContent = main;
  els.resultMain.className = isEmpty ? "resultEmpty" : "resultName";
  els.resultSub.textContent = sub || "";
  els.pillContainer.innerHTML = "";
  els.resultCard.classList.remove("analyzing");
}

function setPill(confidence) {
  const level = confidence.toLowerCase();
  const labels = { high: "✅ Strong match", medium: "🟡 Decent match", low: "⚠️ Weak match" };
  els.pillContainer.innerHTML = `
    <div class="pill ${level}">
      <span class="dot"></span>${labels[level] || confidence}
    </div>`;
}

// ── Why list ───────────────────────────────────────────────
function setWhy(items) {
  els.whyList.innerHTML = "";
  if (!items || items.length === 0) {
    els.whyList.innerHTML = `<li class="empty"><span class="bullet"></span><span>Your match breakdown will appear here after analysis.</span></li>`;
    return;
  }
  for (const html of items.slice(0, 3)) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="bullet"></span><span>${html}</span>`;
    els.whyList.appendChild(li);
  }
}

function chips(skills, cls) {
  return skills.slice(0, 6).map(s => `<span class="chip ${cls}">${s}</span>`).join("");
}

function buildWhy(best, second) {
  const matched = best.matched || [];
  const missing = best.missing || [];
  const bullets = [];
  if (matched.length > 0) {
    bullets.push(`✅ Covers key requirements: ${chips(matched, "match")}`);
  } else {
    bullets.push("✅ Best overall keyword coverage across your resumes.");
  }
  if (second) {
    const diff = Math.max(0, best.score - second.score);
    bullets.push(`🏆 Outscores <strong style="color:#09090b">${second.name}</strong> by ${diff}% on this JD.`);
  }
  if (missing.length > 0) {
    bullets.push(`💡 Consider adding: ${chips(missing, "miss")}`);
  } else {
    bullets.push("🎉 No major skill gaps found — you're well covered.");
  }
  return bullets;
}

// ── Resume select ──────────────────────────────────────────
function getSelectedId() { return els.resumeSelect.value || ""; }

async function renderResumeSelect(selectId = null) {
  const resumes = await storageGetAll();
  els.resumeSelect.innerHTML = "";
  const atLimit = resumes.length >= MAX_RESUMES;
  els.addResumeBtn.disabled = atLimit;
  els.addResumeBtn.textContent = atLimit ? "✋ Limit reached (5/5)" : "＋ Add a resume";
  if (resumes.length === 0) {
    els.resumeControls.classList.add("hidden");
    els.emptyResumeState.classList.remove("hidden");
    return;
  }
  els.emptyResumeState.classList.add("hidden");
  els.resumeControls.classList.remove("hidden");
  for (const r of resumes) {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = r.name || "Untitled";
    els.resumeSelect.appendChild(opt);
  }
  const toSelect = selectId && resumes.some(r => r.id === selectId) ? selectId : resumes[0].id;
  els.resumeSelect.value = toSelect;
  els.resumeCount.textContent = `${resumes.length} / ${MAX_RESUMES} resume slots used`;
}

// ── Editor ─────────────────────────────────────────────────
function openEditor(mode, resume = null) {
  editorMode = mode;
  editorResumeId = resume?.id || null;
  els.editorTitle.textContent = mode === "edit" ? "✏️ Edit resume" : "✏️ Add resume";
  els.resumeName.value = resume?.name || "";
  els.resumeText.value = resume?.text || "";
  els.editor.classList.remove("hidden");
  els.resumeName.focus();
}

function closeEditor() {
  els.editor.classList.add("hidden");
  editorMode = "add";
  editorResumeId = null;
  els.resumeName.value = "";
  els.resumeText.value = "";
}

async function saveFromEditor() {
  const name = (els.resumeName.value || "").trim();
  const text = utils.normalize(els.resumeText.value);
  if (!name) {
    setStatus("Give this resume a name.", "e.g. \"ML Engineer\", \"Backend\", \"Full Stack\"", true);
    return;
  }
  if (!text || text.length < 50) {
    setStatus("Resume looks empty.", "Paste your full resume text — the more detail, the better.", true);
    return;
  }
  const resumes = await storageGetAll();
  if (editorMode === "add") {
    if (resumes.length >= MAX_RESUMES) {
      setStatus("You've hit the 5-resume limit.", "Delete one to make room.", true);
      return;
    }
    const newOne = { id: uid(), name, text };
    resumes.push(newOne);
    await storageSetAll(resumes);
    await renderResumeSelect(newOne.id);
    setStatus(`"${name}" is ready!`, "Head to a job page and hit Find My Best Resume.", true);
  } else {
    const idx = resumes.findIndex(r => r.id === editorResumeId);
    if (idx === -1) { setStatus("Couldn't save changes.", "Please try again.", true); return; }
    resumes[idx] = { ...resumes[idx], name, text };
    await storageSetAll(resumes);
    await renderResumeSelect(editorResumeId);
    setStatus(`"${name}" updated successfully.`, "", true);
  }
  closeEditor();
}

async function deleteSelectedResume() {
  const id = getSelectedId();
  if (!id) return;
  const resumes = await storageGetAll();
  const removed = resumes.find(r => r.id === id);
  const next = resumes.filter(r => r.id !== id);
  await storageSetAll(next);
  await renderResumeSelect(next[0]?.id || null);
  setStatus(`"${removed?.name || "Resume"}" removed.`, "You can add a new version anytime.", true);
  setWhy([]);
}

// ── Tab helpers ────────────────────────────────────────────
async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function requestJobText(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  } catch (_) {}
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, { type: "GET_JOB_TEXT" }, response => {
      if (chrome.runtime.lastError) { resolve({ ok: false, error: chrome.runtime.lastError.message }); return; }
      resolve(response);
    });
  });
}

// ── Confidence ─────────────────────────────────────────────
// Score is the PRIMARY signal. jdCount and gap are minor modifiers only.
function computeConfidence(best, second, jdCount) {
  const score = best?.score ?? 0;
  const gap = Math.max(0, score - (second?.score ?? 0));
  let base = score >= 75 ? 2 : score >= 50 ? 1 : 0;
  if (jdCount >= 8 && gap >= 20) base = Math.min(2, base + 1);
  if (jdCount <= 2 && score < 70) base = Math.max(0, base - 1);
  return base === 2 ? "High" : base === 1 ? "Medium" : "Low";
}

function setJdMeta(source) {
  const map = {
    selection: { cls: "selection", label: "✦ Used your highlighted text" },
    selector:  { cls: "selector",  label: "◈ Job section detected" },
    fallback:  { cls: "fallback",  label: "◎ Read full page text" },
  };
  const m = map[source] || map.fallback;
  els.jdMeta.innerHTML = `<span class="sourceBadge ${m.cls}">${m.label}</span>`;
}

// ── AI Integration ─────────────────────────────────────────

async function callClaude(apiKey, prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `Claude error ${res.status}`); }
  const d = await res.json();
  return d.content?.[0]?.text || "";
}

async function callOpenAI(apiKey, prompt) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `OpenAI error ${res.status}`); }
  const d = await res.json();
  return d.choices?.[0]?.message?.content || "";
}

async function callGemini(apiKey, prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `Gemini error ${res.status}`); }
  const d = await res.json();
  return d?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

function buildAIPrompt(jdText, bestResume, allResumes) {
  const others = allResumes.filter(r => r.id !== bestResume.id).map(r => r.name).join(", ");
  return `You are a resume coach. A job seeker is applying for a job and you're helping them optimize their resume.

JOB DESCRIPTION (first 2000 chars):
${jdText.slice(0, 2000)}

RECOMMENDED RESUME — "${bestResume.name}" (first 1500 chars):
${bestResume.text.slice(0, 1500)}

${others ? `OTHER RESUMES AVAILABLE: ${others}` : ""}

Give 3 specific, actionable suggestions to improve their chances:
1. One specific bullet point or achievement they should ADD to this resume based on what the JD emphasizes
2. One skill or keyword they should highlight more prominently
3. One thing to lead with in a cover letter or application note for this specific role

Be concise and specific. Reference actual words from the JD. Max 120 words total.
Format as plain text with numbered points. No markdown headers.`;
}

async function runAIAdvice(jdText, bestResume, allResumes) {
  const settings = await getSettings();
  if (!settings.provider || settings.provider === "none" || !settings.apiKey) return;

  els.aiAdviceBlock.classList.remove("hidden");
  els.aiAdviceContent.textContent = "✦ Thinking…";
  els.aiAdviceContent.className = "aiAdvice loading";

  try {
    const prompt = buildAIPrompt(jdText, bestResume, allResumes);
    let advice = "";
    if (settings.provider === "claude")  advice = await callClaude(settings.apiKey, prompt);
    else if (settings.provider === "openai") advice = await callOpenAI(settings.apiKey, prompt);
    else if (settings.provider === "gemini") advice = await callGemini(settings.apiKey, prompt);
    els.aiAdviceContent.textContent = advice.trim();
    els.aiAdviceContent.className = "aiAdvice";
  } catch (err) {
    els.aiAdviceContent.textContent = `⚠️ AI error: ${err.message}`;
    els.aiAdviceContent.className = "aiAdvice";
  }
}

// ── Application Tracker ────────────────────────────────────

async function renderTracker() {
  const allApps = await getApplications();
  const filter  = els.trackerFilter?.value || "24h";
  const now     = Date.now();

  const apps = allApps.filter(a => {
    if (filter === "all") return true;
    const loggedAt = a.loggedAt || 0;
    if (filter === "24h") return (now - loggedAt) < 24 * 60 * 60 * 1000;
    if (filter === "7d")  return (now - loggedAt) < 7 * 24 * 60 * 60 * 1000;
    return true;
  });

  if (apps.length === 0) {
    els.trackerEmpty.classList.remove("hidden");
    els.trackerStats.classList.add("hidden");
    els.trackerList.classList.add("hidden");
    return;
  }

  els.trackerEmpty.classList.add("hidden");
  els.trackerStats.classList.remove("hidden");
  els.trackerList.classList.remove("hidden");

  const highCount = apps.filter(a => a.confidence === "High").length;
  const avgScore  = Math.round(apps.reduce((s, a) => s + (a.score || 0), 0) / apps.length);
  els.trackerStats.innerHTML = `
    <div class="statBox">
      <div class="statNum">${apps.length}</div>
      <div class="statLabel">Applied</div>
    </div>
    <div class="statBox">
      <div class="statNum">${highCount}</div>
      <div class="statLabel">Strong Match</div>
    </div>
    <div class="statBox">
      <div class="statNum">${avgScore}%</div>
      <div class="statLabel">Avg Score</div>
    </div>`;

  els.trackerList.innerHTML = "";
  [...apps].reverse().forEach(app => {
    const scoreClass = app.confidence === "High" ? "high" : app.confidence === "Medium" ? "medium" : "low";
    const card = document.createElement("div");
    card.className = "appCard";
    card.innerHTML = `
      <div class="appCardHead">
        <div class="appTitle">${app.jobTitle || "Job Application"}</div>
        <button class="appDeleteBtn" data-id="${app.id}" title="Remove">✕</button>
      </div>
      <div class="appMeta">
        <span class="appResume">📄 ${app.resumeName}</span>
        <span class="appScore ${scoreClass}">${app.score}% · ${app.confidence}</span>
        <span class="appDate">${app.date}</span>
      </div>`;
    els.trackerList.appendChild(card);
  });

  els.trackerList.querySelectorAll(".appDeleteBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const apps2 = await getApplications();
      await setApplications(apps2.filter(a => a.id !== btn.dataset.id));
      renderTracker();
    });
  });
}

// ── CSV Export ─────────────────────────────────────────────
async function exportCSV() {
  const apps = await getApplications();
  if (apps.length === 0) return;
  const header = ["Job Title", "Resume Used", "Score", "Confidence", "Date", "URL"];
  const rows = apps.map(a => [
    `"${(a.jobTitle || "").replace(/"/g, '""')}"`,
    `"${(a.resumeName || "").replace(/"/g, '""')}"`,
    a.score || 0,
    a.confidence || "",
    a.date || "",
    `"${(a.url || "").replace(/"/g, '""')}"`,
  ]);
  const csv = [header.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `resumefit-applications-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function showLogButton(analysis) {
  lastAnalysis = analysis;
  els.logAppBlock.classList.remove("hidden");
  els.logAppBtn.disabled = false;
  els.logAppStatus.style.display = "none";
}

els.logAppBtn.addEventListener("click", async () => {
  if (!lastAnalysis) return;

  const tab = await getActiveTab();
  const jobTitle = tab?.title
    ? tab.title.replace(/\s*[-|–—].*$/, "").trim().slice(0, 80)
    : "Job Application";

  const apps = await getApplications();
  apps.push({
    id:         uid(),
    jobTitle,
    resumeName: lastAnalysis.bestName,
    score:      lastAnalysis.score,
    confidence: lastAnalysis.confidence,
    date:       new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    url:        tab?.url || "",
    loggedAt:   Date.now(),
  });
  await setApplications(apps);

  els.logAppBtn.disabled = true;
  els.logAppStatus.textContent = "✅ Logged!";
  els.logAppStatus.style.display = "block";

  // Fire n8n webhook if configured
  const settings = await getSettings();
  if (settings.n8nWebhook) {
    fetch(settings.n8nWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobTitle:   jobTitle,
        company:    tab?.url ? new URL(tab.url).hostname : "",
        resumeUsed: lastAnalysis.bestName,
        score:      lastAnalysis.score,
        confidence: lastAnalysis.confidence,
        url:        tab?.url || "",
        date:       new Date().toISOString(),
      }),
    }).catch(() => {}); // fire and forget
  }
});

// ── Settings ───────────────────────────────────────────────

async function loadSettings() {
  const s = await getSettings();
  els.aiProvider.value = s.provider || "none";
  els.apiKeyInput.value = s.apiKey || "";
  els.n8nWebhook.value  = s.n8nWebhook || "";
  toggleApiKeyRow(s.provider);
  updateAIBadge(s.provider, s.apiKey);
}

function toggleApiKeyRow(provider) {
  if (!provider || provider === "none") {
    els.apiKeyRow.classList.add("hidden");
    return;
  }
  els.apiKeyRow.classList.remove("hidden");
  const hints = {
    gemini:  { label: "Google Gemini API Key — aistudio.google.com/app/apikey (free tier available)", hint: "Starts with AIza…" },
    claude:  { label: "Anthropic API Key — console.anthropic.com", hint: "Starts with sk-ant-…" },
    openai:  { label: "OpenAI API Key — platform.openai.com/api-keys", hint: "Starts with sk-…" },
  };
  const h = hints[provider] || hints.openai;
  els.apiKeyLabel.textContent = h.label;
  els.apiKeyHint.textContent  = h.hint;
}

function updateAIBadge(provider, apiKey) {
  const active = provider && provider !== "none" && apiKey;
  els.aiBadge.classList.toggle("hidden", !active);
  const labels = { gemini: "Gemini AI", claude: "Claude AI", openai: "GPT-4o" };
  els.footerEngine.textContent = active
    ? `⚙️ v2 · ${labels[provider] || "AI"}`
    : "⚙️ v2 · keyword engine";
}

els.aiProvider.addEventListener("change", () => toggleApiKeyRow(els.aiProvider.value));

els.toggleKeyBtn.addEventListener("click", () => {
  els.apiKeyInput.type = els.apiKeyInput.type === "password" ? "text" : "password";
  els.toggleKeyBtn.textContent = els.apiKeyInput.type === "password" ? "👁" : "🙈";
});

els.saveSettingsBtn.addEventListener("click", async () => {
  const provider = els.aiProvider.value;
  const apiKey = els.apiKeyInput.value.trim();
  if (provider !== "none" && !apiKey) {
    els.settingsStatus.textContent = "⚠️ Please enter your API key.";
    return;
  }
  await setSettings({ provider, apiKey });
  updateAIBadge(provider, apiKey);
  els.settingsStatus.textContent = "✅ Saved!";
  setTimeout(() => { els.settingsStatus.textContent = ""; }, 2000);
});

els.clearSettingsBtn.addEventListener("click", async () => {
  await setSettings({ provider: "none", apiKey: "" });
  els.aiProvider.value = "none";
  els.apiKeyInput.value = "";
  els.apiKeyRow.classList.add("hidden");
  updateAIBadge("none", "");
  els.settingsStatus.textContent = "Key cleared.";
  setTimeout(() => { els.settingsStatus.textContent = ""; }, 2000);
});

// ── Analyze ────────────────────────────────────────────────
async function analyzeCurrentPage() {
  els.resultMain.className = "resultName";
  els.resultMain.textContent = "Scanning job description…";
  els.resultSub.textContent = "Comparing your resumes now…";
  els.pillContainer.innerHTML = "";
  els.resultCard.classList.add("analyzing");
  els.aiAdviceBlock.classList.add("hidden");
  els.logAppBlock.classList.add("hidden");
  els.aiNudge.classList.add("hidden");
  setWhy([]);

  const resumes = await storageGetAll();
  const usable = resumes.filter(r => r.text && utils.normalize(r.text).length >= 50);

  if (usable.length === 0) {
    setStatus("No resumes to compare.", "Add at least one resume to get started.", true);
    return;
  }

  const tab = await getActiveTab();
  if (!tab?.id) {
    setStatus("Can't access this tab.", "Make sure you're on a job posting page.", true);
    return;
  }

  const resp = await requestJobText(tab.id);
  els.resultCard.classList.remove("analyzing");

  if (!resp?.ok) {
    setStatus("Couldn't read this page.", "Try highlighting the job description and running again.", true);
    return;
  }

  const jdText = utils.normalize(resp.text);
  setJdMeta(resp.source);

  if (!jdText || jdText.length < 300) {
    setStatus("Job description too short.", "Try highlighting the full job description text.", true);
    return;
  }

  const results = usable.map(r => ({
    id: r.id,
    name: r.name || "Untitled",
    ...utils.scoreResumeAgainstJD(jdText, r.text)
  }));

  const sorted = [...results].sort((a, b) => b.score - a.score);
  const best   = sorted[0];
  const second = sorted[1] || null;
  const confidence = computeConfidence(best, second, best.jdSkillsCount || 0);

  setStatus(`Submit: ${best.name}`, "Best match for this job posting.");
  setPill(confidence);
  setWhy(buildWhy(best, second));

  // Show log button with analysis data
  showLogButton({ bestName: best.name, score: best.score, confidence });

  // Show quick copy bar in Match tab (from saved Info data)
  const qi = await storageGet(QUICKINFO_KEY, {});
  renderIconCopyBar(qi);

  // Show AI nudge if no key set, otherwise run AI
  const settings = await getSettings();
  const hasAI = settings.provider && settings.provider !== "none" && settings.apiKey;
  els.aiNudge.classList.toggle("hidden", hasAI);

  // Run AI in background (non-blocking)
  const bestResumeFull = usable.find(r => r.id === best.id);
  if (bestResumeFull) {
    runAIAdvice(jdText, bestResumeFull, usable);
  }
}

// ── Events ─────────────────────────────────────────────────
els.addResumeBtn.addEventListener("click", () => openEditor("add"));
els.editResumeBtn.addEventListener("click", async () => {
  const id = getSelectedId();
  const resumes = await storageGetAll();
  const r = resumes.find(x => x.id === id);
  if (r) openEditor("edit", r);
});
els.deleteResumeBtn.addEventListener("click", deleteSelectedResume);
els.closeEditorBtn.addEventListener("click", closeEditor);
els.saveResumeBtn.addEventListener("click", saveFromEditor);
els.analyzeBtn.addEventListener("click", analyzeCurrentPage);

// AI nudge → jump to settings tab
els.aiNudge.addEventListener("click", () => {
  els.tabs.forEach(t => t.classList.remove("active"));
  els.tabPanes.forEach(p => p.classList.add("hidden"));
  document.querySelector('[data-tab="settings"]').classList.add("active");
  document.getElementById("tab-settings").classList.remove("hidden");
});

// Tracker filter
els.trackerFilter.addEventListener("change", () => renderTracker());

// CSV export
els.exportCsvBtn.addEventListener("click", exportCSV);

// n8n webhook save/clear
els.saveN8nBtn.addEventListener("click", async () => {
  const s = await getSettings();
  s.n8nWebhook = els.n8nWebhook.value.trim();
  await setSettings(s);
  els.n8nStatus.textContent = s.n8nWebhook ? "✅ Webhook saved!" : "Webhook cleared.";
  setTimeout(() => { els.n8nStatus.textContent = ""; }, 2000);
});

els.clearN8nBtn.addEventListener("click", async () => {
  const s = await getSettings();
  s.n8nWebhook = "";
  await setSettings(s);
  els.n8nWebhook.value = "";
  els.n8nStatus.textContent = "Webhook cleared.";
  setTimeout(() => { els.n8nStatus.textContent = ""; }, 2000);
});


// ── Info Tab ───────────────────────────────────────────────

const INFO_FIELDS = [
  { key: "email",     label: "Email",     type: "email" },
  { key: "phone",     label: "Phone",     type: "tel"   },
  { key: "linkedin",  label: "LinkedIn",  type: "url"   },
  { key: "github",    label: "GitHub",    type: "url"   },
  { key: "portfolio", label: "Portfolio", type: "url"   },
  { key: "location",  label: "Location",  type: "text"  },
];

// SVG icons for the icon-only quick copy bar
const QC_ICONS = {
  email:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  phone:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.08 3.18 2 2 0 0 1 3.05 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z"/></svg>`,
  linkedin:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>`,
  github:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>`,
  portfolio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  location:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
};
const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

async function renderInfoTab() {
  const data = await storageGet(QUICKINFO_KEY, {});
  INFO_FIELDS.forEach(f => {
    const input = document.getElementById("info-" + f.key);
    if (input) input.value = data[f.key] || "";
  });
  // No quick copy bar in Info tab — it lives in Match tab
}

// Renders the icon-only quick-copy bar in the Match tab
function renderIconCopyBar(data) {
  const bar = document.getElementById("matchQuickBar");
  const row = document.getElementById("qcIconRow");
  if (!bar || !row) return;

  const ICON_FIELDS = ["email","linkedin","github","portfolio"];
  const filled = ICON_FIELDS.filter(k => data[k]);

  if (!filled.length) { bar.style.display = "none"; return; }

  bar.style.display = "";
  row.innerHTML = filled.map(k => {
    const field = INFO_FIELDS.find(f => f.key === k);
    return `
      <button class="qcIconBtn" data-key="${k}"
        data-val="${(data[k]||"").replace(/"/g,"&quot;")}"
        data-tooltip="${(data[k]||"").slice(0,35)}">
        ${QC_ICONS[k] || ""}
        <span class="qcIconLabel">${field.label}</span>
      </button>`;
  }).join("");

  row.querySelectorAll(".qcIconBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.val;
      if (!val) return;
      navigator.clipboard.writeText(val).then(() => {
        const origInner = btn.innerHTML;
        btn.classList.add("copied");
        btn.innerHTML = CHECK_ICON + `<span class="qcIconLabel">Copied!</span>`;
        setTimeout(() => {
          btn.classList.remove("copied");
          btn.innerHTML = origInner;
        }, 1800);
      });
    });
  });
}

// Save info
document.getElementById("saveInfoBtn").addEventListener("click", async () => {
  const data = {};
  INFO_FIELDS.forEach(f => {
    const v = (document.getElementById("info-" + f.key)?.value || "").trim();
    if (v) data[f.key] = v;
  });
  await storageSet(QUICKINFO_KEY, data);
  renderIconCopyBar(data); // refresh in Match tab if visible
  const status = document.getElementById("infoStatus");
  status.textContent = "✅ Details saved!";
  setTimeout(() => { status.textContent = ""; }, 2000);
});

// ── Init ───────────────────────────────────────────────────
(async () => {
  await renderResumeSelect();
  await loadSettings();
  setWhy([]);
  await renderInfoTab();
})();