// Drop near the top of script.js
const STORAGE = (() => {
  try {
    const k = "__probe_" + Math.random();
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return window.localStorage; // real storage
  } catch {
    const mem = {};
    return {
      // in-memory fallback
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => {
        mem[k] = String(v);
      },
      removeItem: (k) => {
        delete mem[k];
      },
    };
  }
})();

//  -----
const STORE_KEY = "inj-track";

// bump version
const SCHEMA_VERSION = 4; // bump this whenever you change the saved shape

const allZones = {
  skyrizi: [
    "Right Arm",
    "Left Arm",
    "Stomach",
    "Right Thigh - Upper Outer",
    "Right Thigh - Middle Outer",
    "Right Thigh - Lower Outer",
    "Right Thigh - Upper Inner",
    "Right Thigh - Middle Inner",
    "Right Thigh - Lower Inner",
    "Left Thigh - Upper Outer",
    "Left Thigh - Middle Outer",
    "Left Thigh - Lower Outer",
    "Left Thigh - Upper Inner",
    "Left Thigh - Middle Inner",
    "Left Thigh - Lower Inner",
  ],
  repatha: [
    "Right Arm",
    "Left Arm",
    "Stomach",
    "Right Thigh - Upper Outer",
    "Right Thigh - Middle Outer",
    "Right Thigh - Lower Outer",
    "Right Thigh - Upper Inner",
    "Right Thigh - Middle Inner",
    "Right Thigh - Lower Inner",
    "Left Thigh - Upper Outer",
    "Left Thigh - Middle Outer",
    "Left Thigh - Lower Outer",
    "Left Thigh - Upper Inner",
    "Left Thigh - Middle Inner",
    "Left Thigh - Lower Inner",
  ],
};

const AmbigUI = (() => {
  const root = document.getElementById("ambig-modal");
  const labelEl = document.getElementById("ambig-label");
  const selectEl = document.getElementById("ambig-select");
  const applyAllEl = document.getElementById("ambig-apply-all");
  const btnSave = document.getElementById("ambig-save");
  const btnSkip = document.getElementById("ambig-skip");

  let queue = []; // [{med, label, indexes: [idx,...]}]
  let current = null;

  function open() {
    root.classList.remove("hidden");
  }
  function close() {
    root.classList.add("hidden");
  }

  function loadNext() {
    current = queue.shift() || null;
    if (!current) {
      close();
      // after finishing all, repaint
      ["skyrizi", "repatha"].forEach(renderHistory);
      ["skyrizi", "repatha"].forEach(renderBodymap);
      renderZoneOptions("skyrizi");
      renderZoneOptions("repatha");
      save();
      return;
    }

    // configure UI
    const { med, label } = current;
    labelEl.textContent = label;

    // build select options
    selectEl.innerHTML = "";
    suggestedSubzones(med, label).forEach((z) => {
      const opt = document.createElement("option");
      opt.value = z;
      opt.textContent = z;
      selectEl.appendChild(opt);
    });

    applyAllEl.checked = true;
    open();
  }

  btnSave.addEventListener("click", () => {
    if (!current) return;
    const choice = selectEl.value;
    const { med, label, indexes } = current;

    if (applyAllEl.checked) {
      // replace for all entries that have this label
      state[med].history.forEach((h) => {
        if (h.site === label) h.site = choice;
      });
    } else {
      // replace only the first pending index in this group
      const i = indexes.shift();
      if (typeof i === "number") state[med].history[i].site = choice;
      // if still more in this group, re-queue the rest
      if (indexes.length) queue.unshift({ med, label, indexes });
    }

    loadNext();
  });

  btnSkip.addEventListener("click", () => {
    loadNext(); // leave entries unchanged
  });

  return {
    resolve(med) {
      // group by identical label for fewer prompts
      const amb = findAmbiguities(med);
      if (!amb.length) return;

      const groups = new Map();
      amb.forEach(({ index, site }) => {
        if (!groups.has(site)) groups.set(site, []);
        groups.get(site).push(index);
      });

      groups.forEach((indexes, label) => {
        queue.push({ med, label, indexes });
      });

      if (queue.length && !current) loadNext();
    },
    resolveAll() {
      this.resolve("skyrizi");
      this.resolve("repatha");
    },
  };
})();

