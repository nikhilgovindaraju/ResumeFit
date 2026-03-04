// utils.js (Corrected + reliable C++ detection)

const SKILLS = [
    // Languages
    "python", "java", "javascript", "typescript", "c", "c++", "c#", "go", "golang",
    "ruby", "php", "swift", "kotlin", "sql",
  
    // ML / Data
    "machine learning", "artificial intelligence", "ai", "ml",
    "recommendation systems", "recommender systems",
    "pattern recognition", "data mining",
    "pytorch", "tensorflow",
  
    // Quality / Reliability
    "code reviews", "testing", "unit testing", "integration testing", "end-to-end", "e2e",
    "monitoring", "observability", "logging", "reliability", "rollout", "debugging",
  
    // Web / Backend (optional)
    "node", "node.js", "express", "nestjs", "fastapi", "flask", "django",
    "spring", "spring boot", "rest", "rest api", "graphql", "grpc", "microservices"
  ];
  
  // Aliases / expansions
  const ALIASES = [
    { pattern: /\btorch\b/gi, replace: "pytorch" },
    { pattern: /\btf\b/gi, replace: "tensorflow" },
    { pattern: /\bend\s*to\s*end\b/gi, replace: "end-to-end" },
    { pattern: /\bend\-to\-end\b/gi, replace: "end-to-end" },
    { pattern: /\brecommender\b/gi, replace: "recommender systems" },
    { pattern: /\brecommendations\b/gi, replace: "recommendation systems" },
  
    // Robust: expand C/C++ forms (no word-boundary around ++)
    { pattern: /c\s*\/\s*c\+\+/gi, replace: "c c++" },
    { pattern: /c\/c\+\+/gi, replace: "c c++" }
  ];
  
  const STOPWORDS = new Set([
    "a","an","the","and","or","to","of","in","on","for","with","at","by","from","as","is","are","was","were","be","been",
    "this","that","these","those","you","your","we","our","they","their","it","its","will","would","should","can","could",
    "experience","years","year","role","job","work","working","skills","skill","ability","responsibilities","requirements",
    "preferred","plus","strong","good","great","using","use","build","building","develop","development","software","engineer",
    "engineering","team","teams","system","systems","design","deliver","support","knowledge",
    "if","us","etc","also","including","include","must","may","able","based","across","within","through","about","who","what",
    "non","new","time","one","two","three","into","out","up","down","over","under","more","most","less","least"
  ]);
  
  function normalize(str) {
    let t = (str || "")
      .toLowerCase()
      .replace(/\u00A0/g, " ")
      .replace(/[“”]/g, '"')
      .replace(/[’]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  
    for (const a of ALIASES) t = t.replace(a.pattern, a.replace);
    return t;
  }
  
  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  
  /**
   * Matching strategy:
   * - For plain words (java, python): word boundary \b
   * - For "special" tokens or phrases (c++, node.js, rest api):
   *   use "non-alphanumeric boundary" style:
   *   (^|[^a-z0-9]) SKILL (?=$|[^a-z0-9])
   * This safely allows: C++/, C++., (C++), C/C++, etc.
   */
  function hasSkill(textNorm, skill) {
    const s = skill.toLowerCase();
    const escaped = escapeRegex(s);
  
    const isPlainWord = !s.includes(" ") && !/[+#.]/.test(s);
  
    if (isPlainWord) {
      return new RegExp(`\\b${escaped}\\b`, "i").test(textNorm);
    }
  
    // Special/phrase skill: allow punctuation around it
    return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(textNorm);
  }
  
  function unique(arr) {
    return Array.from(new Set(arr));
  }
  
  function extractSkills(textNorm) {
    const found = [];
    for (const skill of SKILLS) {
      if (hasSkill(textNorm, skill)) found.push(skill.toLowerCase());
    }
    return unique(found);
  }
  
  function makeSafeTokens(textNorm) {
    const cleaned = textNorm.replace(/[^a-z0-9+#.\s-]/g, " ");
    const parts = cleaned.split(/\s+/g).filter(Boolean);
    return parts.filter(t => t.length >= 3 && !STOPWORDS.has(t));
  }
  
  function scoreResumeAgainstJD(jdText, resumeText) {
    const jdNorm = normalize(jdText);
    const resNorm = normalize(resumeText);
  
    const jdSkills = extractSkills(jdNorm);
  
    // small token assist only (kept tiny)
    const tokens = makeSafeTokens(jdNorm);
    const freq = new Map();
    for (const tok of tokens) freq.set(tok, (freq.get(tok) || 0) + 1);
  
    const topTokens = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([t]) => t);
  
    const matchedSkills = jdSkills.filter(s => hasSkill(resNorm, s));
    const missingSkills = jdSkills.filter(s => !hasSkill(resNorm, s));
  
    // Score based mainly on skills
    const denom = Math.max(jdSkills.length, 1);
    let score = Math.round((matchedSkills.length / denom) * 100);
  
    // small bonus for token overlap
    let extra = 0;
    for (const kw of topTokens) {
      const re = new RegExp(`\\b${escapeRegex(kw)}\\b`, "i");
      if (re.test(resNorm)) extra++;
    }
    score += Math.min(10, extra);
  
    // Trust cap: avoid unrealistic 100% scores when JD skill list is small
    if (jdSkills.length < 8) score = Math.min(score, 92);
    if (jdSkills.length < 5) score = Math.min(score, 85);
  
    score = Math.max(0, Math.min(100, score));
  
    return {
      score,
      matched: unique(matchedSkills).slice(0, 12),
      missing: unique(missingSkills).slice(0, 12),
      jdSkillsCount: jdSkills.length
    };
  }
  
  function pickBestResume(results) {
    let best = results[0];
    for (const r of results) {
      if (r.score > best.score) best = r;
    }
    return best;
  }
  
  window.ResumeSelectorUtils = {
    normalize,
    scoreResumeAgainstJD,
    pickBestResume
  };