/* ============================================================
   AirAware AI – script.js
   Rule-based decision logic for the Air Quality Decision Assistant.
   This is a structured decision system – NOT AI/machine learning.
   The AI component is demonstrated separately via an AI/RAG workflow.
   ============================================================ */

/* ── 1. AQI Category Definitions ────────────────────────────
   Based on the US EPA Air Quality Index scale.
   Each level has:
     - max:         the highest AQI value that belongs in this level
     - label:       human-readable category name
     - cssClass:    the CSS class used to colour the result card
     - explanation: plain-language description of what this AQI means
   ──────────────────────────────────────────────────────────── */
const AQI_LEVELS = [
  {
    max: 50,
    label: "Good",
    cssClass: "aqi-good",
    explanation:
      "Air quality is considered satisfactory. There is little or no risk from air pollution for the general public."
  },
  {
    max: 100,
    label: "Moderate",
    cssClass: "aqi-moderate",
    explanation:
      "Air quality is acceptable. However, a small number of people who are unusually sensitive to air pollution may experience mild effects."
  },
  {
    max: 150,
    label: "Unhealthy for Sensitive Groups",
    cssClass: "aqi-sensitive",
    explanation:
      "Members of sensitive groups — including people with heart or lung disease, the elderly, and children — may begin to experience health effects. The general public is less likely to be affected."
  },
  {
    max: 200,
    label: "Unhealthy",
    cssClass: "aqi-unhealthy",
    explanation:
      "Everyone may begin to experience health effects. Members of sensitive groups may experience more serious effects. Consider reducing prolonged outdoor exertion."
  },
  {
    max: 300,
    label: "Very Unhealthy",
    cssClass: "aqi-very-unhealthy",
    explanation:
      "Health alert: everyone may experience more serious health effects. Avoid prolonged or heavy outdoor exertion. Sensitive groups should stay indoors."
  },
  {
    max: 500,
    label: "Hazardous",
    cssClass: "aqi-hazardous",
    explanation:
      "Health warnings of emergency conditions. The entire population is likely to be affected. Everyone should avoid all outdoor physical activity."
  }
];

/* ── 2. Activity Suggestions ─────────────────────────────────
   Suggestions are chosen based on the AQI level AND the
   chosen activity type. We combine a general air quality message
   with activity-specific guidance.
   ──────────────────────────────────────────────────────────── */

/**
 * Returns a plain-language activity suggestion string.
 *
 * @param {number} aqi       - The AQI value entered by the user
 * @param {string} activity  - The selected activity value (e.g. "running")
 * @param {number} duration  - Duration in minutes
 * @returns {string}         - The suggestion text
 */
function getActivitySuggestion(aqi, activity, duration) {

  // Map activity values to readable names for use in sentences
  const activityNames = {
    running:    "running or jogging",
    cycling:    "cycling",
    walking:    "walking",
    sports:     "outdoor sports or exercise",
    gardening:  "gardening or yard work",
    commuting:  "commuting outdoors"
  };

  const activityName = activityNames[activity] || "your outdoor activity";
  // Duration label: "30 minutes" or just "your planned duration"
  const durationLabel = duration ? `${duration} minute${duration === 1 ? "" : "s"}` : "your planned duration";

  // ── Good (0–50) ──
  if (aqi <= 50) {
    return `Conditions are ideal for ${activityName}. A ${durationLabel} session outdoors presents no air quality concerns. Enjoy your activity.`;
  }

  // ── Moderate (51–100) ──
  if (aqi <= 100) {
    if (activity === "running" || activity === "cycling" || activity === "sports") {
      return `Air quality is moderate. For high-intensity activities like ${activityName}, a ${durationLabel} session is generally fine for healthy adults. Unusually sensitive individuals may wish to shorten the session or take breaks.`;
    }
    return `Air quality is moderate. A ${durationLabel} session of ${activityName} should be comfortable for most people. People with respiratory conditions should monitor how they feel.`;
  }

  // ── Unhealthy for Sensitive Groups (101–150) ──
  if (aqi <= 150) {
    if (activity === "running" || activity === "cycling" || activity === "sports") {
      return `Air quality is at a level that may affect sensitive individuals during high-intensity activities like ${activityName}. Consider reducing the ${durationLabel} session to under 30 minutes or replacing it with indoor exercise. For personal health decisions, users should refer to official local air-quality guidance and appropriate professional advice.`;
    }
    return `Air quality may affect sensitive groups. A light ${activityName} session of ${durationLabel} is generally manageable for healthy adults. If you are elderly, a child, or have a health condition, consider a shorter outing or stay near shelter.`;
  }

  // ── Unhealthy (151–200) ──
  if (aqi <= 200) {
    if (activity === "running" || activity === "cycling" || activity === "sports") {
      return `At this AQI level, ${activityName} for ${durationLabel} is not advisable for anyone. Consider moving your workout indoors. If you must go outside, keep intensity low and duration short.`;
    }
    return `Everyone may experience health effects at this AQI level. For ${activityName}, try to limit your time outdoors to the shortest necessary duration. If ${durationLabel} can be postponed to a lower-AQI day, that would be preferable.`;
  }

  // ── Very Unhealthy (201–300) ──
  if (aqi <= 300) {
    return `This is a health alert level. Avoid ${activityName} outdoors entirely. Move your ${durationLabel} activity indoors, postpone it, or choose a low-exertion alternative that keeps you inside. Sensitive groups must stay indoors.`;
  }

  // ── Hazardous (301–500) ──
  return `Air quality is at a hazardous level. All outdoor activities, including ${activityName}, should be cancelled or postponed. Stay indoors with windows closed. This is a health emergency level – follow guidance from your local authorities.`;
}

