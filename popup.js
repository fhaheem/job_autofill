// ============================================================================
//  POPUP SCRIPT
//  - Loads data from chrome.storage.sync
//  - Saves updated profile fields
//  - Modular + easy to extend
// ============================================================================



// ============================================================================
//  SECTION 1: FIELD DEFINITIONS
//  Add/remove fields here and everything else updates automatically.
// ============================================================================
const PROFILE_FIELDS = [
  "fullName",
  "email",
  "phone",
  "linkedin",
  "github",
  "summary",

  // Generic address fields
  "address1",
  "address2",
  "city",
  "state", // 2-letter code preferred, e.g. "FL"
  "zip"
];



// ============================================================================
//  SECTION 2: STORAGE HELPERS
//  - Load a list of fields from storage
//  - Save a list of fields to storage
// ============================================================================

/**
 * Load field values from chrome.storage.sync.
 * Calls callback with the loaded data.
 */
function loadProfileFields(callback) {
  chrome.storage.sync.get(PROFILE_FIELDS, (data) => {
    callback(data || {});
  });
}

/**
 * Save field values to chrome.storage.sync.
 */
function saveProfileFields(values, callback) {
  chrome.storage.sync.set(values, callback);
}



// ============================================================================
//  SECTION 3: DOM HELPERS
//  - Populate popup inputs with stored values
//  - Extract values from popup inputs
// ============================================================================

/**
 * Fill popup UI inputs using stored values.
 */
function populateUIValues(stored) {
  PROFILE_FIELDS.forEach((field) => {
    const el = document.getElementById(field);
    if (el && stored[field]) {
      el.value = stored[field];
    }
  });
}

/**
 * Read all popup UI input values into a JS object.
 */
function readValuesFromUI() {
  const out = {};
  PROFILE_FIELDS.forEach((field) => {
    const el = document.getElementById(field);
    out[field] = el ? (el.value || "") : "";
  });
  return out;
}

/**
 * Show temporary status text ("Saved!" etc.)
 */
function showStatus(message) {
  const status = document.getElementById("status");
  if (!status) return;

  status.textContent = message;
  setTimeout(() => {
    status.textContent = "";
  }, 1500);
}



// ============================================================================
//  SECTION 4: EVENT BINDING & INITIALIZATION
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  const saveButton = document.getElementById("save");

  // Load saved values into the UI
  loadProfileFields((storedValues) => {
    populateUIValues(storedValues);
  });

  // Save button handler
  saveButton.addEventListener("click", () => {
    const values = readValuesFromUI();
    saveProfileFields(values, () => {
      showStatus("Saved!");
    });
  });
});
