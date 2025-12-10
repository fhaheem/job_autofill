# Job Autofill – Browser Extension

A lightweight Chrome extension that **autofills repetitive job application fields** across common applicant tracking systems (ATS) like **Greenhouse** and **Workday**, plus a **generic rules engine** for everything else.

You store your info once in the popup, then click **"Autofill Application"** on any job form to fill:

## Features

### Basic Profile Fields
- Full name (first / last / full)
- Email
- Phone (with automatic "Mobile" device type selection)
- LinkedIn URL
- GitHub URL
- Website/Portfolio URL
- Reusable summary / "Why you" blurb
- Skills (comma-separated list)
- Full address:
  - Address line 1
  - Address line 2
  - City
  - State (2-letter code or full name, e.g. `FL` or `Florida`)
  - ZIP code
  - Country

### Work Experience Management (NEW in v2.0)
- Add multiple work experience entries
- Each entry includes:
  - Job title
  - Company name
  - Location
  - Start date (MM/YYYY)
  - End date (MM/YYYY) or "Currently work here" checkbox
  - Role description
- **Enable/Disable** individual work experiences with checkboxes
- **Reorder** work experiences with up/down arrows
- Only enabled experiences are autofilled, in the order you specify
- Automatic detection and filling of work experience arrays on forms

### Smart Form Detection
- **Greenhouse iframe support** - Works inside embedded Greenhouse forms
- **Phone device type detection** - Automatically selects "Mobile" for phone type dropdowns
- **State dropdown matching** - Handles multiple formats:
  - 2-letter codes (FL, CA, NY)
  - Full names (Florida, California, New York)
  - Combined formats (USA-FL, Florida (FL))
- **Work experience array detection** - Fills indexed fields like `experienceData[0].title`

> 🔒 **Privacy:** All data is stored locally in Chrome sync storage. No data is sent to external servers.

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
- **Links:** `linkedin`, `github`, `website`
- **Address:** `address1`, `address2`, `city`, `state`, `zip`, `country`
- **Work Experience:** Add multiple work experiences with the "Add Work Experience" button
  - Use checkboxes to enable/disable entries
  - Use ▲▼ arrows to reorder entries
  - Work experiences save automatically when added/edited/deleted
- **Summary & Skills:** `summary` (short reusable paragraph), `skills` (comma-separated)

Basic profile fields are stored in `chrome.storage.sync` under the same field names used in `content.js`. Work experiences are stored as an array with an `enabled` flag for each entry.

Click **Save** for basic profile fields and you'll see a temporary "Saved!" message in the popup status bar.  

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
   - `applyPhoneDeviceTypeRule` (NEW in v2.0)
   - `applyPhoneRule`
   - `applyAddressLine1Rule`
   - `applyAddressLine2Rule`
   - `applyCityRule`
   - `applyStateRule`
   - `applyZipRule`
   - `applyCountryRule` (NEW in v2.0)
   - `applyLinkedInRule`
   - `applyGitHubRule`
   - `applyWebsiteRule`
   - `applySkillsRule` (NEW in v2.0)
   - `applySummaryRule`

Examples:

- **Email**: matches anything with "email" in the hint.
- **Names**: matches explicit "first name", "last name", or "full name / legal name".
- **Phone Device Type**: matches dropdowns for phone type and selects "Mobile".
- **Phone**: matches "phone", "mobile", "cell" fields.
- **Address line 1**: matches "address", "address line 1", "street address"; explicitly *excludes* things like "apt", "suite", "address line 2".
- **Address line 2**: matches "address line 2", "apt", "suite", "unit".
- **City**: requires the word "city".
- **State**:
  - For `<select>` elements, tries multiple matching strategies:
    - Exact match on value (FL, California)
    - Match with country prefix (USA-FL, US-CA)
    - Match in parentheses (Florida (FL))
    - Partial match on text or value
  - For `<input>`, just writes the provided state string.
- **ZIP / Postal code**: matches "zip", "postal code", "postcode".
- **Country**: matches "country" or "nation" fields; handles both dropdowns and text inputs.
- **Skills**: fills textarea fields matching "skill", "expertise", "proficiency", etc.
- **Summary**: only fills `<textarea>` elements whose hint mentions things like "summary", "about you", "tell us", "why you".

If `skipFilled = true`, the rules leave any non-empty field alone.

### 5. Work Experience Autofill (NEW in v2.0)

After filling basic fields, `autofillWorkExperience()` runs with two strategies:

**Strategy 1: Array Notation Fields**
- Detects fields with indexed names like:
  - `experienceData[0].title`
  - `experienceData[0].companyName`
  - `experienceData[0].location`
  - `experienceData[0].fromTo.startDate`
  - `experienceData[0].fromTo.endDate`
  - `experienceData[0].fromTo.currentlyWorkHere`
  - `experienceData[0].roleDescription`
- Fills them with your **enabled** work experiences in order
- First enabled experience → `[0]`, second → `[1]`, etc.

**Strategy 2: Generic Work Experience Sections**
- Detects containers with work experience fields (class/id contains "experience")
- Matches fields by hint strings (title, company, location, dates, description)
- Fills each section with one enabled work experience in order

Only work experiences with the checkbox **checked** in the popup are autofilled.

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

## Version History

### v2.0 (Current)
- ✨ **Work Experience Management**: Add, edit, delete multiple work experiences
- ✨ **Work Experience Controls**: Enable/disable and reorder work experiences
- ✨ **Work Experience Autofill**: Automatic detection and filling of work history fields
- ✨ **Website/Portfolio Field**: Added support for portfolio URLs
- ✨ **Skills Field**: Comma-separated skills list with textarea autofill
- ✨ **Country Field**: Support for country selection in address forms
- ✨ **Phone Device Type**: Automatic "Mobile" selection for phone type dropdowns
- ✨ **Enhanced State Matching**: Multiple strategies for state dropdown matching (USA-FL, Florida (FL), etc.)
- ✨ **Greenhouse iframe Support**: Works inside embedded Greenhouse application forms
- 🐛 **Bug Fixes**: Improved event dispatching and form compatibility

### v1.0
- Initial release with basic autofill functionality
- Support for Greenhouse and Workday ATS platforms
- Generic rules engine for other job sites
- Basic profile fields: name, email, phone, address, links, summary

---

## Known Issues

- **Work Experience Saving** (⚠️ In Progress): Work experience data may not persist correctly after closing the popup. This is being investigated. Workaround: Re-enter work experiences before each autofill session if they don't appear.

---

## Notes / Future Ideas

- 🔧 Fix work experience persistence issue
- Add per-site toggles (enable/disable generic autofill for specific domains)
- Support more ATS platforms (Lever, Ashby, SmartRecruiters, etc.)
- Sync multiple profiles (e.g., "Software Engineer", "Data Scientist") with a selector in the popup
- Add education history autofill similar to work experience

PRs and tweaks welcome if you expand this into a full project!
