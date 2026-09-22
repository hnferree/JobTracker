# Job Scout Tracker v0.3

A local Chrome extension for reviewing job descriptions and remembering what you already viewed, applied to, or intentionally crossed off.

## Main workflow

1. Open a job description.
2. The extension scans it automatically.
3. Click the extension icon to see the dashboard.
4. Use **Scan Job** whenever you want to force a fresh read (especially useful on sites that change jobs without fully reloading the page).
5. Mark the job as:
   - **Viewed** — reviewed but undecided.
   - **Applied** — application was actually submitted.
   - **Cross Off** — intentionally rejected; do not waste time rereading it.

## Important Scan Job behavior

Rescanning refreshes extracted job information such as:
- Job ID
- Company
- Website / URL
- Salary
- Travel requirement
- Keyword YES/NO results

Rescanning preserves your tracking history:
- Current status (Viewed / Applied / Crossed Off)
- First-viewed date
- Applied date
- Crossed-off date
- Notes

## Dashboard

The popup shows:
- Job title
- Company
- Job ID
- Source website
- Travel: No / Yes / detected percentage
- Pay range (with preference for compensation language later in the page)
- Every configured knowledge keyword as YES or NO
- Notes
- Status buttons

## Custom keywords

Click the gear icon or **Edit** beside Knowledge Keywords. Enter one keyword or phrase per line, for example:

C#
ASP.NET
.NET
SQL
Docker
React
Kafka
Azure
AWS
Microservices

## Duplicate / already-applied detection

When a Job ID is available, the extension identifies the posting primarily by:

`source website + Job ID`

If no Job ID can be found, it falls back to:

`source website + company + job title`

A previously submitted posting shows **Already Applied**. A rejected posting shows **Crossed Off**.

## Storage

Job records are stored locally in Chrome using `chrome.storage.local`. Keyword settings use `chrome.storage.sync`.

## Install / update

1. Unzip the download.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. If an older version is loaded from a different folder, remove it first.
5. Click **Load unpacked**.
6. Select the `job-scout-tracker-v0.3` folder.

Because loading a new unpacked folder creates a new extension storage area, an older locally-loaded version's existing test data may not automatically carry over. v0.3 includes CSV export for your records.


## v0.4 Application Autofill
A new `Fill Application Form` button can fill common recruiting-form questions.

Default profile values:
- LinkedIn: linkedin.com/in/holly-ferree-63b2a15/
- Legally authorized to work in the U.S.: Yes
- Ethnicity / Race: White
- Veteran: No
- Gender: Female
- Hispanic / Latino: No

The autofill is user-triggered and does not submit applications automatically.
You can edit these answers from the extension Settings page.

Because Workday, Greenhouse, Lever, iCIMS, Taleo, and other ATS systems structure forms differently,
generic autofill may not catch every field. Site-specific adapters can be added later without changing
your saved application profile.


## v0.5 HiringCafe support
- Detects HiringCafe jobs opened in the right-side drawer/modal.
- Uses the drawer's Full View `/job/...` URL as the stable saved URL.
- Extracts the HiringCafe job ID from the Full View slug.
- Reads title and company from the active drawer rather than the underlying search page.
- Scans the full Job Description article for keywords and travel.
- Prefers the exact employer Pay Range inside the Job Description over HiringCafe's rounded salary badge.
- Watches HiringCafe drawer changes so moving from one job to another can rescan without a page reload.
- Fixes the application-autofill message handler so the Fill Application Form button can communicate with the page.


## v0.6 changes

- Application Autofill is now independent of job scanning and appears on every normal webpage.
- Added reusable Custom Form Fill Rules in Settings.
- Example: field/label contains `desired salary` -> fill `150000`.
- Rules are stored in `chrome.storage.sync`, so you can change them without rebuilding or reinstalling the extension.
- The matcher checks label text, name, id, placeholder, aria-label, and nearby question text.
- The extension still never submits an application automatically. Review filled answers before submitting.


