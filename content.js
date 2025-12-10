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
 * Load profile data when the content script runs.
 */
chrome.storage.sync.get(
  [
    "fullName",
    "email",
    "phone",
    "linkedin",
    "github",
    "summary",

    // Address fields
    "address1",
    "address2",
    "city",
    "state",
    "zip"
  ],
  (data) => {
    profile = data || {};
    injectAutofillButton();
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

  Object.assign(btn.style, {
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
  });

  btn.addEventListener("mouseenter", () => {
    btn.style.background = "#f5f5f5";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "#ffffff";
  });

  btn.addEventListener("click", () => {
    const host = window.location.hostname.toLowerCase();

    try {
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

  inputs.forEach((el) => {
    if (skipFilled && el.value) return;

    const hint = getHint(el);

    // Apply rule functions in order; stop at the first one that returns true.
    if (applyEmailRule(el, hint)) return;
    if (applyNameRules(el, hint, nameParts)) return;
    if (applyPhoneRule(el, hint)) return;
    if (applyAddressLine1Rule(el, hint)) return;
    if (applyAddressLine2Rule(el, hint)) return;
    if (applyCityRule(el, hint)) return;
    if (applyStateRule(el, hint)) return;
    if (applyZipRule(el, hint)) return;
    if (applyLinkedInRule(el, hint)) return;
    if (applyGitHubRule(el, hint)) return;
    if (applyWebsiteRule(el, hint)) return;
    if (applySummaryRule(el, hint)) return;
  });

  const firstInput = document.querySelector("input, textarea");
  if (firstInput) {
    firstInput.scrollIntoView({ behavior: "smooth", block: "center" });
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

  if (!/(state|province|region)/.test(hint)) return false;

  const tag = el.tagName.toLowerCase();
  const state = profile.state.trim();

  // If it's a select, try to pick the correct option
  if (tag === "select") {
    const normalized = state.toLowerCase();
    const options = Array.from(el.options || []);

    let match = options.find((opt) => {
      const val = (opt.value || "").trim().toLowerCase();
      const txt = (opt.textContent || "").trim().toLowerCase();

      if (normalized.length === 2) {
        // "FL"
        return (
          val === normalized ||
          txt === normalized ||
          txt.endsWith(`(${normalized})`) // "Florida (fl)"
        );
      } else {
        // "Florida"
        return val === normalized || txt === normalized;
      }
    });

    if (!match && state.length === 2) {
      // fallback: match any " (FL)" pattern, or exact value
      match = options.find((opt) => {
        const txt = (opt.textContent || "").toLowerCase();
        const val = (opt.value || "").toLowerCase();
        return txt.includes(`(${normalized})`) || val === normalized;
      });
    }

    if (match) {
      setValueWithEvents(el, match.value);
      return true;
    }

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
