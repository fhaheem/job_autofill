// ============================================================================
//  JOB AUTOFILL CONTENT SCRIPT
//  - Loads profile from chrome.storage
//  - Injects a floating "Autofill Application" button
//  - Site-specific: Greenhouse, Workday
//  - Generic rules: name, email, phone, address, links, summary
//  - NO "location" field used anywhere (address fields only)
// ============================================================================

// ============================================================================
//  SECTION 1: PROFILE LOADING & ENTRY POINT
// ============================================================================

// Global profile object populated from chrome.storage
let profile = {};

/**
 * Check if we're inside an iframe
 */
function isInIframe() {
  return window.self !== window.top;
}

/**
 * Check if we're on a Greenhouse embedded form (inside iframe)
 */
function isGreenhouseIframe() {
  return isInIframe() && window.location.hostname.includes("greenhouse");
}

/**
 * Load profile data when the content script runs.
 */
chrome.storage.sync.get(
  [
    "fullName",
    "email",
    "phone",
    "linkedin",
    "github",
    "website",
    "summary",
    "skills",

    // Address fields
    "address1",
    "address2",
    "city",
    "state",
    "zip",
    "country",

    // Work experience
    "workExperience"
  ],
  (data) => {
    profile = data || {};

    // If we're in a Greenhouse iframe, inject button inside the iframe
    if (isGreenhouseIframe()) {
      injectAutofillButton();
    } else {
      // On parent pages, inject button and set up iframe detection
      injectAutofillButton();
      setupIframeDetection();
    }
  }
);

// ============================================================================
//  SECTION 2: LOW-LEVEL DOM HELPERS
// ============================================================================

/**
 * Set a value on an input/textarea/select and trigger events so
 * React/Workday/etc. actually register the change.
 */
function setValueWithEvents(input, value) {
  if (!input || value == null) return;
  if (String(input.value) === String(value)) return;

  input.value = value;

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new Event("blur", { bubbles: true }));
}

/**
 * Try to find the label text for a given input/textarea/select by looking at:
 *  - <label for="id">
 *  - wrapping <label> elements
 */