function isValidZone(med, site) {
  return (
    (state?.[med]?.zones || []).includes(site) ||
    (allZones?.[med] || []).includes(site)
  );
}

// Suggest sub-zones when we only know "Right Thigh" or "Left Thigh"
function suggestedSubzones(med, label) {
  const zones = allZones[med] || [];
  const lower = String(label || "").toLowerCase();

  // Known partials → filter matching side
  if (lower.includes("right thigh"))
    return zones.filter((z) => /Right Thigh/.test(z));
  if (lower.includes("left thigh"))
    return zones.filter((z) => /Left Thigh/.test(z));

  // Very generic "thigh"
  if (lower.includes("thigh")) return zones.filter((z) => /Thigh/.test(z));

  // Arms & stomach generic fallbacks
  if (lower.includes("arm")) return zones.filter((z) => /Arm/.test(z));
  if (lower.includes("stomach")) return zones.filter((z) => /Stomach/.test(z));

  // Default to all zones
  return zones.slice();
}

// Find ambiguous history entries (those whose site isn’t a known zone)
function findAmbiguities(med) {
  const hist = Array.isArray(state?.[med]?.history) ? state[med].history : [];
  const bad = [];
  for (let i = 0; i < hist.length; i++) {
    const h = hist[i];
    if (!h || !h.site) continue;
    if (!isValidZone(med, h.site)) {
      bad.push({ index: i, site: h.site });
    }
  }
  return bad;
}

function defaults() {
  return {
    __v: SCHEMA_VERSION,
    skyrizi: {
      start: null,
      interval: 8,
      dose: "",
      history: [],
      zones: [...allZones.skyrizi], // ✅ select all by default
    },
    repatha: {
      start: null,
      interval: 2,
      dose: "140 mg",
      history: [],
      zones: [...allZones.repatha], // ✅ select all by default
    },
  };
}

// Helpers to keep reads safe everywhere
const arr = (v) => (Array.isArray(v) ? v : []);
const num = (v, f = 0) => (typeof v === "number" && Number.isFinite(v) ? v : f);
const str = (v, f = "") => (typeof v === "string" ? v : f);

// Normalize ensures required fields exist with correct types
function normalize(s) {
  for (const med of ["skyrizi", "repatha"]) {
    s[med] = s[med] || {};
    s[med].zones = arr(s[med].zones);
    s[med].history = arr(s[med].history);
    s[med].interval = num(s[med].interval, med === "skyrizi" ? 8 : 2);
    s[med].dose = str(s[med].dose, med === "repatha" ? "140 mg" : "");
    if (s[med].start === undefined) s[med].start = null;
  }
  return s;
}

// One small function per version step; must be idempotent.
const MIGRATIONS = {
  0: (s) => normalize({ ...defaults(), ...s }),
  1: (s) => {
    for (const med of ["skyrizi", "repatha"]) {
      if (!("dose" in s[med])) {
        s[med].dose = med === "repatha" ? "140 mg" : "";
      }
    }
    return s;
  },
  2: (s) => {
    for (const med of ["skyrizi", "repatha"]) {
      if (!Array.isArray(s[med].zones)) {
        s[med].zones = [...allZones[med]];
      }
    }
    return s;
  },
  3: (s) => {
    for (const med of ["skyrizi", "repatha"]) {
      s[med].history = s[med].history.map((h) => {
        if (!("dose" in h)) h.dose = "";
        if (!h.ts || isNaN(h.ts)) h.ts = Date.now();
        return h;
      });
    }
    return s;
  },
};

