# ResumeFit 🎯

> **Know which resume wins — before you apply.**

ResumeFit is a free, open-source Chrome extension that instantly tells you which of your saved resumes is the best match for any job posting. No AI subscriptions, no data sent anywhere — everything runs locally in your browser.

---

## ✨ What it does

Open any job posting, click the ResumeFit icon, and in one click you'll see:

- ✅ **Which resume to submit** — ranked by skill overlap with the job description
- 🧠 **Why it's the best fit** — matched skills, score gap vs your other resumes, and missing keywords to consider adding
- 🟢 **Confidence level** — Strong / Decent / Weak match, so you know how seriously to take the result

---

## 🖥️ Supported Job Boards

ResumeFit works on all major job boards including:

| Platform | Support |
|---|---|
| LinkedIn | ✅ |
| Greenhouse | ✅ |
| Lever | ✅ |
| Ashby | ✅ |
| Indeed | ✅ |
| Workday | ✅ |
| Smartrecruiters | ✅ |
| Any other page | ✅ (highlight JD text → Analyze) |

---

## 🚀 Install (Developer Mode)

Until the Chrome Web Store listing is live, install it manually:

1. **Clone or download this repo**
   ```bash
   git clone https://github.com/YOUR_USERNAME/resumefit.git
   ```

2. **Open Chrome Extensions**
   Go to `chrome://extensions` in your browser

3. **Enable Developer Mode**
   Toggle the switch in the top-right corner

4. **Load the extension**
   Click **"Load unpacked"** → select the `resumefit` folder

5. **Pin it**
   Click the puzzle icon in Chrome toolbar → pin ResumeFit

---

## 📖 How to use

1. **Add your resumes**
   Click the ResumeFit icon → `+ Add a resume` → paste your resume text → give it a name (e.g. "ML Engineer", "Backend", "PM")

2. **Open a job posting**
   Navigate to any job listing on LinkedIn, Greenhouse, Ashby, etc.

3. **Click "Find My Best Resume"**
   ResumeFit extracts the job description, scores all your resumes, and recommends the best one with a full breakdown.

> **Tip:** If the extension can't auto-detect the JD (rare), just highlight the job description text on the page and then click Analyze.

---

## 🏗️ Project Structure

```
resumefit/
├── manifest.json      # Extension config (Manifest V3)
├── popup.html         # Extension popup UI
├── popup.css          # Styles
├── popup.js           # UI logic & orchestration
├── content.js         # Page-level JD extraction
├── utils.js           # Skill detection & resume scoring engine
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

---

## ⚙️ How the matching works

ResumeFit uses a **local skill overlap engine** — no AI, no API calls:

1. Extracts the job description from the current page
2. Normalizes text and expands aliases (e.g. `torch` → `pytorch`, `tf` → `tensorflow`)
3. Detects skills from a curated dictionary (languages, ML tools, SWE practices, etc.)
4. Scores each saved resume by skill overlap with the JD
5. Adds a small bonus for general keyword frequency
6. Caps unrealistic scores when JD signal is weak
7. Returns the top match with a confidence label and "why" breakdown

---

## 🔒 Privacy

- **No data ever leaves your browser.** All processing is local.
- Resumes are stored using `chrome.storage.local` — only on your machine.
- No analytics, no tracking, no servers.

---

## 🗺️ Roadmap

- [ ] Chrome Web Store listing
- [ ] Floating in-page panel (like Jobright) 
- [ ] ATS simulation signals
- [ ] Auto-trigger on recognized job boards
- [ ] Application history tracker
- [ ] Export match report

---

## 🤝 Contributing

Pull requests are welcome! If you find a job board that doesn't work, open an issue with the URL and I'll add selector support.

1. Fork the repo
2. Create a branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

<p align="center">Built for job seekers, by a job seeker. ⚡</p>