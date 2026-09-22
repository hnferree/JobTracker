const PREFIX = "jobRecord:";
let currentRecord = null;
const $ = id => document.getElementById(id);

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function setStatusUI(status) {
  document.querySelectorAll("[data-status]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.status === status);
  });
  $("appliedBanner").hidden = status !== "applied";
  $("crossedBanner").hidden = status !== "crossed_off";
}

function renderKeywords(results) {
  const grid = $("keywordGrid");
  grid.innerHTML = "";
  for (const item of (results || [])) {
    const row = document.createElement("div");
    row.className = "keyword";

    const name = document.createElement("span");
    name.textContent = item.keyword;

    const value = document.createElement("span");
    value.className = item.found ? "yes" : "no";
    value.textContent = item.found ? "YES" : "NO";

    row.append(name, value);
    grid.appendChild(row);
  }
}

function formatDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString(); }
  catch { return iso; }
}

function render(record) {
  $("loading").hidden = true;
  $("notJob").hidden = true;

  if (!record) {
    $("job").hidden = true;
    $("notJob").hidden = false;
    $("notJob").querySelector("p").textContent = "This page was not recognized as a job. Use Add Manually if you want to track it.";
    return;
  }

  currentRecord = record;
  $("job").hidden = false;
  $("title").textContent = record.title || "Unknown job";
  $("company").textContent = record.company || "Unknown company";
  $("jobId").textContent = record.jobId || "Not found";
  $("website").textContent = record.website || "";
  $("travel").textContent = record.travel || "No";
  $("travelContext").textContent = record.travelContext || "";
  $("salary").textContent = record.salary || "Not found";
  $("salarySource").textContent = record.salary
    ? `Detected from ${record.salarySource || "page"}`
    : "No pay range found";
  $("notes").value = record.notes || "";
  $("lastScan").textContent = record.lastViewedAt ? `Last scanned: ${formatDate(record.lastViewedAt)}` : "";

  renderKeywords(record.keywords);
  setStatusUI(record.status);
}

async function scanJob({ manual = false } = {}) {
  const tab = await activeTab();
  if (!tab?.id) return render(null);

  const scanButton = $("scanJob");
  const scanMessage = $("scanMessage");

  if (manual) {
    scanButton.disabled = true;
    scanButton.textContent = "Scanning…";
    scanMessage.textContent = "Refreshing job details without changing your saved status or notes.";
  }

  try {
    const response = await sendToJobScanner(tab.id, { type: "JOB_SCOUT_ANALYZE" });
    if (!response?.ok) throw new Error(response?.error || "Scan failed");
    render(response.record || null);
    if (manual) {
      scanMessage.textContent = response.record ? "✓ Scan complete" : "No job description detected on this page.";
    }
  } catch (error) {
    render(null);
    if (manual) scanMessage.textContent = "Could not scan this page. Refresh the page and try again.";
  } finally {
    if (manual) {
      scanButton.disabled = false;
      scanButton.textContent = "↻ Scan Job";
    }
  }
}

async function saveRecord(record) {
  await chrome.storage.local.set({ [PREFIX + record.identity]: record });
}

document.querySelectorAll("[data-status]").forEach(btn => {
  btn.addEventListener("click", async () => {
    if (!currentRecord) return;

    const now = new Date().toISOString();
    const nextStatus = btn.dataset.status;
    currentRecord.status = nextStatus;
    currentRecord.lastUpdatedAt = now;

    // Preserve historical dates. Mark the first time a job was applied/crossed off.
    if (nextStatus === "applied" && !currentRecord.appliedAt) currentRecord.appliedAt = now;
    if (nextStatus === "crossed_off" && !currentRecord.crossedOffAt) currentRecord.crossedOffAt = now;

    await saveRecord(currentRecord);
    setStatusUI(currentRecord.status);

    const tab = await activeTab();
    if (tab?.id) {
      try { await chrome.tabs.sendMessage(tab.id, { type: "JOB_SCOUT_REFRESH_BADGE" }); } catch {}
    }
  });
});


