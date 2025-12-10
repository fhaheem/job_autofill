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
  "website",
  "summary",
  "skills",

  // Generic address fields
  "address1",
  "address2",
  "city",
  "state", // 2-letter code preferred, e.g. "FL"
  "zip",
  "country",

  // Work experience (stored separately as an array)
  "workExperience"
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
    if (field === "workExperience") {
      // Handle work experience separately
      if (stored.workExperience && Array.isArray(stored.workExperience)) {
        renderWorkExperience(stored.workExperience);
      }
      return;
    }

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
    if (field === "workExperience") {
      // Read work experience from the stored array
      out.workExperience = window.workExperienceData || [];
      return;
    }

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

// ============================================================================
//  SECTION 5: WORK EXPERIENCE MANAGEMENT
// ============================================================================

// Store work experience data globally
window.workExperienceData = [];

/**
 * Render work experience entries in the UI
 */
function renderWorkExperience(experiences) {
  window.workExperienceData = experiences || [];
  const container = document.getElementById("workExperienceList");
  if (!container) return;

  container.innerHTML = "";

  if (experiences.length === 0) {
    container.innerHTML = '<div style="opacity: 0.6; font-size: 11px;">No work experiences added yet.</div>';
    return;
  }

  experiences.forEach((exp, index) => {
    const expDiv = document.createElement("div");
    expDiv.className = "work-experience-item";

    // Default enabled to true if not set
    const isEnabled = exp.enabled !== false;

    expDiv.innerHTML = `
      <div class="work-exp-controls">
        <input type="checkbox" class="work-exp-checkbox" data-index="${index}" ${isEnabled ? 'checked' : ''} />
        <div class="work-exp-order-btns">
          <button class="order-btn up-btn" data-index="${index}" ${index === 0 ? 'disabled' : ''}>▲</button>
          <button class="order-btn down-btn" data-index="${index}" ${index === experiences.length - 1 ? 'disabled' : ''}>▼</button>
        </div>
      </div>
      <div class="work-exp-content ${!isEnabled ? 'disabled' : ''}">
        <div class="work-exp-header">
          <strong>${exp.title || "Untitled Position"}</strong> at ${exp.company || "Unknown Company"}
          <button class="delete-exp-btn" data-index="${index}">Remove</button>
        </div>
        <div class="work-exp-details">
          ${exp.location || ""} | ${exp.startDate || ""} - ${exp.current ? "Present" : (exp.endDate || "")}
        </div>
      </div>
    `;
    container.appendChild(expDiv);
  });

  // Add event listeners to checkboxes
  container.querySelectorAll(".work-exp-checkbox").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const index = parseInt(e.target.getAttribute("data-index"));
      toggleWorkExperience(index, e.target.checked);
    });
  });

  // Add event listeners to delete buttons
  container.querySelectorAll(".delete-exp-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = parseInt(e.target.getAttribute("data-index"));
      deleteWorkExperience(index);
    });
  });

  // Add event listeners to order buttons
  container.querySelectorAll(".up-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = parseInt(e.target.getAttribute("data-index"));
      moveWorkExperience(index, -1);
    });
  });

  container.querySelectorAll(".down-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = parseInt(e.target.getAttribute("data-index"));
      moveWorkExperience(index, 1);
    });
  });
}

/**
 * Show the work experience form modal
 */
function showWorkExperienceForm(editIndex = -1) {
  const modal = document.getElementById("workExpModal");
  const form = document.getElementById("workExpForm");

  if (!modal || !form) return;

  // Reset form
  form.reset();
  document.getElementById("workExpCurrent").checked = false;
  document.getElementById("workExpEndDate").disabled = false;

  // If editing, populate form with existing data
  if (editIndex >= 0 && window.workExperienceData[editIndex]) {
    const exp = window.workExperienceData[editIndex];
    document.getElementById("workExpTitle").value = exp.title || "";
    document.getElementById("workExpCompany").value = exp.company || "";
    document.getElementById("workExpLocation").value = exp.location || "";
    document.getElementById("workExpStartDate").value = exp.startDate || "";
    document.getElementById("workExpEndDate").value = exp.endDate || "";
    document.getElementById("workExpDescription").value = exp.description || "";
    document.getElementById("workExpCurrent").checked = exp.current || false;

    if (exp.current) {
      document.getElementById("workExpEndDate").disabled = true;
    }
  }

  modal.style.display = "block";
  modal.dataset.editIndex = editIndex;
}

