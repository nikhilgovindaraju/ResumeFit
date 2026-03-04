// popup.js — ResumeFit v1

const utils = window.ResumeSelectorUtils;

const els = {
  resumeSelect:     document.getElementById("resumeSelect"),
  resumeControls:   document.getElementById("resumeControls"),
  emptyResumeState: document.getElementById("emptyResumeState"),
  addResumeBtn:     document.getElementById("addResumeBtn"),
  editResumeBtn:    document.getElementById("editResumeBtn"),
  deleteResumeBtn:  document.getElementById("deleteResumeBtn"),
  resumeCount:      document.getElementById("resumeCount"),

  editor:         document.getElementById("editor"),
  editorTitle:    document.getElementById("editorTitle"),
  closeEditorBtn: document.getElementById("closeEditorBtn"),
  saveResumeBtn:  document.getElementById("saveResumeBtn"),
  resumeName:     document.getElementById("resumeName"),
  resumeText:     document.getElementById("resumeText"),

  analyzeBtn:    document.getElementById("analyzeBtn"),
  jdMeta:        document.getElementById("jdMeta"),
  resultCard:    document.getElementById("resultCard"),
  resultMain:    document.getElementById("resultMain"),
  resultSub:     document.getElementById("resultSub"),
  pillContainer: document.getElementById("pillContainer"),
  whyList:       document.getElementById("whyList"),
};

const STORAGE_KEY = "resume_selector_resumes_min_v1";
const MAX_RESUMES = 5;

let editorMode = "add";
let editorResumeId = null;

// ── Storage ────────────────────────────────────────────────
async function storageGetAll() {
  return new Promise(r => chrome.storage.local.get([STORAGE_KEY], d => r(d[STORAGE_KEY] || [])));
}

async function storageSetAll(resumes) {
  return new Promise(r => chrome.storage.local.set({ [STORAGE_KEY]: resumes }, r));
}

function uid() { return Math.random().toString(36).slice(2, 10); }

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
  const labels = {
    high:   "✅ Strong match",
    medium: "🟡 Decent match",
    low:    "⚠️ Weak match"
  };
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
    bullets.push(`💡 Consider adding these to boost your score: ${chips(missing, "miss")}`);
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
      setStatus("You've hit the 5-resume limit.", "Delete one to make room for a new version.", true);
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
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, { type: "GET_JOB_TEXT" }, response => {
      if (chrome.runtime.lastError) { resolve({ ok: false, error: chrome.runtime.lastError.message }); return; }
      resolve(response);
    });
  });
}

// ── Confidence ─────────────────────────────────────────────
function computeConfidence(best, second, jdCount) {
  const gap = Math.max(0, (best?.score ?? 0) - (second?.score ?? 0));
  let base = jdCount >= 10 ? 2 : jdCount >= 6 ? 1 : 0;
  if (gap >= 15) base++;
  else if (gap <= 5) base--;
  if ((best?.score ?? 0) < 55) base--;
  base = Math.max(0, Math.min(2, base));
  return base === 2 ? "High" : base === 1 ? "Medium" : "Low";
}

// ── JD source badge ────────────────────────────────────────
function setJdMeta(source) {
  const map = {
    selection: { cls: "selection", label: "✦ Used your highlighted text" },
    selector:  { cls: "selector",  label: "◈ Job section detected" },
    fallback:  { cls: "fallback",  label: "◎ Read full page text" },
  };
  const m = map[source] || map.fallback;
  els.jdMeta.innerHTML = `<span class="sourceBadge ${m.cls}">${m.label}</span>`;
}

// ── Analyze ────────────────────────────────────────────────
async function analyzeCurrentPage() {
  els.resultMain.className = "resultName";
  els.resultMain.textContent = "Scanning job description…";
  els.resultSub.textContent = "Hang on, comparing your resumes now.";
  els.pillContainer.innerHTML = "";
  els.resultCard.classList.add("analyzing");
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
    setStatus("Couldn't read this page.", "Try highlighting the job description text and running again.", true);
    return;
  }

  const jdText = utils.normalize(resp.text);
  setJdMeta(resp.source);

  if (!jdText || jdText.length < 300) {
    setStatus("Job description too short to analyze.", "Try highlighting the full job description text.", true);
    return;
  }

  const results = usable.map(r => ({
    id: r.id,
    name: r.name || "Untitled",
    ...utils.scoreResumeAgainstJD(jdText, r.text)
  }));

  const sorted = [...results].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const second = sorted[1] || null;
  const confidence = computeConfidence(best, second, best.jdSkillsCount || 0);

  setStatus(`Submit: ${best.name}`, "Best match for this job posting.");
  setPill(confidence);
  setWhy(buildWhy(best, second));
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

// ── Init ───────────────────────────────────────────────────
(async () => { await renderResumeSelect(); setWhy([]); })();