$("saveNotes").addEventListener("click", async () => {
  if (!currentRecord) return;
  currentRecord.notes = $("notes").value.trim();
  currentRecord.lastUpdatedAt = new Date().toISOString();
  await saveRecord(currentRecord);
  $("saveNotes").textContent = "Saved";
  setTimeout(() => $("saveNotes").textContent = "Save notes", 900);
});

$("options").addEventListener("click", () => chrome.runtime.openOptionsPage());
$("editKeywords").addEventListener("click", () => chrome.runtime.openOptionsPage());

function csvCell(value) {
  if (Array.isArray(value)) {
    value = value.map(x => typeof x === "object"
      ? `${x.keyword}:${x.found ? "YES" : "NO"}`
      : String(x)
    ).join("; ");
  }
  const s = String(value ?? "");
  return '"' + s.replaceAll('"', '""') + '"';
}

$("exportCsv").addEventListener("click", async () => {
  const all = await chrome.storage.local.get(null);
  const rows = Object.entries(all)
    .filter(([k]) => k.startsWith(PREFIX))
    .map(([, v]) => v);

  const headers = [
    "status", "jobId", "title", "company", "website", "url",
    "salary", "salarySource", "travel", "keywords",
    "firstViewedAt", "lastViewedAt", "appliedAt", "crossedOffAt", "notes"
  ];

  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map(r => headers.map(h => csvCell(r[h])).join(","))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({
    url,
    filename: "job-scout-tracker.csv",
    saveAs: true
  });
  setTimeout(() => URL.revokeObjectURL(url), 3000);
});



document.getElementById("editProfile")?.addEventListener("click", () => chrome.runtime.openOptionsPage());

document.getElementById("fillApplication")?.addEventListener("click", async () => {
  const button = document.getElementById("fillApplication");
  const result = document.getElementById("fillResult");
  button.disabled = true;
  button.textContent = "Filling…";
  result.textContent = "Scanning application form, including embedded frames…";

  try {
    const {
      applicationProfile = {},
      customAutofillRules = []
    } = await chrome.storage.sync.get(["applicationProfile", "customAutofillRules"]);

    const tab = await activeTab();
    if (!tab?.id) throw new Error("No active tab");

    let frames = [];
    try {
      frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id }) || [];
    } catch {}
    if (!frames.length) frames = [{ frameId: 0, url: tab.url || "" }];

    const message = {
      type: "JOB_SCOUT_AUTOFILL",
      profile: applicationProfile,
      customRules: customAutofillRules
    };

    const frameResponses = [];
    for (const frame of frames) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, message, { frameId: frame.frameId });
        if (response?.ok && response.summary) {
          frameResponses.push({ frame, summary: response.summary });
        }
      } catch {
        // Frames where Chrome cannot inject (browser/internal pages, restricted frames) are ignored.
      }
    }

    if (!frameResponses.length) {
      throw new Error("No accessible application frames found");
    }

    const combined = {
      linkedin: false,
      workAuthorizedUS: false,
      ethnicity: false,
      veteran: false,
      gender: false,
      hispanic: false,
      filledCount: 0,
      fieldCount: 0,
      customRules: [],
      framesWithFields: 0
    };

    for (const { summary } of frameResponses) {
      for (const key of ["linkedin", "workAuthorizedUS", "ethnicity", "veteran", "gender", "hispanic"]) {
        combined[key] ||= Boolean(summary[key]);
      }
      combined.filledCount += Number(summary.filledCount || 0);
      combined.fieldCount += Number(summary.fieldCount || 0);
      if (Number(summary.fieldCount || 0) > 0) combined.framesWithFields++;
      if (Array.isArray(summary.customRules)) combined.customRules.push(...summary.customRules);
    }

    const names = [];
    if (combined.linkedin) names.push("LinkedIn");
    if (combined.workAuthorizedUS) names.push("work authorization");
    if (combined.ethnicity) names.push("ethnicity/race");
    if (combined.veteran) names.push("veteran status");
    if (combined.gender) names.push("gender");
    if (combined.hispanic) names.push("Hispanic/Latino");

    const customFilledNames = [...new Set(
      combined.customRules.filter(r => r?.filled).map(r => r.match).filter(Boolean)
    )];

    const parts = [];
    if (names.length) parts.push(`Filled ${names.join(", ")}.`);
    if (customFilledNames.length) parts.push(`Filled ${customFilledNames.length} custom rule${customFilledNames.length === 1 ? "" : "s"}.`);

    if (parts.length) {
      result.textContent = `${parts.join(" ")} Review the form before submitting.`;
    } else if (combined.fieldCount > 0) {
      result.textContent = `Found ${combined.fieldCount} form field${combined.fieldCount === 1 ? "" : "s"} across ${combined.framesWithFields || 1} frame${combined.framesWithFields === 1 ? "" : "s"}, but none matched your saved answers. Add a custom rule in Settings for the question wording.`;
    } else {
      result.textContent = "No fillable form fields were found. The application may still be loading; refresh the page and try again.";
    }
  } catch (err) {
    result.textContent = "Could not reach the application form. Refresh this page after reloading the updated extension and try again.";
  } finally {
    button.disabled = false;
    button.textContent = "Fill Application Form";
  }
});