function createStore(key = STORE_KEY) {
  function readRaw(k) {
    try {
      return STORAGE.getItem(k);
    } catch {
      return null;
    }
  }

  function writeRaw(k, v) {
    try {
      STORAGE.setItem(k, v);
    } catch {}
  }

  function parse(json) {
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function upgrade(state) {
    let v = Number(state?.__v ?? 0);
    if (!Number.isFinite(v)) v = 0;
    for (let from = v; from < SCHEMA_VERSION; from++) {
      const step = MIGRATIONS[from];
      if (typeof step === "function") state = step(state) || state;
      state.__v = from + 1;
    }
    return normalize(state);
  }

  function load() {
    const raw = readRaw(key);
    let state = raw ? parse(raw) : null;

    // If corrupted, try the backup; otherwise start fresh
    if (!state || typeof state !== "object") {
      const bak = parse(readRaw(key + ".bak"));
      state = bak && typeof bak === "object" ? bak : defaults();
    }

    // Keep a backup of the last known good blob before we rewrite
    writeRaw(key + ".bak", JSON.stringify(state));

    // Upgrade to current schema and persist
    const upgraded = upgrade(state);
    upgraded.__v = SCHEMA_VERSION;
    writeRaw(key, JSON.stringify(upgraded));
    return upgraded;
  }

  function save(next) {
    // Write-ahead log: back up current, then write new
    const current = readRaw(key);
    if (current) writeRaw(key + ".bak", current);
    const normalized = normalize({ ...next, __v: SCHEMA_VERSION });
    writeRaw(key, JSON.stringify(normalized));
  }

  return { load, save };
}

// ----- usage in your app -----
const STORE = createStore();
let state = STORE.load();
function save() {
  STORE.save(state);
}

let selectedSite = { skyrizi: null, repatha: null };

// Short date for body labels: "Jan. 5", "Sep. 18"
function formatShortDate(ts) {
  if (!ts) return "—";
  let str = new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return str.replace(/^([A-Za-z]{3}) /, "$1. ");
}

// get the most recent timestamp per site
function latestBySite(med) {
  const latest = new Map();
  const hist = Array.isArray(state?.[med]?.history) ? state[med].history : [];
  const sorted = hist.slice().sort((a, b) => b.ts - a.ts);
  for (const h of sorted) {
    if (!h.site) continue;
    if (!latest.has(h.site)) latest.set(h.site, h.ts);
  }
  return latest;
}

// choose where to place the pill around the hotspot so it stays visible
function chooseTagPosition(hotspotEl) {
  const container =
    hotspotEl.closest('[id^="bodymap-"]') || hotspotEl.parentElement;
  const c = container.getBoundingClientRect();
  const r = hotspotEl.getBoundingClientRect();
  const topSpace = r.top - c.top;
  const rightSpace = c.right - r.right;
  const bottomSpace = c.bottom - r.bottom;
  const leftSpace = r.left - c.left;

  // prefer top, then right, then bottom, else left
  if (topSpace > 22) return "top";
  if (rightSpace > 60) return "right";
  if (bottomSpace > 22) return "bottom";
  return "left";
}

function createZoneToggle(container, med, zone) {
  const wrapper = document.createElement("label");
  wrapper.className = "flex items-center gap-3 cursor-pointer select-none";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "sr-only peer"; // hide default checkbox but keep accessible
  input.checked = state[med].zones.includes(zone);

  const slider = document.createElement("div");
  slider.className = `
    w-11 h-6 rounded-full bg-gray-300 peer-checked:bg-green-500
    relative transition-colors
    after:content-[''] after:absolute after:top-0.5 after:left-0.5
    after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-transform
    peer-checked:after:translate-x-5
  `;

  const label = document.createElement("span");
  label.textContent = zone;
  label.className = "text-sm text-slate-700";

  input.addEventListener("change", () => {
    if (input.checked) {
      if (!state[med].zones.includes(zone)) {
        state[med].zones.push(zone);
      }
    } else {
      state[med].zones = state[med].zones.filter((z) => z !== zone);
    }
    save();
    renderBodymap(med);
    renderHistory(med);
  });

  wrapper.appendChild(input);
  wrapper.appendChild(slider);
  wrapper.appendChild(label);
  container.appendChild(wrapper);
}

function renderZoneOptions(med) {
  const container = document.getElementById(`zone-options-${med}`);
  // was the drawer open before we re-render?
  const prevThigh = container.querySelector(".thigh-container");
  const wasOpen = prevThigh ? !prevThigh.classList.contains("hidden") : false;
  container.innerHTML = "";

  const zones = allZones[med];
  const thighZones = zones.filter((z) => z.includes("Thigh"));
  const nonThighZones = zones.filter((z) => !z.includes("Thigh"));

  // Non-thigh zones as pills
  nonThighZones.forEach((zone) => {
    createZoneToggle(container, med, zone);
  });

  // Thigh collapsible
  const thighWrapper = document.createElement("div");
  thighWrapper.className = "mt-2 col-span-2"; // separate block, not inline with stomach

  const toggleBtn = document.createElement("button");
  toggleBtn.className = `
  inline-flex items-center justify-between gap-2
  w-full px-5 py-2 rounded-full
  bg-white/90 backdrop-blur
  border border-slate-300
  text-sm font-medium text-slate-800
  shadow-sm
  hover:bg-slate-50
  active:bg-slate-100 active:shadow-inner
  transition
`;

  toggleBtn.innerHTML = `
  <span>Thigh Options</span>
  <span class="chevron text-slate-500 transition-transform duration-300 ease-in-out">▼</span>
`;

  const thighContainer = document.createElement("div");
  thighContainer.className =
    "thigh-container hidden flex flex-wrap gap-2 mt-2 animate-fadeIn";
  let autoCloseTimer;

  function scheduleAutoClose() {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = setTimeout(() => {
      thighContainer.classList.add("hidden");
    }, 7000);
  }

  toggleBtn.addEventListener("click", () => {
    thighContainer.classList.toggle("hidden");

    const chevron = toggleBtn.querySelector(".chevron");
    if (!thighContainer.classList.contains("hidden")) {
      chevron.style.transform = "rotate(180deg)";
      scheduleAutoClose();
    } else {
      chevron.style.transform = "rotate(0deg)";
    }
  });

  // If the user interacts inside the drawer, treat that as "active" and
  // refresh the inactivity countdown so it doesn't close mid-selection.
  thighContainer.addEventListener("click", () => {
    if (!thighContainer.classList.contains("hidden")) scheduleAutoClose();
  });

  // Create thigh zone pills
  thighZones.forEach((zone) => {
    createZoneToggle(thighContainer, med, zone);
  });

  thighWrapper.appendChild(toggleBtn);
  thighWrapper.appendChild(thighContainer);
  container.appendChild(thighWrapper);

  // restore prior open/closed state after re-render
  if (wasOpen) {
    thighContainer.classList.remove("hidden");
    scheduleAutoClose();
  }
}

// Determine which zones are "used" in the current rolling cycle.
// We scan history from most-recent backwards, collecting unique zones among the
// currently enabled zones until we have them all. If we *do* have them all,
// the oldest among that set becomes available again.
function computeUsedZones(med) {
  const enabled = state?.[med]?.zones ?? [];
  if (enabled.length === 0) {
    return { usedSet: new Set(), oldestAvailable: null, fullCycle: false };
  }

  const hist = (Array.isArray(state?.[med]?.history) ? state[med].history : [])
    .slice()
    .sort((a, b) => b.ts - a.ts);

  const uniq = [];
  const seen = new Set();
  for (const h of hist) {
    const z = h.site;
    if (!z || !enabled.includes(z) || seen.has(z)) continue;
    uniq.push(z);
    seen.add(z);
    if (uniq.length === enabled.length) break;
  }
  const fullCycle = uniq.length === enabled.length;
  const oldestAvailable = fullCycle ? uniq[uniq.length - 1] : null;
  const usedSet = new Set(fullCycle ? uniq.slice(0, -1) : uniq);
  return { usedSet, oldestAvailable, fullCycle };
}

// Helper: create or reuse an outline element for a hotspot
function ensureOutlineFor(hotspotEl) {
  // reuse a child outline if present
  let outline = hotspotEl.parentElement.querySelector(
    '.site-outline[data-for="' + hotspotEl.dataset.site + '"]'
  );
  if (!outline) {
    outline = document.createElement("div");
    outline.className = "site-outline";
    outline.setAttribute("data-for", hotspotEl.dataset.site);
    // attach to the same container as hotspot so positioning is consistent
    hotspotEl.parentElement.appendChild(outline);
  }
  return outline;
}

// Position and size the circular outline around a hotspot element
function positionOutline(hotspotEl, outlineEl) {
  const container =
    hotspotEl.closest('[id^="bodymap-"]') || hotspotEl.parentElement;
  const cRect = container.getBoundingClientRect();
  const hRect = hotspotEl.getBoundingClientRect();

  // compute center coords relative to the container (in px)
  const centerX = hRect.left - cRect.left + hRect.width / 2;
  const centerY = hRect.top - cRect.top + hRect.height / 2;

  // diameter: use the bigger side and scale so the circle surrounds the rectangle comfortably
  const base = Math.max(hRect.width, hRect.height);
  const diameter = Math.round(base * 0.6); // tweak multiplier as you like

  // place in px (absolute inside container)
  outlineEl.style.left = centerX + "px";
  outlineEl.style.top = centerY + "px";
  outlineEl.style.width = diameter + "px";
  outlineEl.style.height = diameter + "px";
}

// Remove any outlines that correspond to hidden hotspots
function cleanupOutlines(container) {
  const outlines = container.querySelectorAll(".site-outline");
  outlines.forEach((o) => {
    const site = o.getAttribute("data-for");
    const hotspot = container.querySelector(
      `.site-hotspot[data-site="${site}"]`
    );
    if (!hotspot || hotspot.style.display === "none") {
      o.remove();
    }
  });
}
const MEDS = new Set(["skyrizi", "repatha"]);
function renderBodymap(med) {
  if (!MEDS.has(med)) return;

  const hotspots = document.querySelectorAll(`#bodymap-${med} .site-hotspot`);
  const enabled = state[med].zones || [];
  const { usedSet } = computeUsedZones(med);
  const latest = latestBySite(med);

  hotspots.forEach((h) => {
    const site = h.dataset.site;
    const visible = enabled.includes(site);

    // base visibility + clear previous state
    h.style.display = visible ? "block" : "none";
    if (visible) {
      // existing code...
      // create/position outline
      const outline = ensureOutlineFor(h);
      positionOutline(h, outline);
      outline.classList.add("visible");
      // add a subtle accent when the hotspot is hovered or selected
      h.addEventListener("mouseenter", () => outline.classList.add("accent"));
      h.addEventListener("mouseleave", () =>
        outline.classList.remove("accent")
      );
      h.addEventListener("click", () => {
        // briefly accent so selection feels tactile
        outline.classList.add("accent");
        setTimeout(() => outline.classList.remove("accent"), 400);
      });
    } else {
      // if hidden, remove any outline for cleanliness
      const outlineEl = h.parentElement.querySelector(
        '.site-outline[data-for="' + h.dataset.site + '"]'
      );
      if (outlineEl) outlineEl.remove();
    }

    h.classList.remove("site-used");
    h.querySelectorAll(".site-tag, .site-callout, .site-dot").forEach((el) =>
      el.remove()
    );

    if (visible && usedSet.has(site)) {
      // mark as used (red)
      h.classList.add("site-used");
      h.title = `${site} — used this rotation`;

      // add small center dot (optional; remove if you don't want it)
      const dot = document.createElement("div");
      dot.className = "site-dot";
      h.appendChild(dot);

      // add the external date pill
      const ts = latest.get(site);
      const tag = document.createElement("div");
      tag.className = "site-tag";
      tag.textContent = formatShortDate(ts);

      // attach inside hotspot (absolute) and decide where to anchor it
      const pos = chooseTagPosition(h);
      tag.setAttribute("data-pos", pos);
      h.appendChild(tag);
    } else if (visible) {
      h.title = site;
    }
    const container = document.getElementById("bodymap-" + med);
    if (container) cleanupOutlines(container);
  });
}

// keep labels well placed on resize
window.addEventListener("resize", () => {
  ["skyrizi", "repatha"].forEach(renderBodymap);
});

function formatFullDate(ts) {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function renderHistory(med) {
  const container = document.getElementById(`${med}-history`);

  const dotColor = med === "skyrizi" ? "bg-green-500" : "bg-indigo-500";

  container.className =
    "mt-3 space-y-4 relative border-l border-slate-200 pl-4 text-sm list-none";
  container.innerHTML = "";

  const history = [...state[med].history].sort((a, b) => b.ts - a.ts);

  history.forEach((h) => {
    const li = document.createElement("li");
    li.className = "relative";

    li.innerHTML = `
      <div class="absolute -left-7 top-1 w-3 h-3 ${dotColor} rounded-full border border-white"></div>
      <p class="font-medium text-slate-700">${formatFullDate(h.ts)} — ${
      h.site || ""
    }</p>

      ${h.dose ? `<p class="text-xs text-slate-500">${h.dose}</p>` : ""}
    `;

    container.appendChild(li);
  });
}

function exportHistoryCSV(med) {
  const rows = [["Date", "Site", "Dose"]];
  state[med].history.forEach((h) => {
    rows.push([
      new Date(h.ts).toISOString().slice(0, 10),
      h.site || "",
      h.dose || "",
    ]);
  });
  let csvContent = rows.map((e) => e.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${med}-history.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function importHistoryCSV(med, file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const text = e.target.result.trim();
    const lines = text.split(/\r?\n/);

    let headers = lines[0].split(",");
    let hasHeader = ["Date", "Site", "Dose"].every((h) => headers.includes(h));

    const rows = hasHeader ? lines.slice(1) : lines;

    const data = rows.map((line) => {
      const parts = line.split(",");
      let [date, site, dose] = parts;

      // normalize date: try ISO first
      let ts = Date.parse(`${date}T00:00:00Z`);
      if (isNaN(ts)) {
        // fallback: dd/mm/yyyy
        const m = date.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (m) {
          const [_, d, mo, y] = m;
          ts = Date.parse(
            `${y.length === 2 ? "20" + y : y}-${mo}-${d}T00:00:00Z`
          );
        }
      }

      // ensure all fields exist
      if (!dose) dose = "";
      return { ts: ts || Date.now(), site: site || "", dose };
    });

    // merge safely
    const existingDates = state[med].history.map((h) =>
      new Date(h.ts).toDateString()
    );
    data.forEach((entry) => {
      const entryDate = new Date(entry.ts).toDateString();
      if (!existingDates.includes(entryDate)) {
        state[med].history.push(entry);
      }
    });

    state[med].history.sort((a, b) => a.ts - b.ts);
    save();
    renderHistory(med);
    renderBodymap(med);
    renderZoneOptions(med);

    // NEW: prompt user to resolve ambiguous sites from the imported file
    AmbigUI.resolve(med);

    alert(`✅ ${med} history merged from CSV (old format handled).`);
  };
  reader.readAsText(file);
}

document.body.addEventListener("click", (e) => {
  const hotspot = e.target.closest(".site-hotspot");
  if (hotspot) {
    const med = hotspot.dataset.med;
    document
      .querySelectorAll(`#bodymap-${med} .site-hotspot`)
      .forEach((h) => h.classList.remove("site-selected"));
    hotspot.classList.add("site-selected");
    selectedSite[med] = hotspot.dataset.site;
  }

  const btn = e.target.closest("button");
  if (!btn) return;
  const med = btn.dataset.med;
  if (btn.dataset.action === "logNow") {
    if (!selectedSite[med]) {
      alert("⚠️ Please select an injection site before logging.");
      return;
    }
    const today = new Date().toDateString();
    if (
      state[med].history.some((h) => new Date(h.ts).toDateString() === today)
    ) {
      if (
        !confirm(
          "⚠️ You already logged an injection today. Log another one anyway?"
        )
      ) {
        return;
      }
    }

    state[med].history.push({
      ts: Date.now(),
      site: selectedSite[med],
      dose: state[med].dose || "",
    });
    save();
    // after save();
    selectedSite[med] = null;
    document
      .querySelectorAll(`#bodymap-${med} .site-hotspot`)
      .forEach((h) => h.classList.remove("site-selected"));

    // repaint so the just-used zone turns red
    renderHistory(med);
    renderBodymap(med);
    renderZoneOptions(med);
  }
  if (btn.dataset.action === "ics") {
    createICSFor(med);
  }
  if (btn.dataset.action === "clearHistory") {
    exportHistoryCSV(med);
    if (confirm(`Clear all ${med} history?`)) {
      state[med].history = [];
      save();
      renderHistory(med);
      renderBodymap(med);
      renderZoneOptions(med);
    }
  }
  if (btn.dataset.action === "exportHistory") {
    exportHistoryCSV(med);
  }
});

document.body.addEventListener("change", (e) => {
  if (e.target.dataset.action === "importHistory") {
    const med = e.target.dataset.med;
    const file = e.target.files[0];
    if (file) importHistoryCSV(med, file);
  }
});

function createICSFor(med) {
  const m = state[med];
  if (!m.start) {
    alert("Please set a start date.");
    return;
  }
  const DAY = 24 * 60 * 60 * 1000;
  function addWeeks(date, w) {
    return new Date(date.getTime() + w * 7 * DAY);
  }
  const start = new Date(m.start);
  const now = new Date();
  const oneYear = new Date(
    now.getFullYear() + 1,
    now.getMonth(),
    now.getDate()
  );
  let cur = new Date(start);
  const occurrences = [];

  // collect ALL from start date through one year ahead
  while (cur <= oneYear) {
    if (cur >= start) {
      occurrences.push(new Date(cur));
    }
    cur = addWeeks(cur, m.interval);
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Injection Tracker//EN",
  ];
  for (const d of occurrences) {
    const toICS = (dt) =>
      dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    lines.push("BEGIN:VEVENT");
    const uid =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `uid-${med}-${toICS(d)}-${Math.random().toString(16).slice(2)}`;
    lines.push("UID:" + uid);
    lines.push("DTSTAMP:" + toICS(new Date()));
    lines.push("DTSTART:" + toICS(d));
    lines.push("DTEND:" + toICS(new Date(d.getTime() + 10 * 60000)));
    lines.push(
      "SUMMARY:" +
        (med == "skyrizi" ? "Skyrizi injection" : "Repatha injection") +
        (m.dose ? ` — ${m.dose}` : "")
    );
    lines.push("BEGIN:VALARM");
    lines.push("TRIGGER:-PT1440M");
    lines.push("ACTION:DISPLAY");
    lines.push("DESCRIPTION:Injection Reminder");
    lines.push("END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${med}-schedule.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById("skyrizi-start").addEventListener("change", (e) => {
  state.skyrizi.start = e.target.value;
  save();
});
document.getElementById("repatha-start").addEventListener("change", (e) => {
  state.repatha.start = e.target.value;
  save();
});

// 👇 wrap like this:
function initAfterImages() {
  renderHistory("skyrizi");
  renderHistory("repatha");

  renderZoneOptions("skyrizi");
  renderZoneOptions("repatha");

  renderBodymap("skyrizi");
  renderBodymap("repatha");

  document.getElementById("skyrizi-start").value = state.skyrizi.start || "";
  document.getElementById("repatha-start").value = state.repatha.start || "";

  // After first paint, check for ambiguous data stored previously
  setTimeout(() => AmbigUI.resolveAll(), 0);
}

// Wait for all body images to finish loading
window.addEventListener("load", initAfterImages);
