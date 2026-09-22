(() => {
  // Most job sites change their markup pretty often, so I try not to depend
  // on generated CSS class names unless there is no better option.
  // Site-specific helpers below should prefer URLs, labels and semantic HTML.
  const RECORD_PREFIX = "jobRecord:";
  const OLD_PREFIX = "job:";
  const clean = s => String(s || "").replace(/\s+/g, " ").trim();
  const lower = s => clean(s).toLowerCase();

  function sourceSite() {
    return location.hostname.replace(/^www\./i, "").toLowerCase();
  }


function isLinkedInJobPage() {
  return /(^|\.)linkedin\.com$/i.test(location.hostname) &&
    /^\/jobs\/view\/\d+\/?/.test(location.pathname);
}

function linkedInJobId() {
  const m = location.pathname.match(/^\/jobs\/view\/(\d+)/);
  return m ? m[1] : "";
}

function firstText(selectors, root = document) {
  for (const selector of selectors) {
    const el = root.querySelector?.(selector);
    const value = clean(el?.innerText || el?.textContent || "");
    if (value) return value;
  }
  return "";
}

function linkedInTitle() {
  return firstText([
    ".job-details-jobs-unified-top-card__job-title h1",
    ".job-details-jobs-unified-top-card__job-title a",
    ".top-card-layout__title",
    ".topcard__title",
    "main h1",
    "h1"
  ]);
}

function linkedInCompany() {
  return firstText([
    ".job-details-jobs-unified-top-card__company-name a",
    ".job-details-jobs-unified-top-card__company-name",
    ".topcard__org-name-link",
    "a.topcard__org-name-link"
  ]).replace(/^@\s*/, "");
}

function linkedInDescriptionText() {
  for (const selector of [
    ".jobs-description__content",
    ".jobs-description-content__text",
    ".jobs-box__html-content",
    "#job-details",
    ".show-more-less-html__markup",
    ".description__text"
  ]) {
    const el = document.querySelector(selector);
    const value = clean(el?.innerText || el?.textContent || "");
    if (value && value.length > 150) return value;
  }
  return clean(document.body?.innerText || "");
}


function isRipplingJobPage() {
  return sourceSite() === "ats.rippling.com" &&
    /^\/[^/]+\/jobs\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i.test(location.pathname);
}

function ripplingPathParts() {
  const m = location.pathname.match(
    /^\/([^/]+)\/jobs\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i
  );
  return m ? { tenant: m[1], jobId: m[2] } : null;
}

function humanizeTenant(slug) {
  return clean(String(slug || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase()));
}

function getRipplingContext() {
  if (!isRipplingJobPage()) return null;

  const parts = ripplingPathParts();
  const text = clean(document.body?.innerText || "");
  const main = document.querySelector("main");
  const descriptionText = clean(main?.innerText || main?.textContent || text);

  const title = firstText([
    "main h1",
    "h1",
    '[data-testid*="job-title" i]',
    '[class*="job-title" i]'
  ]);

  let company = "";

  // Rippling tenant pages often state the company naturally near the top:
  // "At AbsenceSoft, we're transforming..."
  const atCompany = text.match(
    /\bAt\s+([A-Z][A-Za-z0-9&.'’\- ]{2,80}?),\s+(?:we|we're|we’re)\b/
  );
  if (atCompany) company = clean(atCompany[1]);

  if (!company) {
    for (const selector of [
      '[data-testid*="company" i]',
      '[class*="company-name" i]',
      'meta[property="og:site_name"]'
    ]) {
      const el = document.querySelector(selector);
      const value = clean(el?.content || el?.innerText || el?.textContent || "");
      if (value && !/^rippling$/i.test(value) && value.length <= 120) {
        company = value;
        break;
      }
    }
  }

  if (!company && parts?.tenant) company = humanizeTenant(parts.tenant);

  const cleanUrl = parts
    ? `${location.origin}/${parts.tenant}/jobs/${parts.jobId}`
    : location.href;

  return {
    type: "rippling",
    root: document,
    article: main,
    text,
    descriptionText,
    title,
    company,
    fullUrl: cleanUrl,
    jobId: parts?.jobId || "",
    tenant: parts?.tenant || ""
  };
}

  function isHiringCafeSite() {
    const host = sourceSite();
    return host === "hiring.cafe" || host === "hiringcafe.com" || host.endsWith(".hiring.cafe") || host.endsWith(".hiringcafe.com");
  }

  function absoluteUrl(href) {
    try { return new URL(href, location.origin).toString(); }
    catch { return ""; }
  }




function getHiringCafeContext() {
  if (!isHiringCafeSite()) return null;

  // Full job pages are easy because the /job/<slug> URL itself identifies
  // the posting. HiringCafe search results are harder because the main page
  // stays at / and the selected job is rendered in a modal/drawer.
  const isStandaloneJob = /^\/job\/[^/]+\/?$/i.test(location.pathname);

  if (isStandaloneJob) {
    const article = document.querySelector(
      'article.prose, article, main [class*="prose"], [class*="prose"]'
    );
    const title = clean(
      document.querySelector('main h1, h1')?.innerText ||
      document.querySelector('main h1, h1')?.textContent ||
      ""
    );

    if (!article || !title) return null;

    let company = "";

    // HiringCafe currently renders the company as "@ Company Name".
    // I use that before trying any generated class names.
    for (const el of document.querySelectorAll('span, a')) {
      const t = clean(el.innerText || el.textContent);
      if (/^@\s*\S/.test(t) && t.length <= 120) {
        company = clean(t.replace(/^@\s*/, ""));
        break;
      }
    }

    // Fallback if they stop rendering the @ company line.
    if (!company) {
      const orgLink = document.querySelector('a[href^="/org/"], a[href*="/org/"]');
      if (orgLink) {
        const href = orgLink.getAttribute("href") || "";
        const m = href.match(/\/org\/([^/?#]+)/i);
        if (m) company = clean(m[1].replace(/\.(com|io|ai|co|net|org)$/i, ""));
      }
    }

    const fullUrl = location.href;
    const slug = location.pathname.replace(/\/$/, "").split("/").filter(Boolean).pop() || "";
    const tail = slug.match(/-([a-z0-9]{8,})$/i);
    const jobId = tail ? tail[1] : slug;

    return {
      type: "hiringcafe",
      layout: "standalone",
      root: document,
      article,
      text: clean(document.body?.innerText || ""),
      descriptionText: clean(article.innerText || article.textContent || ""),
      title,
      company,
      fullUrl,
      jobId
    };
  }

  // For the search-results drawer, the most stable thing HiringCafe gives us
  // is the "Full View" link. Start there and walk up to the job panel.
  // This avoids depending on Chakra vs Ant vs whatever UI library they use next.
  const fullViewLinks = [...document.querySelectorAll('a[href^="/job/"], a[href*="hiringcafe.com/job/"]')]
    .filter(a => /full\s*view/i.test(clean(a.innerText || a.textContent)));

  // Prefer a visible Full View link because the page can keep old/hidden UI
  // fragments around while a different job drawer is open.
  const visibleFullView = fullViewLinks.find(a => {
    const rect = a.getBoundingClientRect?.();
    const style = getComputedStyle(a);
    return style.display !== "none" &&
      style.visibility !== "hidden" &&
      (!rect || (rect.width > 0 && rect.height > 0));
  }) || fullViewLinks[0];

  let root = null;

  if (visibleFullView) {
    root =
      visibleFullView.closest('[role="dialog"]') ||
      visibleFullView.closest('.chakra-modal__content') ||
      visibleFullView.closest('.ant-drawer-content') ||
      visibleFullView.closest('.ant-modal-content') ||
      visibleFullView.closest('[class*="drawer"]') ||
      visibleFullView.closest('[class*="modal"]');
  }

  // Fallback for a future HiringCafe redesign:
  // find any visible region that contains an h1 and the real job article.
  if (!root) {
    const candidates = [
      ...document.querySelectorAll('[role="dialog"]'),
      ...document.querySelectorAll('[class*="drawer"]'),
      ...document.querySelectorAll('[class*="modal"]')
    ];

    root = candidates.find(el => {
      const article = el.querySelector?.('article.prose, article, [class*="prose"]');
      const h1 = el.querySelector?.('h1');
      if (!article || !h1) return false;

      const style = getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    }) || null;
  }

  if (!root) return null;

  const article = root.querySelector('article.prose, article, [class*="prose"]');
  const title = clean(
    root.querySelector('h1')?.innerText ||
    root.querySelector('h1')?.textContent ||
    ""
  );

  if (!article || !title) return null;

  let company = "";

  // Same company rule as the standalone page.
  for (const el of root.querySelectorAll('span, a')) {
    const t = clean(el.innerText || el.textContent);
    if (/^@\s*\S/.test(t) && t.length <= 120) {
      company = clean(t.replace(/^@\s*/, ""));
      break;
    }
  }

  if (!company) {
    const orgLink = root.querySelector('a[href^="/org/"], a[href*="/org/"]');
    if (orgLink) {
      const href = orgLink.getAttribute("href") || "";
      const m = href.match(/\/org\/([^/?#]+)/i);
      if (m) company = clean(m[1].replace(/\.(com|io|ai|co|net|org)$/i, ""));
    }
  }

  // Re-resolve Full View inside the selected panel in case the first link came
  // from a stale hidden drawer.
  const panelFullView =
    [...root.querySelectorAll('a[href^="/job/"], a[href*="hiringcafe.com/job/"]')]
      .find(a => /full\s*view/i.test(clean(a.innerText || a.textContent))) ||
    visibleFullView;

  const fullUrl = panelFullView
    ? absoluteUrl(panelFullView.getAttribute("href"))
    : "";

  let jobId = "";

  if (fullUrl) {
    try {
      const path = new URL(fullUrl).pathname.replace(/\/$/, "");
      const slug = path.split("/").filter(Boolean).pop() || "";

      // HiringCafe appends an opaque id to the end of the slug.
      const tail = slug.match(/-([a-z0-9]{8,})$/i);
      jobId = tail ? tail[1] : slug;
    } catch {}
  }

  return {
    type: "hiringcafe",
    layout: "drawer",
    root,
    article,
    text: clean(root.innerText || root.textContent || ""),
    descriptionText: clean(article.innerText || article.textContent || ""),
    title,
    company,
    fullUrl,
    jobId
  };
}

  function canonicalUrl(context = null) {
    if ((context?.type === "hiringcafe" || context?.type === "rippling") && context.fullUrl) return context.fullUrl;

    const u = new URL(location.href);
    ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","ref","source","trk","trackingId","src","campaign","campaignid"]
      .forEach(k => u.searchParams.delete(k));
    u.hash = "";
    return u.toString();
  }



function buildPageContext() {
  const hiringCafe = getHiringCafeContext();
  if (hiringCafe) return hiringCafe;

  const rippling = getRipplingContext();
  if (rippling) return rippling;

  const pageText = clean(document.body?.innerText || "");

  if (isLinkedInJobPage()) {
    return {
      type: "linkedin",
      root: document,
      article: null,
      text: pageText,
      descriptionText: linkedInDescriptionText(),
      title: linkedInTitle(),
      company: linkedInCompany(),
      fullUrl: location.href,
      jobId: linkedInJobId()
    };
  }

  return {
    type: "generic",
    root: document,
    article: null,
    text: pageText,
    descriptionText: pageText,
    title: "",
    company: "",
    fullUrl: "",
    jobId: ""
  };
}

  function parseJobPostingJsonLd(root = document) {
    const found = [];
    const walk = value => {
      if (!value) return;
      if (Array.isArray(value)) return value.forEach(walk);
      if (typeof value !== "object") return;
      const type = value["@type"];
      if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) found.push(value);
      if (value["@graph"]) walk(value["@graph"]);
    };

    for (const script of root.querySelectorAll?.('script[type="application/ld+json"]') || []) {
      try { walk(JSON.parse(script.textContent)); } catch {}
    }
    return found[0] || null;
  }

  function looksLikeJobPage(context, jobLd) {
    if (context.type === "hiringcafe" || context.type === "linkedin" || context.type === "rippling") return true;
    if (jobLd) return true;
    const t = context.text.toLowerCase();
    const hints = [
      "job description", "responsibilities", "qualifications", "requirements",
      "apply now", "apply for this job", "compensation", "salary",
      "what you'll do", "what you’ll do", "about the role"
    ];
    return hints.filter(h => t.includes(h)).length >= 2;
  }

  function getTitle(jobLd, context) {
    if (context.title) return context.title;
    return [
      jobLd?.title,
      document.querySelector("h1")?.innerText,
      document.querySelector('[data-testid*="job-title" i]')?.innerText,
      document.querySelector('[class*="job-title" i]')?.innerText,
      document.querySelector('meta[property="og:title"]')?.content,
      document.title
    ].map(clean).find(Boolean) || "Unknown job";
  }

  function getCompany(jobLd, context) {
    if (context.company) return context.company;

    const org = jobLd?.hiringOrganization;
    const ldName = clean(typeof org === "string" ? org : org?.name);
    if (ldName) return ldName;

    for (const s of [
      '[data-testid*="company" i]', '[class*="company-name" i]',
      '[class*="employer" i]', '[class*="company" i]', 'meta[property="og:site_name"]'
    ]) {
      const el = document.querySelector(s);
      const v = clean(el?.content || el?.innerText);
      if (v && v.length <= 140) return v;
    }
    return sourceSite();
  }

  function identifierFromLd(jobLd) {
    const id = jobLd?.identifier;
    if (!id) return "";
    if (typeof id === "string" || typeof id === "number") return clean(id);
    return clean(id.value || id.name || "");
  }

  function extractJobId(text, jobLd, context) {
    if (context.jobId) return context.jobId;

    const ld = identifierFromLd(jobLd);
    if (ld) return ld;

    const u = new URL(location.href);
    for (const name of ["jobId","jobid","job_id","jid","gh_jid","reqId","reqid","requisitionId","requisition_id","positionId","postingId"]) {
      const val = u.searchParams.get(name);
      if (val) return clean(val);
    }

    for (const re of [
      /\b(?:job|requisition|req|position|posting)\s*(?:id|#|number|no\.?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._-]{2,})\b/i,
      /\b(?:job|requisition)\s*#\s*([A-Z0-9][A-Z0-9._-]{2,})\b/i
    ]) {
      const m = text.match(re);
      if (m) return clean(m[1]);
    }

    for (const re of [
      /\/jobs?\/([A-Za-z0-9_-]{4,})/i,
      /\/positions?\/([A-Za-z0-9_-]{4,})/i,
      /\/requisitions?\/([A-Za-z0-9_-]{4,})/i
    ]) {
      const m = location.pathname.match(re);
      if (m) return clean(m[1]);
    }
    return "";
  }

  function normalizeCompany(company) {
    return lower(company)
      .replace(/\b(incorporated|inc|llc|ltd|corp|corporation|company|co)\b\.?/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Prefer the site's job id whenever possible. URLs can contain tracking
  // parameters or change between search results and the employer application page.
  function makeIdentity(site, jobId, company, title, url) {
    if (jobId) return `${site}|${clean(jobId).toLowerCase().replace(/\s+/g, "")}`;
    const c = normalizeCompany(company) || "unknown";
    const t = lower(title).replace(/[^a-z0-9+#.]+/g, "-").slice(0, 120);
    return `${site}|fallback|${c}|${t || encodeURIComponent(url)}`;
  }

  

function salaryCandidates(text) {
  const regexes = [
    // $100,000 - $150,000 / $140k-$200k
    /\$\s?(\d{2,3}(?:,\d{3})*(?:\.\d+)?|\d{2,3}(?:\.\d+)?\s*[kK])\s*(?:-|–|—|to)\s*\$?\s?(\d{2,3}(?:,\d{3})*(?:\.\d+)?|\d{2,3}(?:\.\d+)?\s*[kK])(?:\s*(?:USD|per\s+year|\/year|annually|a year|yr))?/gi,

    // 107,500 USD - 204,500 USD
    /(\d{2,3}(?:,\d{3})+(?:\.\d+)?)\s*USD\s*(?:-|–|—|to)\s*(\d{2,3}(?:,\d{3})+(?:\.\d+)?)\s*USD(?:\s*per\s+year)?/gi,

    // Rippling: 155,200 - 194,000 USD per year
    /(\d{2,3}(?:,\d{3})+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d{2,3}(?:,\d{3})+(?:\.\d+)?)\s*USD(?:\s*per\s+year)?/gi,

    // Hourly
    /\$\s?(\d{2,3}(?:\.\d+)?)\s*(?:-|–|—|to)\s*\$?\s?(\d{2,3}(?:\.\d+)?)(?:\s*(?:USD|per\s+hour|\/hour|hourly|hr))/gi
  ];

  const results = [];
  for (const re of regexes) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const context = text.slice(
        Math.max(0, start - 180),
        Math.min(text.length, end + 180)
      );

      let score = (start / Math.max(text.length, 1)) * 100;
      if (/\b(pay range|salary range|compensation range|base pay|base salary|annual salary)\b/i.test(context)) score += 90;
      else if (/\b(salary|compensation|pay)\b/i.test(context)) score += 40;
      if (/\b(per year|annually|annual|yearly|salary|compensation|base pay)\b/i.test(context)) score += 18;
      if (/\b(per hour|hourly|\/hour|hr)\b/i.test(m[0])) score -= 10;

      results.push({
        text: clean(m[0]),
        index: start,
        context: clean(context),
        score
      });
    }
  }

  // Regexes can overlap. De-duplicate identical visible ranges.
  const unique = [];
  const seen = new Set();
  for (const item of results.sort((a, b) => b.score - a.score)) {
    const key = item.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

  function formatSalaryFromLd(jobLd) {
    const base = jobLd?.baseSalary;
    if (!base) return "";
    try {
      const value = base.value || base;
      const min = value.minValue ?? value.value;
      const max = value.maxValue ?? value.value;
      const unit = clean(value.unitText || "");
      const currency = clean(base.currency || jobLd.salaryCurrency || "USD");
      if (min != null && max != null) {
        return `${currency} ${Number(min).toLocaleString()} - ${Number(max).toLocaleString()}${unit ? " / " + unit : ""}`;
      }
    } catch {}
    return "";
  }


function extractSalary(context, jobLd) {
  const descriptionCandidates = salaryCandidates(context.descriptionText || "");

  if (context.type === "rippling" && descriptionCandidates.length) {
    const ordered = [...descriptionCandidates].sort((a, b) => a.index - b.index);
    const payBands = ordered
      .filter(c => /\bUSD(?:\s+per\s+year)?\b/i.test(c.text))
      .slice(0, 4);

    if (payBands.length > 1) {
      return {
        value: payBands.map(c => c.text).join(" | "),
        source: "Rippling job description — pay bands",
        context: payBands.map(c => c.context).join(" • ")
      };
    }
  }

  // HiringCafe and similar sites often show a rounded salary badge near the top,
  // while the actual employer pay range appears in the full job description.
  if (descriptionCandidates.length) {
    const c = descriptionCandidates[0];
    const isPayRange = /\b(pay range|salary range|compensation range|base pay|base salary)\b/i.test(c.context);
    return {
      value: c.text,
      source: isPayRange ? "Job Description — Pay Range" : "job description",
      context: c.context
    };
  }

  const pageCandidates = salaryCandidates(context.text || "");
  if (pageCandidates.length) {
    const c = pageCandidates[0];
    return {
      value: c.text,
      source: c.index > context.text.length * 0.55 ? "bottom of page" : "page text",
      context: c.context
    };
  }

  const ld = formatSalaryFromLd(jobLd);
  return ld
    ? { value: ld, source: "job metadata", context: "" }
    : { value: "", source: "", context: "" };
}

  function extractTravel(scanText) {
    const text = clean(scanText || "");
    const noTravel = text.match(/.{0,120}\b(?:no\s+(?:business\s+)?travel|travel\s*[:\-]?\s*none|0\s*%\s*travel)\b.{0,120}/i);
    if (noTravel) return { value: "No", context: clean(noTravel[0]) };

    for (const re of [
      /.{0,140}\b(?:travel(?:ing)?(?:\s+required)?(?:\s+up\s+to)?|up\s+to)\s*[:\-]?\s*(\d{1,3})\s*%\b.{0,140}/i,
      /.{0,140}\b(\d{1,3})\s*%\s*(?:travel|travelling|traveling)\b.{0,140}/i
    ]) {
      const m = text.match(re);
      if (m) return { value: `${m[1]}%`, context: clean(m[0]) };
    }

    const travel = text.match(/.{0,140}\b(?:ability\s+to\s+travel|travel(?:ing)?(?:\s+required)?|travel\s+quarterly|quarterly\s+travel)\b.{0,170}/i);
    return travel ? { value: "Yes", context: clean(travel[0]) } : { value: "No", context: "" };
  }

  async function keywordResults(scanText) {
    const { keywords = [] } = await chrome.storage.sync.get(["keywords"]);
    const text = clean(scanText || "");
    const t = text.toLowerCase();

    return keywords.map(keyword => {
      const k = clean(keyword);
      const kl = k.toLowerCase();
      let found;

      if (kl === "c#") found = /(^|[^a-z0-9])c#([^a-z0-9]|$)/i.test(text);
      else if (kl === ".net") found = /(^|[^a-z0-9])\.net([^a-z0-9]|$)/i.test(text);
      else found = t.includes(kl);

      return { keyword: k, found };
    });
  }

  async function existing(identity, url) {
    const key = RECORD_PREFIX + identity;
    const current = await chrome.storage.local.get([key]);
    if (current[key]) return current[key];

    const old = await chrome.storage.local.get([OLD_PREFIX + url]);
    return old[OLD_PREFIX + url] || null;
  }

  // This is the main job scan. It refreshes scraped fields, but keeps the
  // user's manual status/history such as Applied, Crossed Off and notes.
  async function analyzeAndSaveViewed() {
    const context = buildPageContext();
    const jobLd = parseJobPostingJsonLd(context.root || document);
    if (!looksLikeJobPage(context, jobLd)) return null;

    const url = canonicalUrl(context);
    const website = sourceSite();
    const title = getTitle(jobLd, context);
    const company = getCompany(jobLd, context);
    const jobId = extractJobId(context.text, jobLd, context);
    const identity = makeIdentity(website, jobId, company, title, url);
    const old = await existing(identity, url);
    const salary = extractSalary(context, jobLd);
    const travel = extractTravel(context.descriptionText || context.text);
    const now = new Date().toISOString();

    const record = {
      identity,
      jobId,
      title,
      company,
      website,
      url,
      status: old?.status || "viewed",
      firstViewedAt: old?.firstViewedAt || now,
      lastViewedAt: now,
      appliedAt: old?.appliedAt || null,
      crossedOffAt: old?.crossedOffAt || null,
      salary: salary.value,
      salarySource: salary.source,
      salaryContext: salary.context,
      travel: travel.value,
      travelContext: travel.context,
      keywords: await keywordResults(context.descriptionText || context.text),
      notes: old?.notes || ""
    };

    await chrome.storage.local.set({ [RECORD_PREFIX + identity]: record });
    renderBadge(record.status);
    return record;
  }

  function renderBadge(status) {
    let el = document.getElementById("job-scout-status-badge");
    if (!el) {
      el = document.createElement("div");
      el.id = "job-scout-status-badge";
      document.documentElement.appendChild(el);
    }
    el.dataset.status = status;
    el.textContent = status === "applied"
      ? "✓ Already Applied"
      : status === "crossed_off"
        ? "✕ Crossed Off"
        : "◉ Viewed";
  }

  function normLabel(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^\w+#.]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function associatedText(el) {
    const parts = [];
    for (const attr of ["name", "id", "placeholder", "aria-label", "autocomplete", "data-testid", "data-qa", "data-automation-id"]) {
      const value = attr === "name" ? el.name : attr === "id" ? el.id : attr === "placeholder" ? el.placeholder : el.getAttribute?.(attr);
      if (value) parts.push(value);
    }

    if (el.labels) {
      for (const lab of el.labels) parts.push(lab.innerText || lab.textContent || "");
    }

    if (el.id) {
      try {
        const explicit = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (explicit) parts.push(explicit.innerText || explicit.textContent || "");
      } catch {}
    }

    const parentLabel = el.closest?.("label");
    if (parentLabel) parts.push(parentLabel.innerText || parentLabel.textContent || "");

    const wrapper = el.closest?.("fieldset, .form-group, .field, .question, .application-question, [role='group'], [class*='field'], [class*='question']");
    if (wrapper) {
      const legend = wrapper.querySelector("legend");
      if (legend) parts.push(legend.innerText || legend.textContent || "");
      for (const nearby of wrapper.querySelectorAll("label, .label, .question-label, [class*='label'], [class*='question']")) {
        const t = nearby.innerText || nearby.textContent || "";
        if (t) parts.push(t);
      }
    }

    return normLabel(parts.join(" "));
  }

  function setNativeValue(el, value) {
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function chooseSelectOption(select, desired) {
    const d = normLabel(desired);
    const options = [...select.options];
    const aliases = {
      "yes": ["yes", "authorized", "i am authorized"],
      "no": ["no", "not a veteran", "i am not a veteran", "not hispanic", "not latino"],
      "female": ["female", "woman"],
      "white": ["white", "caucasian"],
      "prefer not to answer": ["prefer not", "decline", "do not wish", "choose not"]
    };
    const acceptable = [d, ...(aliases[d] || [])];

    let best = options.find(o => acceptable.some(a => normLabel(o.textContent).includes(a)));
    if (!best) best = options.find(o => normLabel(o.value) === d);
    if (!best) return false;

    select.value = best.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function chooseRadioOrCheckbox(inputs, desired) {
    const d = normLabel(desired);
    const aliases = {
      "yes": ["yes"],
      "no": ["no"],
      "female": ["female", "woman"],
      "white": ["white", "caucasian"],
      "prefer not to answer": ["prefer not", "decline", "do not wish"]
    };
    const acceptable = [d, ...(aliases[d] || [])];

    for (const el of inputs) {
      const txt = associatedText(el) + " " + normLabel(el.value);
      if (acceptable.some(a => txt.includes(a))) {
        el.click();
        return true;
      }
    }
    return false;
  }

  function fieldTypeFromText(text) {
    const t = normLabel(text);
    if (t.includes("linkedin")) return "linkedin";

    if (
      (t.includes("legally authorized") || t.includes("authorized to work") ||
       t.includes("authorization to work") || t.includes("work authorization")) &&
      (t.includes("united states") || t.includes("u s") || t.includes("us"))
    ) return "workAuthorizedUS";

    if (t.includes("hispanic") || t.includes("latino") || t.includes("latina") || t.includes("latinx")) return "hispanic";
    if (t.includes("veteran")) return "veteran";
    if (t.includes("gender") || t.includes("sex")) return "gender";
    if (t.includes("ethnicity") || t.includes("race")) return "ethnicity";
    return null;
  }


  function textMatchesRule(fieldText,rule){const field=normLabel(fieldText),match=normLabel(rule?.match||"");if(!match)return false;return rule?.matchType==="exact"?field===match:field.includes(match)}
  function fillOneElement(el,desired){if(el.disabled||el.readOnly)return false;if(el.tagName==="SELECT")return chooseSelectOption(el,desired);if(el.type==="radio"||el.type==="checkbox")return false;setNativeValue(el,desired);return true}
  function applyCustomAutofillRules(rules=[]){const results=[];const fields=[...document.querySelectorAll("input, textarea, select")].filter(el=>!el.disabled&&el.type!=="hidden"&&el.type!=="submit"&&el.type!=="button");for(const rule of rules){if(!rule?.match)continue;let filled=false,matchedText="";for(const el of fields){if(el.type==="radio"||el.type==="checkbox")continue;const text=associatedText(el);if(!textMatchesRule(text,rule))continue;if(fillOneElement(el,rule.value)){filled=true;matchedText=text;break}}if(!filled){const groups={};for(const el of fields.filter(x=>x.type==="radio"||x.type==="checkbox")){const key=el.name||el.id||"__anon_"+Math.random().toString(36);(groups[key]||=[]).push(el)}for(const group of Object.values(groups)){const groupText=group.map(associatedText).join(" ");if(!textMatchesRule(groupText,rule))continue;if(chooseRadioOrCheckbox(group,rule.value)){filled=true;matchedText=groupText;break}}}results.push({match:rule.match,value:rule.value,filled,matchedText})}return results}

  function fillApplicationForm(profile, customRules = []) {
    const summary = {
      linkedin: false,
      workAuthorizedUS: false,
      ethnicity: false,
      veteran: false,
      gender: false,
      hispanic: false,
      filledCount: 0,
      fieldCount: 0,
      frameUrl: location.href
    };

    const fields = [...document.querySelectorAll("input, textarea, select")]
      .filter(el => !el.disabled && el.type !== "hidden" && el.type !== "submit" && el.type !== "button");
    summary.fieldCount = fields.length;

    for (const el of fields) {
      if (el.type === "radio" || el.type === "checkbox") continue;
      const type = fieldTypeFromText(associatedText(el));
      if (!type || summary[type]) continue;

      const desired = profile[type];
      if (!desired) continue;

      let ok = false;
      if (el.tagName === "SELECT") ok = chooseSelectOption(el, desired);
      else {
        setNativeValue(el, desired);
        ok = true;
      }

      if (ok) {
        summary[type] = true;
        summary.filledCount++;
      }
    }

    const radioGroups = {};
    for (const el of fields.filter(x => x.type === "radio" || x.type === "checkbox")) {
      const key = el.name || el.id || Math.random().toString(36);
      (radioGroups[key] ||= []).push(el);
    }

    for (const group of Object.values(radioGroups)) {
      const combined = group.map(associatedText).join(" ");
      const type = fieldTypeFromText(combined);
      if (!type || summary[type]) continue;

      const desired = profile[type];
      if (!desired) continue;

      if (chooseRadioOrCheckbox(group, desired)) {
        summary[type] = true;
        summary.filledCount++;
      }
    }

    const customRuleResults = applyCustomAutofillRules(customRules);
    summary.customRules = customRuleResults;
    summary.customFilledCount = customRuleResults.filter(r => r.filled).length;
    summary.filledCount += summary.customFilledCount;

    return summary;
  }


async function getCurrentSavedRecord() {
  const context = buildPageContext();
  const jobLd = parseJobPostingJsonLd(context.root || document);

  if (!looksLikeJobPage(context, jobLd)) return null;

  const title = getTitle(jobLd, context);
  const company = getCompany(jobLd, context);
  const jobId = extractJobId(context.text, jobLd, context);
  const website = sourceSite();
  const url = canonicalUrl(context);
  const identity = makeIdentity(website, jobId, company, title, url);

  return await existing(identity, url);
}

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

if (msg?.type === "JOB_SCOUT_GET_SAVED_CURRENT") {
  getCurrentSavedRecord()
    .then(record => sendResponse({ ok: true, record }))
    .catch(err => sendResponse({ ok: false, error: String(err) }));
  return true;
}
    if (msg?.type === "JOB_SCOUT_AUTOFILL") {
      try {
        const summary = fillApplicationForm(msg.profile || {}, msg.customRules || []);
        sendResponse({ ok: true, summary });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
      return true;
    }

    if (msg?.type === "JOB_SCOUT_ANALYZE" || msg?.type === "JOB_SCOUT_REFRESH_BADGE") {
      analyzeAndSaveViewed()
        .then(record => sendResponse({ ok: true, record }))
        .catch(err => sendResponse({ ok: false, error: String(err) }));
      return true;
    }
  });


// HiringCafe is the one exception to the manual Load Job rule.
// I browse a lot of jobs from the search-result drawer, so waiting for a button
// click on every result defeats the point. Only a real HiringCafe drawer with a
// Full View job URL gets auto-saved.
if (window.top === window && isHiringCafeSite() && document.body) {
  let lastAutoScannedUrl = "";
  let observerTimer = null;

  const maybeAutoScanHiringCafeDrawer = () => {
    const context = getHiringCafeContext();

    // Standalone /job/... pages still require Load Job.
    if (!context || context.layout !== "drawer" || !context.fullUrl) return;

    const root = context.root;
    if (!root || !document.documentElement.contains(root)) return;

    const style = getComputedStyle(root);
    if (style.display === "none" || style.visibility === "hidden") return;

    if (context.fullUrl === lastAutoScannedUrl) return;

    const urlBeingScanned = context.fullUrl;

    analyzeAndSaveViewed()
      .then(record => {
        // Only remember the URL after a successful save. If HiringCafe rendered
        // the drawer in stages, the observer gets another chance to retry.
        if (record) lastAutoScannedUrl = urlBeingScanned;
      })
      .catch(() => {
        lastAutoScannedUrl = "";
      });
  };

  // Covers a drawer already open when the content script is injected/reloaded.
  setTimeout(maybeAutoScanHiringCafeDrawer, 500);

  const observer = new MutationObserver(() => {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(maybeAutoScanHiringCafeDrawer, 300);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "class", "aria-hidden"]
  });
}

})();