/* ── 3. PM2.5 / PM10 Advisory ────────────────────────────────
   Provides an additional note if particulate matter readings
   are elevated, even when AQI appears lower.
   Returns an empty string if readings are within safe limits.
   ──────────────────────────────────────────────────────────── */

/**
 * Returns an optional advisory string about particulate matter.
 * WHO 24-hour guideline: PM2.5 ≤ 15 µg/m³, PM10 ≤ 45 µg/m³
 *
 * @param {number|null} pm25
 * @param {number|null} pm10
 * @returns {string}
 */
function getPMAdvisory(pm25, pm10) {
  const notes = [];

  if (pm25 !== null && pm25 > 15) {
    notes.push(`PM2.5 (${pm25} µg/m³) is above the WHO 24-hour guideline of 15 µg/m³`);
  }
  if (pm10 !== null && pm10 > 45) {
    notes.push(`PM10 (${pm10} µg/m³) is above the WHO 24-hour guideline of 45 µg/m³`);
  }

  if (notes.length === 0) return "";

  return " Note: " + notes.join(" and ") + ". Even when AQI appears lower, elevated particulate matter may still pose a health risk, especially for sensitive individuals.";
}

/* ── 4. Classify AQI ─────────────────────────────────────────
   Loops through AQI_LEVELS and returns the matching level object.
   ──────────────────────────────────────────────────────────── */

/**
 * Returns the AQI level object that matches the given AQI value.
 *
 * @param {number} aqi
 * @returns {object} - One of the AQI_LEVELS entries
 */
function classifyAQI(aqi) {
  for (const level of AQI_LEVELS) {
    if (aqi <= level.max) return level;
  }
  // Fallback: if somehow aqi > 500, treat as hazardous
  return AQI_LEVELS[AQI_LEVELS.length - 1];
}

/* ── 5. DOM References ───────────────────────────────────────
   Grab references to all the HTML elements we need to read
   or update. Doing this once at the top is good practice.
   ──────────────────────────────────────────────────────────── */
const analyzeBtn     = document.getElementById("analyze-btn");
const resetBtn       = document.getElementById("reset-btn");
const inputSection   = document.getElementById("input-section");
const resultSection  = document.getElementById("result-section");
const categoryLabel  = document.getElementById("category-label");
const explanationText = document.getElementById("explanation-text");
const suggestionText  = document.getElementById("suggestion-text");

/* ── 6. Analyze Button Handler ───────────────────────────────
   Runs when the user clicks "Analyze Air Quality":
   1. Reads and validates the form inputs
   2. Classifies AQI and builds the result text
   3. Updates the result section and makes it visible
   ──────────────────────────────────────────────────────────── */
analyzeBtn.addEventListener("click", function () {

  // ── Step 1: Read inputs ──
  const aqiRaw      = document.getElementById("aqi").value.trim();
  const pm25Raw     = document.getElementById("pm25").value.trim();
  const pm10Raw     = document.getElementById("pm10").value.trim();
  const activity    = document.getElementById("activity").value;
  const durationRaw = document.getElementById("duration").value.trim();

  // ── Step 2: Validate required fields ──
  if (aqiRaw === "") {
    alert("Please enter an AQI value before analysing.");
    return;
  }
  if (activity === "") {
    alert("Please select an outdoor activity.");
    return;
  }

  const aqi      = parseFloat(aqiRaw);
  const pm25     = pm25Raw !== ""     ? parseFloat(pm25Raw)     : null;
  const pm10     = pm10Raw !== ""     ? parseFloat(pm10Raw)     : null;
  const duration = durationRaw !== "" ? parseFloat(durationRaw) : null;

  // Validate that AQI is within the 0–500 scale
  if (isNaN(aqi) || aqi < 0 || aqi > 500) {
    alert("AQI must be a number between 0 and 500.");
    return;
  }

  // ── Step 3: Classify the AQI value ──
  const level = classifyAQI(aqi);

  // ── Step 4: Build the explanation text ──
  //   Combine the standard level explanation with any PM advisory note.
  const pmNote = getPMAdvisory(pm25, pm10);
  explanationText.textContent = level.explanation + pmNote;

  // ── Step 5: Build the activity suggestion ──
  suggestionText.textContent = getActivitySuggestion(aqi, activity, duration);

  // ── Step 6: Update the category label text and colour ──
  categoryLabel.textContent = level.label;

  // Remove any previously applied AQI colour classes from the label and card
  const allClasses = AQI_LEVELS.map(l => l.cssClass);
  categoryLabel.classList.remove(...allClasses);
  resultSection.classList.remove(...allClasses);

  // Apply the new class for the current AQI level
  categoryLabel.classList.add(level.cssClass);
  resultSection.classList.add(level.cssClass);

  // ── Step 7: Show the result section ──
  resultSection.hidden = false;

  // Smoothly scroll the result into view so the user sees it
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
});

/* ── 7. Reset Button Handler ─────────────────────────────────
   Clears all inputs and hides the result section so the
   user can start a fresh analysis.
   ──────────────────────────────────────────────────────────── */
resetBtn.addEventListener("click", function () {

  // Clear all input fields
  document.getElementById("aqi").value      = "";
  document.getElementById("pm25").value     = "";
  document.getElementById("pm10").value     = "";
  document.getElementById("activity").value = "";
  document.getElementById("duration").value = "";

  // Remove AQI colour classes from result card
  const allClasses = AQI_LEVELS.map(l => l.cssClass);
  resultSection.classList.remove(...allClasses);

  // Hide the result section
  resultSection.hidden = true;

  // Scroll back to the top of the form
  inputSection.scrollIntoView({ behavior: "smooth", block: "start" });
});
