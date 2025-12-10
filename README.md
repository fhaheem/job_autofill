# Job Autofill – Browser Extension

A lightweight Chrome extension that **autofills repetitive job application fields** across common applicant tracking systems (ATS) like **Greenhouse** and **Workday**, plus a **generic rules engine** for everything else.

You store your info once in the popup, then click **“Autofill Application”** on any job form to fill:

- Full name (first / last / full)
- Email
- Phone
- LinkedIn URL
- GitHub URL
- Reusable summary / “Why you” blurb
- Full address:
  - Address line 1  
  - Address line 2  
  - City  
  - State (2-letter code, e.g. `FL`)  
  - ZIP code  

> 🔒 **No “location” string is used anywhere** (e.g. `Tampa, FL`). Only the explicit address fields are used for city/state/zip.

---

## Folder Structure

- `manifest.json` – Extension manifest (v3)
- `popup.html` – Popup UI for editing your profile (name, contact, links, address, summary) :contentReference[oaicite:0]{index=0}  
- `popup.js` – Logic for loading/saving profile fields from `chrome.storage.sync` :contentReference[oaicite:1]{index=1}  
- `content.js` – Injected into web pages; adds the floating **“Autofill Application”** button and performs autofill
- `icon128.png` – Extension icon

---

## How It Works

### 1. Profile Storage (Popup)

Open the extension popup and fill in:

- **Basic Info:** `fullName`
- **Contact:** `email`, `phone`
- **Links:** `linkedin`, `github`
- **Address:** `address1`, `address2`, `city`, `state`, `zip`
- **Summary:** `summary` (short reusable paragraph for “Tell us about yourself”, etc.)

These values are stored in `chrome.storage.sync` under the same field names used in `content.js`, so content and popup stay in sync. :contentReference[oaicite:2]{index=2}  

Click **Save** and you’ll see a temporary “Saved!” message in the popup status bar. :contentReference[oaicite:3]{index=3}  

---

### 2. Content Script & Autofill Button

When a page loads, `content.js`:

1. Reads your profile from `chrome.storage.sync`.
2. Injects a small floating button at the bottom-right:
   - Text: **“Autofill Application”**
3. On click, it checks the current hostname:
   - `*greenhouse*` → runs **Greenhouse strategy**
   - `*workday*` → runs **Workday strategy**
   - anything else → runs **generic rules engine**

The button uses `setValueWithEvents` to set field values and fire `input`, `change`, and `blur` events so React / Workday / other frameworks notice the change.

---

### 3. Site-Specific Logic

#### Greenhouse

- Uses known field names like:
  - `job_application[first_name]`
  - `job_application[last_name]`
  - `job_application[email]`
  - `job_application[phone]`
- Fills:
  - First / last name
  - Email
  - Phone
  - LinkedIn, GitHub
  - Website (prefers LinkedIn → GitHub)
  - Summary (for textareas whose label/placeholder mentions “about you”, “summary”, etc.)
- Then calls the **generic autofill** as a backup for any other inputs (including address).

#### Workday

- Uses `data-automation-id` selectors where possible, e.g.:
  - `legalNameSection_firstName`, `lastName`
  - `email`, `emailAddress`
  - `phone-number`, `phoneNumber`
  - `addressLine1`, `addressLine2`, `city`, `state`, `postalCode`, `zipCode`
- Then calls the **generic autofill** as a backup.

---

### 4. Generic Rules Engine

For any non-Greenhouse/non-Workday page (or leftover fields), `autofillGeneric()`:

1. Collects all `input`, `textarea`, and `select` elements.
2. Builds a **hint string** for each element:
   - tag, type, `name`, `id`, placeholder, and label text (all lowercased).
3. Runs a series of rule functions in order; the first match wins:
   - `applyEmailRule`
   - `applyNameRules`
   - `applyPhoneRule`
   - `applyAddressLine1Rule`
   - `applyAddressLine2Rule`
   - `applyCityRule`
   - `applyStateRule`
   - `applyZipRule`
   - `applyLinkedInRule`
   - `applyGitHubRule`
   - `applyWebsiteRule`
   - `applySummaryRule`

Examples:

- **Email**: matches anything with “email” in the hint.
- **Names**: matches explicit “first name”, “last name”, or “full name / legal name”.
- **Address line 1**: matches “address”, “address line 1”, “street address”; explicitly *excludes* things like “apt”, “suite”, “address line 2”.
- **Address line 2**: matches “address line 2”, “apt”, “suite”, “unit”.
- **City**: requires the word “city”.
- **State**:
  - For `<select>` elements, tries to match option value or text (supports both full names and 2-letter codes).
  - For `<input>`, just writes the provided state string.
- **ZIP / Postal code**: matches “zip”, “postal code”, “postcode”.
- **Summary**: only fills `<textarea>` elements whose hint mentions things like “summary”, “about you”, “tell us”, “why you”.

If `skipFilled = true`, the rules leave any non-empty field alone.

---

## Installing the Extension (Developer Mode)

1. Go to `chrome://extensions/`.
2. Enable **Developer mode** (top-right toggle).
3. Click **“Load unpacked”**.
4. Select the folder containing:
   - `manifest.json`
   - `popup.html`
   - `popup.js`
   - `content.js`
   - `icon128.png`
5. The extension should now appear in your toolbar.

Click the extension icon → fill out your profile → **Save**.

Then open any job application page, hit **“Autofill Application”**, and watch the fields populate.

---

## Notes / Future Ideas

- Add per-site toggles (enable/disable generic autofill for specific domains).
- Support more ATS platforms (Lever, Ashby, SmartRecruiters, etc.).
- Sync multiple profiles (e.g., “Software Engineer”, “Data Scientist”) with a selector in the popup.

PRs and tweaks welcome if you expand this into a full project!