## v0.7 — Embedded application forms
- Content scripts now run in all accessible frames, including cross-origin Greenhouse application iframes.
- `Fill Application Form` scans every frame in the active tab and aggregates the results.
- Added `match_about_blank` / `match_origin_as_fallback` support for dynamically created ATS frames.
- Improved label matching with `data-testid`, `data-qa`, `data-automation-id`, `autocomplete`, and broader question wrappers.
- The popup now reports whether it found fields but had no matching saved answer, which makes creating custom rules easier.

This specifically addresses employer career pages that use a `gh_jid` Greenhouse application embedded inside the employer's own site.


## v0.8

- Added LinkedIn `/jobs/view/<job id>/` recognition.
- Reads LinkedIn job ID from the URL.
- Tries LinkedIn-specific title, company, and description selectors.
- Added an always-available Manual Job Entry panel.
- Manual entry pre-fills current URL and website.
- LinkedIn manual entry also pre-fills the numeric Job ID.
- Manual jobs can be saved directly as Viewed, Applied, or Crossed Off.
- Manual records use the same persistent job storage and duplicate detection as scanned jobs.


## v0.9 — Explicit Load Job workflow

Automatic job caching has been removed.

The extension no longer creates a Viewed record merely because a page is opened. This prevents unrelated sites such as LeetCode, documentation pages, articles, and other non-job pages from being added to the tracker.

A job record is now created or updated only when the user explicitly does one of these actions:

- Clicks **Load Job**
- Uses **Manual Job Entry**
- Clicks **Add as Applied**
- Saves a manual record as **Viewed** or **Crossed Off**

`Load Job` scans the current page and, only if it recognizes a job, saves/updates the job record. If the page is not recognized, nothing is cached and the Manual Job Entry fallback remains available.

Application Autofill remains independent and available on application pages without loading or caching a job.


## v0.10

- Keeps the explicit **Load Job** workflow. No page is cached merely by visiting it.
- Hardened HiringCafe drawer detection against newer Chakra/data-testid changes.
- HiringCafe now anchors on semantic elements: dialog + H1 + article + Full View `/job/...` link.
- Extracts the opaque HiringCafe ID from the Full View slug.
- Fixed LinkedIn helper placement from the prior build.
- Added self-healing Load Job behavior: if the content scanner is missing because the tab was open before an extension update, the popup injects the current scanner and retries.
- Added the `scripting` permission required for that recovery.
- Application Autofill remains independent and does not create a job record.


## v0.11 fixes

- Fixed a JavaScript ReferenceError in travel detection and keyword matching that could make valid scans fail.
- Added first-class support for standalone HiringCafe `/job/<slug>` pages as well as HiringCafe drawer pages.
- Expanded salary parsing to recognize employer ranges written with `USD` after each number.
- Removed the leftover automatic popup scan. Opening the popup no longer scans or caches anything.
- Removed the old Scan Job button. Load Job is the single explicit scan/cache action.
- Fixed Load Job to use the self-healing content-script injection path after extension updates.


## v0.12

### HiringCafe drawer auto-scan
HiringCafe is now the one site with an automatic scan exception.

When a visible HiringCafe search-results job drawer opens:
- the extension automatically scans it
- stores/updates the job as Viewed
- preserves Applied/Crossed Off status if the job was already tracked
- displays the status badge
- the popup can show the already-saved result without requiring Load Job

Standalone HiringCafe `/job/...` pages still use the explicit Load Job button.

### Rippling ATS support
Added a dedicated parser for:
`https://ats.rippling.com/<tenant>/jobs/<UUID>`

It extracts:
- job title
- company when detectable
- UUID job ID
- stable URL without source tracking parameters
- salary/pay bands
- travel and knowledge keywords

Rippling pay ranges written as `155,200 - 194,000 USD per year` are supported.
If multiple geographic Rippling pay bands are present, the dashboard preserves multiple ranges instead of silently choosing one.

All other sites retain the explicit Load Job workflow.


## v0.13

- Fixed the HiringCafe saved-record lookup typo (`loadExisting` -> `existing`).
- HiringCafe drawer detection now starts from the visible `Full View` `/job/...` link instead of depending on a specific UI framework.
- The drawer parser can walk through Chakra, Ant Design, generic modal/drawer containers, or a semantic fallback.
- HiringCafe auto-scan only considers a scan successful after the job record is actually saved.
- Added practical maintenance comments throughout the main scanner, popup and custom-rule code.