function manualCompanyKey(company) {
  return String(company || "").toLowerCase()
    .replace(/\b(incorporated|inc|llc|ltd|corp|corporation|company|co)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function manualIdentity(website, jobId, company, title, url) {
  const site = String(website || "").toLowerCase().replace(/^www\./, "").trim();
  const jid = String(jobId || "").toLowerCase().replace(/\s+/g, "");
  if (jid) return `${site}|${jid}`;
  const c = manualCompanyKey(company) || "unknown";
  const t = String(title || "").toLowerCase().replace(/[^a-z0-9+#.]+/g, "-").slice(0, 120);
  return `${site}|fallback|${c}|${t || encodeURIComponent(url || "")}`;
}

function linkedInIdFromUrl(url) {
  try {
    const m = new URL(url).pathname.match(/^\/jobs\/view\/(\d+)/);
    return m ? m[1] : "";
  } catch { return ""; }
}

async function prefillManualEntry() {
  const tab = await activeTab();
  const url = tab?.url || "";
  let website = "";
  try { website = new URL(url).hostname.replace(/^www\./, ""); } catch {}

  $("manualUrl").value = url;
  $("manualWebsite").value = website;
  if (/linkedin\.com$/i.test(website)) $("manualJobId").value = linkedInIdFromUrl(url);

  if (currentRecord) {
    $("manualTitle").value ||= currentRecord.title || "";
    $("manualCompany").value ||= currentRecord.company || "";
    $("manualJobId").value ||= currentRecord.jobId || "";
    $("manualWebsite").value ||= currentRecord.website || website;
    $("manualUrl").value ||= currentRecord.url || url;
    $("manualSalary").value ||= currentRecord.salary || "";
    $("manualTravel").value ||= currentRecord.travel || "";
    $("manualNotes").value ||= currentRecord.notes || "";
  }
}

$("toggleManual")?.addEventListener("click", async () => {
  const panel = $("manualEntry");
  panel.hidden = !panel.hidden;
  $("toggleManual").textContent = panel.hidden ? "Add Manually" : "Hide";
  if (!panel.hidden) await prefillManualEntry();
});

// Manual entry is the safety net for any ATS/site that changes faster than
// the scraper. It writes to the same job store as a normal scan.
async function saveManualJob(status) {
  const title = $("manualTitle").value.trim();
  const company = $("manualCompany").value.trim();
  const jobId = $("manualJobId").value.trim();
  const website = $("manualWebsite").value.trim().replace(/^www\./i, "").toLowerCase();
  const url = $("manualUrl").value.trim();
  const salary = $("manualSalary").value.trim();
  const travel = $("manualTravel").value.trim();
  const notes = $("manualNotes").value.trim();

  if (!title || !company) {
    $("manualResult").textContent = "Enter at least Job Title and Company.";
    return;
  }

  const identity = manualIdentity(website, jobId, company, title, url);
  const key = PREFIX + identity;
  const oldData = await chrome.storage.local.get([key]);
  const old = oldData[key] || {};
  const now = new Date().toISOString();

  const record = {
    ...old, identity, jobId, title, company, website, url, salary, travel, notes,
    salarySource: salary ? "manual entry" : (old.salarySource || ""),
    keywords: old.keywords || [],
    status,
    firstViewedAt: old.firstViewedAt || now,
    lastViewedAt: now,
    appliedAt: status === "applied" ? (old.appliedAt || now) : (old.appliedAt || null),
    crossedOffAt: status === "crossed_off" ? now : (old.crossedOffAt || null),
    manuallyEntered: true
  };

  await chrome.storage.local.set({ [key]: record });
  currentRecord = record;
  $("manualResult").textContent =
    status === "applied" ? "Saved as Applied." :
    status === "crossed_off" ? "Saved as Crossed Off." : "Saved as Viewed.";
  setStatusUI(status);
}

$("manualViewed")?.addEventListener("click", () => saveManualJob("viewed"));
$("manualApplied")?.addEventListener("click", () => saveManualJob("applied"));
$("manualCrossed")?.addEventListener("click", () => saveManualJob("crossed_off"));



// Chrome does not automatically refresh content scripts in tabs that were
// already open when I reload the extension. If the message fails, inject the
// newest scanner and try once more instead of making me refresh the site.
async function sendToJobScanner(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (firstError) {
    // Common after updating/reloading an unpacked extension while a SPA tab
    // (such as HiringCafe) has remained open. Inject the current scanner and retry.
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      files: ["content.js"]
    });

    try {
      await chrome.scripting.insertCSS({
        target: { tabId, frameIds: [0] },
        files: ["content.css"]
      });
    } catch {}

    return await chrome.tabs.sendMessage(tabId, message);
  }
}


async function peekCurrentSavedJob() {
  const tab = await activeTab();
  if (!tab?.id) return;

  try {
    const response = await sendToJobScanner(tab.id, {
      type: "JOB_SCOUT_GET_SAVED_CURRENT"
    });
    if (response?.ok && response.record) {
      render(response.record);
      const result = document.getElementById("loadResult");
      if (result) {
        result.textContent = response.record.website?.includes("hiring")
          ? "✓ HiringCafe job auto-scanned."
          : "This job is already in your tracker.";
      }
    }
  } catch {
    // No scanner/current saved job is fine; Load Job remains available.
  }
}

async function loadCurrentJob() {
  const button = document.getElementById("loadJob");
  const result = document.getElementById("loadResult");
  const loading = document.getElementById("loading");

  button.disabled = true;
  button.textContent = "Loading Job…";
  result.textContent = "";

  try {
    const tab = await activeTab();
    if (!tab?.id) throw new Error("No active tab");

    const response = await sendToJobScanner(tab.id, { type: "JOB_SCOUT_ANALYZE" });

    if (!response?.ok) {
      throw new Error(response?.error || "Could not scan this page");
    }

    if (!response.record) {
      loading.hidden = false;
      loading.innerHTML = "This page does not look like a supported job description. You can still use <strong>Add Manually</strong> below.";
      result.textContent = "Nothing was saved.";
      return;
    }

    render(response.record);
    loading.hidden = true;

    const statusLabel =
      response.record.status === "applied" ? "Applied" :
      response.record.status === "crossed_off" ? "Crossed Off" :
      "Viewed";

    result.textContent = `✓ Loaded and saved as ${statusLabel}.`;
  } catch (err) {
    loading.hidden = false;
    loading.innerHTML = "Could not load this page as a job. You can still use <strong>Add Manually</strong> below.";
    result.textContent = `Nothing was saved. ${err?.message ? "Error: " + err.message : ""}`;
  } finally {
    button.disabled = false;
    button.textContent = "Load Job";
  }
}

document.getElementById("loadJob")?.addEventListener("click", loadCurrentJob);


peekCurrentSavedJob();
