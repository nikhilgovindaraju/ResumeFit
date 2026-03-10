# ResumeFit 🎯

> **Know which resume wins — before you apply.**

ResumeFit is a free Chrome extension that instantly tells you which of your saved resumes best matches any job posting. A floating 🎯 button appears on every job page — click it to get a full breakdown in seconds. Everything runs locally in your browser. Nothing is ever sent to a server.

---

## ✨ Features

### 🔍 Match Tab
- **Best resume recommendation** — scored by skill overlap with the job description
- **Visual score ring** — 0–100% match score at a glance
- **Confidence level** — Strong / Decent / Weak match, so you know how much to trust the result
- **Skills breakdown** — matched skills (green chips) and missing keywords (yellow chips)
- **Quick Copy bar** — one-click copy of your email, LinkedIn, GitHub, or portfolio link, right from the results
- **AI Suggestions** — optional: connect your own Gemini, Claude, or OpenAI key for tailored tips per job
- **＋ Log** — save the application to your tracker with one click

### 📊 Tracker Tab
- Log and track every job you apply to
- Stats: total applied, strong matches, average score
- Export to CSV
- Optional n8n webhook — auto-syncs every logged application to Google Sheets, Notion, or Airtable

### 🪪 Info Tab
- Save your email, phone, LinkedIn, GitHub, portfolio, and location once
- Stored locally — never uploaded
- After analysis, a **Quick Copy** bar appears in the Match tab so your details are always one click away

### ⚙️ Settings Tab
- Optional AI provider: Gemini (free tier), Claude, or OpenAI — BYOK (bring your own key)
- Your API key is stored locally on your device and sent directly to the provider — we never see it
- Optional n8n webhook URL for automation

### 🎯 Floating Panel
A draggable 🎯 button appears on every job posting page. Click it to open a side panel with all four tabs — Match, Tracker, Info, Settings — without leaving the page or opening a new tab.

---

## 🌐 Supported Job Boards

ResumeFit's 7-layer extraction engine works on:

| Platform | Detection Method |
|---|---|
| LinkedIn | CSS selector |
| Greenhouse (boards.greenhouse.io + embedded) | CSS selector |
| Lever | CSS selector |
| Workday | `data-automation-id` selector |
| Ashby | CSS selector |
| Indeed | CSS selector |
| SmartRecruiters | `itemprop="description"` |
| Oracle HCM / Taleo | `id`/class pattern matching |
| Any other ATS or company careers page | Smart density fallback |

> **Tip:** If the extension can't auto-detect the job description (rare on custom pages), just **highlight the job description text** on the page and then click Analyze. It will use your selection directly.

---

## 🚀 Install from Chrome Web Store

1. Go to the [ResumeFit listing on the Chrome Web Store](#) *(link will be live after review)*
2. Click **Add to Chrome**
3. Click the puzzle icon in your toolbar → pin ResumeFit
4. Navigate to any job posting and click the 🎯 button

---

## 🛠️ Install in Developer Mode (for contributors)

1. **Clone the repo**
   ```bash
   git clone https://github.com/YOUR_USERNAME/resumefit.git
   ```

2. **Open Chrome Extensions**
   Navigate to `chrome://extensions`

3. **Enable Developer Mode**
   Toggle the switch in the top-right corner

4. **Load the extension**
   Click **"Load unpacked"** → select the `resumefit/` folder

5. **Pin it**
   Click the puzzle icon → pin ResumeFit

---

## 📖 How to Use

### First time setup
1. Click the ResumeFit icon in your toolbar
2. Go to the **Match** tab → **＋ Add a resume**
3. Paste your resume text and give it a name (e.g. "ML Engineer", "Frontend", "PM")
4. Repeat for each tailored version you have (up to 5 resumes)
5. *(Optional)* Go to the **Info** tab → fill in your email, LinkedIn, etc. → **Save details**

### Analyzing a job
1. Open any job posting
2. Click the floating 🎯 button *or* click the ResumeFit toolbar icon
3. Click **⚡ Analyze this job** (or **Find My Best Resume** in the popup)
4. See your best resume, match score, skills breakdown, and Quick Copy bar
5. Click **＋ Log** to save the application to your tracker

### Optional: AI suggestions
1. Go to **Settings** → choose a provider (Gemini recommended — free tier available)
2. Paste your API key → **Save**
3. Re-analyze any job — you'll now get 3 tailored suggestions: a bullet to add, a keyword to highlight, and a tip for your cover letter

---

## ⚙️ How the Matching Works

ResumeFit uses a **local keyword scoring engine** — no AI required:

1. Extracts the job description from the page using a 7-layer pipeline (user selection → known ATS selectors → density fallback)
2. Normalizes text (lowercasing, smart aliases)
3. Detects ~80 technical skills from a curated dictionary (languages, frameworks, cloud tools, ML, databases, practices)
4. Scores each resume: `matched skills / total JD skills × 100`
5. Adds a small frequency-weighted bonus for non-skill keywords that appear prominently in the JD
6. Caps scores when the JD has weak signal (fewer than 5–8 detectable skills) to prevent false confidence
7. Computes a confidence level (High / Medium / Low) based on score, gap to second-best resume, and JD keyword richness

---

## 🔒 Privacy

- **No data ever leaves your browser.** All matching runs locally.
- Resumes, contact info, and tracker data are stored in `chrome.storage.local` — only on your device.
- **API keys** (if provided) are stored locally and sent directly to your chosen AI provider (Gemini, Anthropic, or OpenAI) when you request AI suggestions. We never receive or log them.
- **n8n webhook** (if configured) receives only the data you choose to log: job title, company domain, resume name, score, confidence, URL, and date. No resume text is ever sent.
- No analytics. No tracking. No servers of our own.

See [`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md) for the full policy.

---

## 🗺️ Changelog

### v3.1 (current)
- Floating panel: all 4 tabs fully functional (Match, Tracker, Info, Settings)
- Quick Copy icon bar now appears in the Match tab (after analysis), not Info tab
- AI nudge added to floating panel when no API key is set — click to jump to Settings
- Confidence level fixed: score is now the primary signal (83% = Strong match, as expected)
- JD extraction now works on Oracle HCM, all Greenhouse embedded widgets, and any custom ATS
- Consistent UI between popup and floating panel (same tab style, same colors, same Info form)

### v3.0
- Complete UI redesign: floating panel with Shadow DOM isolation
- Draggable FAB with saved position
- 4-tab panel: Match, Tracker, Info, Settings
- n8n webhook integration
- AI provider support: Gemini, Claude, OpenAI (BYOK)

### v2.1
- Universal host permissions for all ATS platforms
- Quick Info tab in floating panel
- Application tracker with CSV export

### v1.0
- Initial Chrome Web Store release
- Basic resume scoring and popup UI

---

## 🤝 Contributing

Pull requests are welcome!

If you find a job board that doesn't work, open an issue with the URL and I'll add selector support for it.

---

<p align="center">Built for job seekers, by a job seeker. ⚡</p>