/**
 * Hide the work experience form modal
 */
function hideWorkExperienceForm() {
  const modal = document.getElementById("workExpModal");
  if (modal) {
    modal.style.display = "none";
  }
}

/**
 * Save work experience from the form
 */
function saveWorkExperience() {
  const editIndex = parseInt(document.getElementById("workExpModal").dataset.editIndex || "-1");

  const experience = {
    title: document.getElementById("workExpTitle").value,
    company: document.getElementById("workExpCompany").value,
    location: document.getElementById("workExpLocation").value,
    startDate: document.getElementById("workExpStartDate").value,
    endDate: document.getElementById("workExpEndDate").value,
    current: document.getElementById("workExpCurrent").checked,
    description: document.getElementById("workExpDescription").value,
    enabled: true  // Default to enabled for new/edited entries
  };

  if (editIndex >= 0) {
    // Update existing entry, preserve enabled state if it exists
    const existingEnabled = window.workExperienceData[editIndex]?.enabled;
    experience.enabled = existingEnabled !== undefined ? existingEnabled : true;
    window.workExperienceData[editIndex] = experience;
  } else {
    // Add new entry
    window.workExperienceData.push(experience);
  }

  // Save to chrome storage immediately
  chrome.storage.sync.set({ workExperience: window.workExperienceData }, () => {
    renderWorkExperience(window.workExperienceData);
    hideWorkExperienceForm();
    showStatus("Work experience saved!");
  });
}

/**
 * Delete work experience at index
 */
function deleteWorkExperience(index) {
  if (confirm("Remove this work experience?")) {
    window.workExperienceData.splice(index, 1);

    // Save to chrome storage immediately
    chrome.storage.sync.set({ workExperience: window.workExperienceData }, () => {
      renderWorkExperience(window.workExperienceData);
      showStatus("Work experience deleted!");
    });
  }
}

/**
 * Toggle work experience enabled/disabled
 */
function toggleWorkExperience(index, enabled) {
  if (window.workExperienceData[index]) {
    window.workExperienceData[index].enabled = enabled;

    // Save to chrome storage immediately
    chrome.storage.sync.set({ workExperience: window.workExperienceData }, () => {
      renderWorkExperience(window.workExperienceData);
    });
  }
}

/**
 * Move work experience up or down in the list
 */
function moveWorkExperience(index, direction) {
  const newIndex = index + direction;

  if (newIndex < 0 || newIndex >= window.workExperienceData.length) {
    return;
  }

  // Swap the two items
  const temp = window.workExperienceData[index];
  window.workExperienceData[index] = window.workExperienceData[newIndex];
  window.workExperienceData[newIndex] = temp;

  // Save to chrome storage immediately
  chrome.storage.sync.set({ workExperience: window.workExperienceData }, () => {
    renderWorkExperience(window.workExperienceData);
  });
}

// ============================================================================
//  SECTION 6: EVENT BINDING & INITIALIZATION
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  const saveButton = document.getElementById("save");
  const addWorkExpBtn = document.getElementById("addWorkExp");
  const cancelWorkExpBtn = document.getElementById("cancelWorkExp");
  const saveWorkExpBtn = document.getElementById("saveWorkExp");
  const currentCheckbox = document.getElementById("workExpCurrent");

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

  // Work experience button handlers
  if (addWorkExpBtn) {
    addWorkExpBtn.addEventListener("click", () => showWorkExperienceForm());
  }

  if (cancelWorkExpBtn) {
    cancelWorkExpBtn.addEventListener("click", hideWorkExperienceForm);
  }

  if (saveWorkExpBtn) {
    saveWorkExpBtn.addEventListener("click", saveWorkExperience);
  }

  // "Currently work here" checkbox handler
  if (currentCheckbox) {
    currentCheckbox.addEventListener("change", (e) => {
      const endDateInput = document.getElementById("workExpEndDate");
      if (endDateInput) {
        endDateInput.disabled = e.target.checked;
        if (e.target.checked) {
          endDateInput.value = "";
        }
      }
    });
  }
});
