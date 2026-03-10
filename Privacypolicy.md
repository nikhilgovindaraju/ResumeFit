# Privacy Policy — ResumeFit

**Last updated: March 2026**

ResumeFit ("the extension", "we", "our") is committed to protecting your privacy. This policy explains what data the extension accesses, how it is used, and what is never collected.

---

## Summary

ResumeFit is a **fully local** Chrome extension. Your resume text, personal details, and browsing activity are never sent to any server we operate. We have no backend, no database, and no analytics.

---

## 1. Data We Store Locally

All data is stored exclusively in `chrome.storage.local` on your device. It is never transmitted to us.

| Data | What it is | Where it lives |
|---|---|---|
| **Resume text** | The resume content you paste in | `chrome.storage.local` — your device only |
| **Resume names** | Labels you give each resume (e.g. "Frontend") | `chrome.storage.local` — your device only |
| **Contact info** | Email, phone, LinkedIn, GitHub, portfolio, location you optionally save in the Info tab | `chrome.storage.local` — your device only |
| **Application log** | Job title, company domain, resume used, match score, date, URL — logged when you click ＋ Log | `chrome.storage.local` — your device only |
| **Settings** | Your chosen AI provider name and API key (if entered), n8n webhook URL (if entered) | `chrome.storage.local` — your device only |
| **FAB position** | Where you last dragged the floating button | `chrome.storage.local` — your device only |

You can delete all stored data at any time by going to `chrome://extensions` → ResumeFit → **Clear data**, or by uninstalling the extension.

---

## 2. Data Sent to Third Parties

ResumeFit may send data to third parties **only in two optional, user-initiated scenarios**:

### 2a. AI Suggestions (optional)

If you choose to connect an AI provider in Settings, the extension will send a request directly from your browser to that provider's public API when you click Analyze. The request contains:

- A portion of the job description text (up to ~1,200 characters) from the page you are currently viewing
- The name of your best-matched resume and its matched/missing skills
- Names of your other resumes (not their content)

**Your API key is sent directly to the provider in the request header — it is never routed through our servers because we have no servers.**

The data sent is governed by the privacy policy of the provider you choose:
- [Google Gemini API Privacy Policy](https://policies.google.com/privacy)
- [Anthropic Privacy Policy](https://www.anthropic.com/privacy)
- [OpenAI Privacy Policy](https://openai.com/policies/privacy-policy)

Using AI suggestions is entirely optional. The extension works fully without any API key.

### 2b. n8n Webhook (optional)

If you enter an n8n webhook URL in Settings, the extension will send a JSON payload to that URL each time you click **＋ Log**. The payload contains:

```json
{
  "jobTitle": "...",
  "company": "domain of the job page",
  "resumeUsed": "name of your resume",
  "score": 85,
  "confidence": "High",
  "url": "URL of the job posting",
  "date": "ISO timestamp"
}
```

**No resume text, no personal contact info, and no API keys are included in this payload.** The n8n webhook is your own infrastructure — we do not operate or receive data from it.

Using the n8n webhook is entirely optional and disabled by default.

---

## 3. Data We Do NOT Collect

- We do not collect, store, or transmit your resume text to any server.
- We do not collect your browsing history.
- We do not use analytics, telemetry, or crash reporting.
- We do not use cookies.
- We do not sell or share any data with advertisers or data brokers.
- We do not have a server, database, or backend of any kind.

---

## 4. Permissions Justification

The extension requests the following Chrome permissions:

| Permission | Why it is needed |
|---|---|
| `storage` | To save your resumes, contact info, settings, and application log locally on your device using `chrome.storage.local` |
| `activeTab` | To read the job description from the page you are currently viewing when you click Analyze |
| `scripting` | To inject the floating panel into job posting pages |
| `tabs` | To read the current tab's URL and title when logging an application to your tracker |
| `host_permissions: https://*/*` | To allow the floating panel content script to activate on job posting pages across all job boards — including company-specific ATS platforms (Greenhouse, Workday, Lever, Ashby, Oracle HCM, Taleo) that each use unique domains. The extension is excluded from common non-job sites (Google Mail, GitHub, social media, etc.) |

---

## 5. Children's Privacy

ResumeFit is designed for adult job seekers. We do not knowingly collect any information from children under the age of 13.

---

## 6. Changes to This Policy

If we update this policy, we will update the "Last updated" date at the top. Significant changes will be noted in the extension's changelog.

---

## 7. Contact

If you have questions about this privacy policy, open an issue on the GitHub repository or contact the developer directly through the Chrome Web Store listing page.

---

*ResumeFit is open source. You can verify exactly what the extension does by reading the source code in the repository.*