function getLabelTextFor(el) {
  if (!el) return "";
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`);
    if (label) return label.innerText || "";
  }
  const parentLabel = el.closest("label");
  if (parentLabel) return parentLabel.innerText || "";
  return "";
}

/**
 * Split profile.fullName into { firstName, lastName }
 * so name logic can be shared across all strategies.
 */
function getNameParts() {
  const full = (profile.fullName || "").trim();
  if (!full) return { firstName: "", lastName: "" };

  const parts = full.split(/\s+/);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ")
  };
}

/**
 * Build a lowercase "hint string" for an element using tag, type, name, id,
 * placeholder, and associated label text. This is used by rule functions
 * to match fields without site-specific selectors.
 */
function getHint(el) {
  const tag = (el.tagName || "").toLowerCase();
  const type = (el.type || "").toLowerCase();
  const name = (el.name || "").toLowerCase();
  const id = (el.id || "").toLowerCase();
  const placeholder = (el.placeholder || "").toLowerCase();
  const labelText = getLabelTextFor(el).toLowerCase();

  return `${tag} ${type} ${name} ${id} ${placeholder} ${labelText}`.trim();
}

/**
 * Workday-style helper: find an element by data-automation-id and set its value.
 */
function setByAutomationId(id, value) {
  if (!value) return;

  const base =
    document.querySelector(`[data-automation-id="${id}"] input`) ||
    document.querySelector(`[data-automation-id="${id}"] textarea`) ||
    document.querySelector(`[data-automation-id="${id}"] select`) ||
    document.querySelector(`[data-automation-id="${id}"]`);

  if (!base) return;

  const tag = base.tagName ? base.tagName.toLowerCase() : "";
  const input =
    tag === "input" || tag === "textarea" || tag === "select"
      ? base
      : base.querySelector("input, textarea, select");

  if (!input || input.value) return;

  // For selects, we just set value directly as well
  setValueWithEvents(input, value);
}

// ============================================================================
//  SECTION 3: UI BOOTSTRAP (BUTTON INJECTION & ROUTING)
// ============================================================================

/**
 * Set up detection for Greenhouse iframes on the parent page.
 * When we find a Greenhouse iframe, we'll try to trigger autofill inside it.
 */
function setupIframeDetection() {
  // Look for Greenhouse iframe
  const checkForGreenhouseIframe = () => {
    const iframe = document.querySelector('iframe[id*="grnhse"], iframe[src*="greenhouse"]');
    if (iframe) {
      console.log("Job Autofill: Found Greenhouse iframe");
    }
  };

  // Check immediately
  checkForGreenhouseIframe();

  // Also check after a delay (in case iframe loads later)
  setTimeout(checkForGreenhouseIframe, 2000);
}

/**
 * Injects the floating "Autofill Application" button and wires routing logic:
 *  - Greenhouse
 *  - Workday
 *  - Generic fallback
 */
function injectAutofillButton() {
  if (document.getElementById("job-autofill-btn")) return;

  const btn = document.createElement("button");
  btn.id = "job-autofill-btn";
  btn.textContent = "Autofill Application";

  // Use different styling if we're inside an iframe
  const buttonStyle = {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: 999999,
    padding: "8px 12px",
    fontSize: "12px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    background: "#ffffff",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(0,0,0,0.18)"
  };

  // If inside iframe, make button more prominent
  if (isInIframe()) {
    buttonStyle.background = "#4CAF50";
    buttonStyle.color = "#ffffff";
    buttonStyle.border = "1px solid #45a049";
    buttonStyle.fontWeight = "bold";
  }

  Object.assign(btn.style, buttonStyle);

  btn.addEventListener("mouseenter", () => {
    if (isInIframe()) {
      btn.style.background = "#45a049";
    } else {
      btn.style.background = "#f5f5f5";
    }
  });
  btn.addEventListener("mouseleave", () => {
    if (isInIframe()) {
      btn.style.background = "#4CAF50";
    } else {
      btn.style.background = "#ffffff";
    }
  });

  btn.addEventListener("click", () => {
    const host = window.location.hostname.toLowerCase();

    try {
      // Check if we're inside a Greenhouse iframe
      if (isGreenhouseIframe()) {
        console.log("Job Autofill: Inside Greenhouse iframe");
        autofillGreenhouse();
        return;
      }

      // Check if there's a Greenhouse iframe on this page
      const greenhouseIframe = document.querySelector('iframe[id*="grnhse"], iframe[src*="greenhouse"]');
      if (greenhouseIframe) {
        console.log("Job Autofill: Found Greenhouse iframe on page, attempting to autofill inside it");
        // Since we can't directly access cross-origin iframe content,
        // we need to wait for the iframe's own content script to handle it
        alert("Please scroll down to the application form in the iframe and click the 'Autofill Application' button inside the form.");
        return;
      }

      // Regular detection for non-iframe pages
      if (host.includes("greenhouse")) {
        console.log("Job Autofill: Greenhouse detected");
        autofillGreenhouse();
      } else if (host.includes("workday")) {
        console.log("Job Autofill: Workday detected");
        autofillWorkday();
      } else {
        console.log("Job Autofill: Generic mode");
        autofillGeneric(false);
      }
    } catch (e) {
      console.error("Job Autofill error:", e);
    }
  });

  document.body.appendChild(btn);
}

// ============================================================================
//  SECTION 4: SITE-SPECIFIC AUTOFILL STRATEGIES
// ============================================================================

/**
 * Greenhouse-specific autofill logic.
 * Uses known name/email/phone selectors, then falls back to generic rules.
 */
function autofillGreenhouse() {
  const { firstName, lastName } = getNameParts();

  // ---- NAME ----
  if (firstName || lastName) {
    const firstNameInput =
      document.querySelector('input[name="job_application[first_name]"]') ||
      document.querySelector('input[name*="first_name"]');

    const lastNameInput =
      document.querySelector('input[name="job_application[last_name]"]') ||
      document.querySelector('input[name*="last_name"]');

    if (firstNameInput && !firstNameInput.value && firstName) {
      setValueWithEvents(firstNameInput, firstName);
    }
    if (lastNameInput && !lastNameInput.value && lastName) {
      setValueWithEvents(lastNameInput, lastName);
    }
  }

  // ---- EMAIL ----
  if (profile.email) {
    const emailInput =
      document.querySelector('input[name="job_application[email]"]') ||
      document.querySelector('input[type="email"]') ||
      document.querySelector('input[name*="email"]');
    if (emailInput && !emailInput.value) {
      setValueWithEvents(emailInput, profile.email);
    }
  }

  // ---- PHONE ----
  if (profile.phone) {
    const phoneInput =
      document.querySelector('input[name="job_application[phone]"]') ||
      document.querySelector('input[type="tel"]') ||
      document.querySelector('input[name*="phone"]');
    if (phoneInput && !phoneInput.value) {
      setValueWithEvents(phoneInput, profile.phone);
    }
  }

  // ---- LINKEDIN ----
  if (profile.linkedin) {
    const liInput =
      document.querySelector('input[name*="linkedin"]') ||
      document.querySelector('input[placeholder*="LinkedIn" i]');
    if (liInput && !liInput.value) {
      setValueWithEvents(liInput, profile.linkedin);
    }
  }

  // ---- GITHUB ----
  if (profile.github) {
    const ghInput =
      document.querySelector('input[name*="github"]') ||
      document.querySelector('input[placeholder*="GitHub" i]');
    if (ghInput && !ghInput.value) {
      setValueWithEvents(ghInput, profile.github);
    }
  }

  // ---- WEBSITE (fallback: LinkedIn → GitHub) ----
  const websiteInput =
    document.querySelector('input[name*="website"]') ||
    document.querySelector('input[placeholder*="website" i]');
  if (websiteInput && !websiteInput.value) {
    if (profile.linkedin) setValueWithEvents(websiteInput, profile.linkedin);
    else if (profile.github) setValueWithEvents(websiteInput, profile.github);
  }

  // ---- SUMMARY / ABOUT YOU ----
  if (profile.summary) {
    const textareas = Array.from(document.querySelectorAll("textarea"));
    textareas.forEach((ta) => {
      const hint = getHint(ta);
      if (
        !ta.value &&
        /(about you|summary|introduction|tell us|why.*you)/.test(hint)
      ) {
        setValueWithEvents(ta, profile.summary);
      }
    });
  }

  // Run generic as a backup for any other fields (including address)
  autofillGeneric(true);

  // Fill work experience sections
  autofillWorkExperience();
}

/**
 * Workday-specific autofill logic.
 * Uses data-automation-id selectors where possible, then generic fallback.
 */
function autofillWorkday() {
  const { firstName, lastName } = getNameParts();

  // ---- NAME ----
  if (firstName) {
    setByAutomationId("legalNameSection_firstName", firstName);
    setByAutomationId("firstName", firstName);
  }
  if (lastName) {
    setByAutomationId("legalNameSection_lastName", lastName);
    setByAutomationId("lastName", lastName);
  }

  // ---- EMAIL ----
  if (profile.email) {
    setByAutomationId("email", profile.email);
    setByAutomationId("emailAddress", profile.email);
  }

  // ---- PHONE ----
  if (profile.phone) {
    setByAutomationId("phone-number", profile.phone);
    setByAutomationId("phoneNumber", profile.phone);
  }

  // ---- ADDRESS (if Workday uses these automation IDs) ----
  if (profile.address1) {
    setByAutomationId("addressLine1", profile.address1);
  }
  if (profile.address2) {
    setByAutomationId("addressLine2", profile.address2);
  }
  if (profile.city) {
    setByAutomationId("city", profile.city);
  }
  if (profile.state) {
    setByAutomationId("state", profile.state);
  }
  if (profile.zip) {
    setByAutomationId("postalCode", profile.zip);
    setByAutomationId("zipCode", profile.zip);
  }

  // Run generic as backup for plain inputs/selects that aren't tagged
  autofillGeneric(true);

  // Fill work experience sections
  autofillWorkExperience();
}

// ============================================================================
//  SECTION 5: GENERIC AUTOFILL RULES ENGINE
// ============================================================================

/**
 * Generic autofill logic used:
 * - For non-Greenhouse/Workday sites (e.g., Walmart)
 * - As a backup after site-specific functions
 *
 * @param {boolean} skipFilled - if true, do not overwrite existing values
 */
function autofillGeneric(skipFilled = false) {
  const inputs = Array.from(
    document.querySelectorAll("input, textarea, select")
  );
  const nameParts = getNameParts();

  console.log(`Job Autofill: Found ${inputs.length} input/select/textarea elements`);
  console.log(`Job Autofill: Profile state value: "${profile.state}"`);

  inputs.forEach((el) => {
    if (skipFilled && el.value) return;

    const hint = getHint(el);

    // Apply rule functions in order; stop at the first one that returns true.
    if (applyEmailRule(el, hint)) return;
    if (applyNameRules(el, hint, nameParts)) return;
    if (applyPhoneDeviceTypeRule(el, hint)) return;
    if (applyPhoneRule(el, hint)) return;
    if (applyAddressLine1Rule(el, hint)) return;
    if (applyAddressLine2Rule(el, hint)) return;
    if (applyCityRule(el, hint)) return;
    if (applyStateRule(el, hint)) return;
    if (applyZipRule(el, hint)) return;
    if (applyCountryRule(el, hint)) return;
    if (applyLinkedInRule(el, hint)) return;
    if (applyGitHubRule(el, hint)) return;
    if (applyWebsiteRule(el, hint)) return;
    if (applySkillsRule(el, hint)) return;
    if (applySummaryRule(el, hint)) return;
  });

  const firstInput = document.querySelector("input, textarea");
  if (firstInput) {
    firstInput.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Fill work experience sections (when called from generic autofill route)
  if (!skipFilled) {
    autofillWorkExperience();
  }
}

// ============================================================================
//  SECTION 5A: GENERIC RULE FUNCTIONS
// ============================================================================

function applyEmailRule(el, hint) {
  if (!profile.email) return false;
  if (el.value) return false;
  if (!/email/.test(hint)) return false;

  setValueWithEvents(el, profile.email);
  return true;
}

function applyNameRules(el, hint, { firstName, lastName }) {
  const isTextarea = el.tagName.toLowerCase() === "textarea";
  if (isTextarea) return false; // names are rarely textareas

  // FIRST NAME
  if (
    !el.value &&
    firstName &&
    /(first name|given name|forename)/.test(hint) &&
    !/(last|surname|family)/.test(hint)
  ) {
    setValueWithEvents(el, firstName);
    return true;
  }

  // LAST NAME
  if (
    !el.value &&
    lastName &&
    /(last name|surname|family name)/.test(hint)
  ) {
    setValueWithEvents(el, lastName);
    return true;
  }

  // FULL NAME (only when explicitly full name / your name)
  if (
    !el.value &&
    profile.fullName &&
    /(full name|your name|name as it appears|legal name)/.test(hint) &&
    !/(first|last|surname|family)/.test(hint)
  ) {
    setValueWithEvents(el, profile.fullName);
    return true;
  }

  return false;
}

function applyPhoneRule(el, hint) {
  if (!profile.phone) return false;
  if (el.value) return false;
  if (!/(phone|mobile|cell)/.test(hint)) return false;

  setValueWithEvents(el, profile.phone);
  return true;
}

function applyPhoneDeviceTypeRule(el, hint) {
  // Only apply to select elements that haven't been filled
  if (el.value) return false;

  const tag = el.tagName.toLowerCase();
  if (tag !== "select") return false;

  // Match fields that look like phone device type / phone type
  // Patterns: devicetype, device.type, phone type, nonusdevicetype, etc.
  if (!/(device.*type|phone.*type|type.*device|type.*phone)/.test(hint)) return false;

  console.log(`Job Autofill: Found phone device type field - hint: "${hint}"`);

  const options = Array.from(el.options || []);

  // Try to find "Mobile" option (case-insensitive)
  const match = options.find((opt) => {
    const val = (opt.value || "").trim().toLowerCase();
    const txt = (opt.textContent || "").trim().toLowerCase();

    return val === "mobile" || txt === "mobile";
  });

  if (match) {
    console.log(`Job Autofill: Found "Mobile" option - value: "${match.value}", text: "${match.textContent}"`);
    setValueWithEvents(el, match.value);
    return true;
  }

  console.log(`Job Autofill: Could not find "Mobile" option in device type dropdown`);
  console.log(`Available options:`, options.map(o => `value="${o.value}" text="${o.textContent}"`));
  return false;
}

// ----- ADDRESS LINE 1 -----
function applyAddressLine1Rule(el, hint) {
  const addr1 = profile.address1;
  if (!addr1) return false;
  if (el.value) return false;
  if (el.tagName.toLowerCase() !== "input") return false;

  // Do NOT match line 2 / apt / suite / unit
  if (
    /(address line 2|address2|apt|apartment|suite|unit|floor)/.test(hint)
  ) {
    return false;
  }

  const isAddress1 =
    /\baddress\b/.test(hint) || // "Address"
    /(address line 1|address1|street address|home address|mailing address)/.test(
      hint
    );

  if (isAddress1) {
    setValueWithEvents(el, addr1);
    return true;
  }

  return false;
}

// ----- ADDRESS LINE 2 -----
function applyAddressLine2Rule(el, hint) {
  const addr2 = profile.address2;
  if (!addr2) return false;
  if (el.value) return false;
  if (el.tagName.toLowerCase() !== "input") return false;

  if (
    /(address line 2|address2|apt|apartment|suite|unit|floor)/.test(hint)
  ) {
    setValueWithEvents(el, addr2);
    return true;
  }

  return false;
}

// ----- CITY -----
function applyCityRule(el, hint) {
  if (!profile.city) return false;
  if (el.value) return false;

  // Only match fields clearly about "city"
  if (!/\bcity\b/.test(hint)) return false;

  setValueWithEvents(el, profile.city);
  return true;
}

// ----- STATE / PROVINCE -----
function applyStateRule(el, hint) {
  if (!profile.state) return false;
  if (el.value) return false;

  // Match "state", "province", "region", or fields with "cntryFields.region" pattern
  if (!/(state|province|region|cntry.*region)/.test(hint)) return false;

  console.log(`Job Autofill: Found state field - hint: "${hint}"`);

  const tag = el.tagName.toLowerCase();
  const state = profile.state.trim();

  // If it's a select, try to pick the correct option
  if (tag === "select") {
    const normalized = state.toLowerCase();
    const options = Array.from(el.options || []);

    // State abbreviation to full name mapping
    const stateMap = {
      'al': 'alabama', 'ak': 'alaska', 'az': 'arizona', 'ar': 'arkansas',
      'ca': 'california', 'co': 'colorado', 'ct': 'connecticut', 'de': 'delaware',
      'fl': 'florida', 'ga': 'georgia', 'hi': 'hawaii', 'id': 'idaho',
      'il': 'illinois', 'in': 'indiana', 'ia': 'iowa', 'ks': 'kansas',
      'ky': 'kentucky', 'la': 'louisiana', 'me': 'maine', 'md': 'maryland',
      'ma': 'massachusetts', 'mi': 'michigan', 'mn': 'minnesota', 'ms': 'mississippi',
      'mo': 'missouri', 'mt': 'montana', 'ne': 'nebraska', 'nv': 'nevada',
      'nh': 'new hampshire', 'nj': 'new jersey', 'nm': 'new mexico', 'ny': 'new york',
      'nc': 'north carolina', 'nd': 'north dakota', 'oh': 'ohio', 'ok': 'oklahoma',
      'or': 'oregon', 'pa': 'pennsylvania', 'ri': 'rhode island', 'sc': 'south carolina',
      'sd': 'south dakota', 'tn': 'tennessee', 'tx': 'texas', 'ut': 'utah',
      'vt': 'vermont', 'va': 'virginia', 'wa': 'washington', 'wv': 'west virginia',
      'wi': 'wisconsin', 'wy': 'wyoming', 'dc': 'district of columbia'
    };

    // Get both the abbreviation and full name for matching
    let abbr = normalized.length === 2 ? normalized : null;
    let fullName = normalized.length > 2 ? normalized : stateMap[normalized];

    // If user provided abbreviation, also get the full name
    if (abbr && stateMap[abbr]) {
      fullName = stateMap[abbr];
    }

    // Try multiple matching strategies
    let match = options.find((opt) => {
      const val = (opt.value || "").trim().toLowerCase();
      const txt = (opt.textContent || "").trim().toLowerCase();

      // Strategy 1: Exact match on value (most common)
      if (abbr && val === abbr) return true;
      if (fullName && val === fullName) return true;

      // Strategy 2: Exact match on text
      if (abbr && txt === abbr) return true;
      if (fullName && txt === fullName) return true;

      // Strategy 3: Value ends with abbreviation (e.g., "USA-FL", "US-FL")
      if (abbr && val.endsWith(`-${abbr}`)) return true;

      // Strategy 4: Value contains country code + abbreviation (e.g., "usa-fl")
      if (abbr && val.includes(abbr) && val.match(/^[a-z]+-[a-z]+$/)) return true;

      // Strategy 5: Text ends with "(XX)" format - e.g., "Florida (FL)"
      if (abbr && txt.endsWith(`(${abbr})`)) return true;

      // Strategy 6: Text contains the abbreviation in parentheses
      if (abbr && txt.includes(`(${abbr})`)) return true;

      // Strategy 7: Text starts with full name - e.g., "Florida - FL"
      if (fullName && txt.startsWith(fullName)) return true;

      return false;
    });

    // Fallback: Try case-insensitive partial matching
    if (!match && (abbr || fullName)) {
      match = options.find((opt) => {
        const val = (opt.value || "").trim().toLowerCase();
        const txt = (opt.textContent || "").trim().toLowerCase();

        // Check if value or text contains our state
        if (abbr && (val.includes(abbr) || txt.includes(abbr))) return true;
        if (fullName && (val.includes(fullName) || txt.includes(fullName))) return true;

        return false;
      });
    }

    if (match) {
      console.log(`Job Autofill: Found state match - value: "${match.value}", text: "${match.textContent}"`);
      setValueWithEvents(el, match.value);
      return true;
    }

    // If still no match, log for debugging with available options
    console.log(`Job Autofill: Could not find state "${state}" in dropdown`);
    console.log(`Available options (first 5):`, options.slice(0, 5).map(o => `value="${o.value}" text="${o.textContent}"`));
    return false;
  }

  // If it's an input, just set the state abbreviation / name
  if (tag === "input") {
    setValueWithEvents(el, state);
    return true;
  }

  return false;
}

// ----- ZIP / POSTAL CODE -----
function applyZipRule(el, hint) {
  if (!profile.zip) return false;
  if (el.value) return false;

  if (!/(zip|postal code|postcode)/.test(hint)) return false;

  setValueWithEvents(el, profile.zip);
  return true;
}

// ----- COUNTRY -----
function applyCountryRule(el, hint) {
  if (!profile.country) return false;
  if (el.value) return false;

  if (!/(country|nation)/.test(hint)) return false;

  const tag = el.tagName.toLowerCase();

  if (tag === "select") {
    const country = profile.country.trim().toLowerCase();
    const options = Array.from(el.options || []);

    // Try to find matching country option
    const match = options.find((opt) => {
      const val = (opt.value || "").trim().toLowerCase();
      const txt = (opt.textContent || "").trim().toLowerCase();

      return val === country || txt === country ||
             val.includes(country) || txt.includes(country);
    });

    if (match) {
      setValueWithEvents(el, match.value);
      return true;
    }
  } else {
    setValueWithEvents(el, profile.country);
    return true;
  }

  return false;
}

// ----- LINKEDIN -----
function applyLinkedInRule(el, hint) {
  if (!profile.linkedin) return false;
  if (el.value) return false;
  if (!/linkedin/.test(hint)) return false;

  setValueWithEvents(el, profile.linkedin);
  return true;
}

// ----- GITHUB -----
function applyGitHubRule(el, hint) {
  if (!profile.github) return false;
  if (el.value) return false;
  if (!/github/.test(hint)) return false;

  setValueWithEvents(el, profile.github);
  return true;
}

// ----- WEBSITE / PORTFOLIO -----
function applyWebsiteRule(el, hint) {
  if (el.value) return false;
  if (!/(website|portfolio|personal site|personal url)/.test(hint)) return false;

  if (profile.linkedin) {
    setValueWithEvents(el, profile.linkedin);
    return true;
  }
  if (profile.github) {
    setValueWithEvents(el, profile.github);
    return true;
  }
  return false;
}

// ----- SKILLS -----
function applySkillsRule(el, hint) {
  if (!profile.skills) return false;
  if (el.value) return false;
  if (el.tagName.toLowerCase() !== "textarea") return false;

  if (/(skill|expertise|proficienc|competenc|capabilit)/.test(hint)) {
    setValueWithEvents(el, profile.skills);
    return true;
  }

  return false;
}

// ----- SUMMARY / ABOUT YOU -----
function applySummaryRule(el, hint) {
  if (!profile.summary) return false;
  if (el.value) return false;
  if (el.tagName.toLowerCase() !== "textarea") return false;

  if (
    /(summary|about you|about yourself|introduction|why.*you|tell us)/.test(hint)
  ) {
    setValueWithEvents(el, profile.summary);
    return true;
  }

  return false;
}

// ============================================================================
//  SECTION 6: WORK EXPERIENCE AUTOFILL
// ============================================================================

/**
 * Detects and fills work experience sections on forms.
 * Looks for arrays of work experience fields (e.g., experienceData[0].title)
 * and fills them with stored work experience entries.
 * Only fills ENABLED work experiences (checked in the popup).
 */
function autofillWorkExperience() {
  if (!profile.workExperience || !Array.isArray(profile.workExperience)) {
    console.log("Job Autofill: No work experience data found");
    return;
  }

  if (profile.workExperience.length === 0) {
    console.log("Job Autofill: Work experience array is empty");
    return;
  }

  // Filter to only enabled work experiences
  const enabledExperiences = profile.workExperience.filter(exp => exp.enabled !== false);

  if (enabledExperiences.length === 0) {
    console.log("Job Autofill: No enabled work experiences found (uncheck to enable in popup)");
    return;
  }

  console.log(`Job Autofill: Found ${enabledExperiences.length} enabled work experience entries (out of ${profile.workExperience.length} total)`);

  // Strategy 1: Look for fields with array notation (e.g., experienceData[0].title)
  // Fill them in order with enabled experiences
  enabledExperiences.forEach((exp, enabledIndex) => {
    // Job title
    fillWorkExperienceField(enabledIndex, ["title", "job.?title", "position", "role"], exp.title);

    // Company name
    fillWorkExperienceField(enabledIndex, ["company", "companyname", "employer", "organization"], exp.company);

    // Location
    fillWorkExperienceField(enabledIndex, ["location", "city", "place"], exp.location);

    // Start date
    fillWorkExperienceField(enabledIndex, ["startdate", "from.*date", "start", "begin.*date"], exp.startDate);

    // End date (if not current)
    if (!exp.current) {
      fillWorkExperienceField(enabledIndex, ["enddate", "to.*date", "end", "until.*date"], exp.endDate);
    }

    // Currently work here checkbox
    if (exp.current) {
      fillWorkExperienceCheckbox(enabledIndex, ["current", "present", "currentlywork"]);
    }

    // Role description
    fillWorkExperienceField(enabledIndex, ["description", "roledescription", "responsibilities", "duties", "achievements"], exp.description);
  });

  // Strategy 2: Look for generic work experience sections (for forms without array notation)
  // This handles forms that have "Add work experience" sections but don't use indexed fields
  const workExpSections = detectWorkExperienceSections();
  workExpSections.forEach((section, index) => {
    if (index >= enabledExperiences.length) return;

    const exp = enabledExperiences[index];
    fillWorkExperienceSectionFields(section, exp);
  });
}

/**
 * Fill a specific work experience field by index
 */
function fillWorkExperienceField(index, patterns, value) {
  if (!value) return;

  // Try multiple name patterns
  for (const pattern of patterns) {
    // Try with various array notations
    const selectors = [
      `[name*="[${index}].${pattern}"]`,
      `[name*="[${index}][${pattern}]"]`,
      `[name*="${index}.${pattern}"]`,
      `[name*="experience"][name*="${pattern}"][name*="${index}"]`,
      `[id*="experience-${index}-${pattern}"]`,
      `[data-index="${index}"][name*="${pattern}"]`
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        if (!el.value && (el.tagName.toLowerCase() === "input" || el.tagName.toLowerCase() === "textarea")) {
          console.log(`Job Autofill: Filling work experience [${index}] ${pattern} with "${value}"`);
          setValueWithEvents(el, value);
        }
      });
    }
  }
}

/**
 * Check/uncheck a work experience checkbox
 */
function fillWorkExperienceCheckbox(index, patterns) {
  for (const pattern of patterns) {
    const selectors = [
      `[name*="[${index}].${pattern}"]`,
      `[name*="[${index}][${pattern}]"]`,
      `[name*="${index}.${pattern}"]`,
      `[id*="experience-${index}-${pattern}"]`,
      `[data-index="${index}"][name*="${pattern}"]`
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll('input[type="checkbox"]' + selector);
      elements.forEach((el) => {
        if (!el.checked) {
          console.log(`Job Autofill: Checking "currently work here" checkbox for experience [${index}]`);
          el.checked = true;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }
  }
}

/**
 * Detect work experience sections (for forms without array notation)
 * Returns an array of DOM elements representing each work experience section
 */
function detectWorkExperienceSections() {
  const sections = [];

  // Look for containers with work experience keywords
  const containers = document.querySelectorAll(
    '[class*="experience"], [id*="experience"], [data-section*="experience"]'
  );

  containers.forEach((container) => {
    // Check if this container has work experience fields
    const hasTitle = container.querySelector('[name*="title"], [placeholder*="title" i]');
    const hasCompany = container.querySelector('[name*="company"], [placeholder*="company" i]');

    if (hasTitle || hasCompany) {
      sections.push(container);
    }
  });

  console.log(`Job Autofill: Found ${sections.length} work experience sections`);
  return sections;
}

/**
 * Fill work experience fields within a specific section
 */
function fillWorkExperienceSectionFields(section, exp) {
  if (!section || !exp) return;

  // Find and fill fields within this section
  const inputs = section.querySelectorAll("input, textarea");

  inputs.forEach((el) => {
    if (el.value) return; // Skip already filled fields

    const hint = getHint(el);

    // Job title
    if (!el.value && exp.title && /(title|position|role|job)/.test(hint) && !/(company)/.test(hint)) {
      setValueWithEvents(el, exp.title);
      return;
    }

    // Company
    if (!el.value && exp.company && /(company|employer|organization)/.test(hint)) {
      setValueWithEvents(el, exp.company);
      return;
    }

    // Location
    if (!el.value && exp.location && /(location|city|place)/.test(hint)) {
      setValueWithEvents(el, exp.location);
      return;
    }

    // Start date
    if (!el.value && exp.startDate && /(start.*date|from.*date|begin.*date)/.test(hint)) {
      setValueWithEvents(el, exp.startDate);
      return;
    }

    // End date
    if (!el.value && !exp.current && exp.endDate && /(end.*date|to.*date|until.*date)/.test(hint)) {
      setValueWithEvents(el, exp.endDate);
      return;
    }

    // Description
    if (!el.value && exp.description && el.tagName.toLowerCase() === "textarea" &&
        /(description|responsibilities|duties|role|achievement)/.test(hint)) {
      setValueWithEvents(el, exp.description);
      return;
    }
  });

  // Handle "currently work here" checkbox
  if (exp.current) {
    const checkbox = section.querySelector('input[type="checkbox"][name*="current"], input[type="checkbox"][name*="present"]');
    if (checkbox && !checkbox.checked) {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
}
