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
const SCHEMA_VERSION = 5; // single-injection schema

const SVG_NS = "http://www.w3.org/2000/svg";
const LABEL_POS_KEY = "inj-label-pos-v1";
const SITE_ARROW_MARKER_ID = "site-connector-arrowhead";
let labelPositions = loadLabelPositions();

const LEGACY_ZONES = {
  skyrizi: [
    "Right Arm",
    "Left Arm",
    "Left Stomach",
    "Right Stomach",
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
    "Left Stomach",
    "Right Stomach",
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

const ALL_ZONES = [...LEGACY_ZONES.skyrizi];

const bodyHotspots = [
  {
    site: "Right Arm",
    top: "18%",
    left: "30%",
    width: "10%",
    height: "11%",
  },
  {
    site: "Left Arm",
    top: "18%",
    left: "59%",
    width: "10%",
    height: "11%",
  },
  {
    site: "Right Stomach",
    top: "32%",
    left: "40%",
    width: "10%",
    height: "8%",
  },
  {
    site: "Left Stomach",
    top: "32%",
    left: "50%",
    width: "10%",
    height: "8%",
  },
  {
    site: "Right Thigh - Upper Outer",
    top: "45%",
    left: "36%",
    width: "7%",
    height: "6%",
  },
  {
    site: "Right Thigh - Middle Outer",
    top: "50%",
    left: "36%",
    width: "7%",
    height: "6%",
  },
  {
    site: "Right Thigh - Lower Outer",
    top: "55%",
    left: "36%",
    width: "7%",
    height: "6%",
  },
  {
    site: "Right Thigh - Upper Inner",
    top: "45%",
    left: "43%",
    width: "7%",
    height: "6%",
  },
  {
    site: "Right Thigh - Middle Inner",
    top: "50%",
    left: "43%",
    width: "7%",
    height: "6%",
  },
  {
    site: "Right Thigh - Lower Inner",
    top: "55%",
    left: "43%",
    width: "7%",
    height: "6%",
  },
  {
    site: "Left Thigh - Upper Outer",
    top: "45%",
    left: "57%",
    width: "7%",
    height: "6%",
  },
  {
    site: "Left Thigh - Middle Outer",
    top: "50%",
    left: "57%",
    width: "7%",
    height: "6%",
  },
  {
    site: "Left Thigh - Lower Outer",
    top: "55%",
    left: "57%",
    width: "7%",
    height: "6%",
  },
  {
    site: "Left Thigh - Upper Inner",
    top: "45%",
    left: "50%",
    width: "7%",
    height: "6%",
  },
  {
    site: "Left Thigh - Middle Inner",
    top: "50%",
    left: "50%",
    width: "7%",
    height: "6%",
  },
  {
    site: "Left Thigh - Lower Inner",
    top: "55%",
    left: "50%",
    width: "7%",
    height: "6%",
  },
];

const arr = (v) => (Array.isArray(v) ? v : []);
const num = (v, f = 0) => (typeof v === "number" && Number.isFinite(v) ? v : f);
const str = (v, f = "") => (typeof v === "string" ? v : f);

function normalizeEntry(entry) {
  const ts = Number(entry?.ts);
  return {
    ts: Number.isFinite(ts) ? ts : Date.now(),
    site: str(entry?.site),
    dose: str(entry?.dose),
  };
}

function normalizeState(state) {
  if (!state || typeof state !== "object") state = {};
  const inj = state.injection || {};
  inj.start = inj.start || null;
  inj.interval = num(inj.interval, 8);
  if (inj.interval <= 0) inj.interval = 8;
  inj.dose = str(inj.dose);
  inj.history = arr(inj.history).map(normalizeEntry).sort((a, b) => a.ts - b.ts);
  const zones = arr(inj.zones).filter((z) => ALL_ZONES.includes(z));
  inj.zones = zones.length ? zones : [...ALL_ZONES];
  state.injection = inj;
  state.__v = SCHEMA_VERSION;
  return state;
}

function legacyNormalize(raw) {
  const result = {};
  for (const med of Object.keys(LEGACY_ZONES)) {
    const source = raw && typeof raw === "object" ? raw[med] : undefined;
    const defaults = {
      start: null,
      interval: med === "skyrizi" ? 8 : 2,
      dose: "",
      history: [],
      zones: [...LEGACY_ZONES[med]],
    };
    const zones = arr(source?.zones).filter((z) => LEGACY_ZONES[med].includes(z));
    result[med] = {
      start: source?.start ?? defaults.start,
      interval: num(source?.interval, defaults.interval) || defaults.interval,
      dose: str(source?.dose, defaults.dose),
      history: arr(source?.history).map(normalizeEntry),
      zones: zones.length ? zones : defaults.zones,
    };
  }
  return result;
}

function convertLegacy(raw) {
  const legacy = legacyNormalize(raw);
  const combinedHistory = [...legacy.skyrizi.history, ...legacy.repatha.history]
    .map(normalizeEntry)
    .sort((a, b) => a.ts - b.ts);
  const zoneSet = new Set([
    ...legacy.skyrizi.zones,
    ...legacy.repatha.zones,
  ].filter((z) => ALL_ZONES.includes(z)));
  if (!zoneSet.size) {
    ALL_ZONES.forEach((z) => zoneSet.add(z));
  }
  const start = legacy.skyrizi.start || legacy.repatha.start || null;
  const interval = legacy.skyrizi.interval || legacy.repatha.interval || 8;
  const dose = legacy.skyrizi.dose || legacy.repatha.dose || "";
  return normalizeState({
    injection: {
      start,
      interval,
      dose,
      history: combinedHistory,
      zones: [...zoneSet],
    },
    __v: SCHEMA_VERSION,
  });
}

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
    if (state && typeof state === "object" && state.injection) {
      return normalizeState(state);
    }
    return convertLegacy(state || {});
  }

  function load() {
    const raw = readRaw(key);
    let state = raw ? parse(raw) : null;

    if (!state || typeof state !== "object") {
      const bak = parse(readRaw(key + ".bak"));
      state = bak && typeof bak === "object" ? bak : null;
    }

    if (!state) {
      state = normalizeState({ injection: { history: [], zones: [...ALL_ZONES] } });
    }

    writeRaw(key + ".bak", JSON.stringify(state));

    const upgraded = upgrade(state);
    writeRaw(key, JSON.stringify(upgraded));
    return upgraded;
  }

  function save(next) {
    const current = readRaw(key);
    if (current) writeRaw(key + ".bak", current);
    const normalized = normalizeState({ ...next });
    writeRaw(key, JSON.stringify(normalized));
    return normalized;
  }

  return { load, save };
}

const STORE = createStore();
let state = STORE.load();
function save() {
  state = STORE.save(state);
}

let selectedSite = null;

const AmbigUI = (() => {
  const root = document.getElementById("ambig-modal");
  const labelEl = document.getElementById("ambig-label");
  const selectEl = document.getElementById("ambig-select");
  const applyAllEl = document.getElementById("ambig-apply-all");
  const btnSave = document.getElementById("ambig-save");
  const btnSkip = document.getElementById("ambig-skip");

  let queue = [];
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
      renderHistory();
      renderBodymap();
      renderZoneOptions();
      save();
      return;
    }

    const { label } = current;
    labelEl.textContent = label;

    selectEl.innerHTML = "";
    suggestedSubzones(label).forEach((z) => {
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
    const { label, indexes } = current;

    if (applyAllEl.checked) {
      state.injection.history.forEach((h) => {
        if (h.site === label) h.site = choice;
      });
    } else {
      const i = indexes.shift();
      if (typeof i === "number") state.injection.history[i].site = choice;
      if (indexes.length) queue.unshift({ label, indexes });
    }

    loadNext();
  });

  btnSkip.addEventListener("click", () => {
    loadNext();
  });

  return {
    resolve() {
      const amb = findAmbiguities();
      if (!amb.length) return;
      const groups = new Map();
      amb.forEach(({ index, site }) => {
        if (!groups.has(site)) groups.set(site, []);
        groups.get(site).push(index);
      });
      groups.forEach((indexes, label) => {
        queue.push({ label, indexes });
      });
      if (queue.length && !current) loadNext();
    },
  };
})();

function isValidZone(site) {
  const enabled = state?.injection?.zones || [];
  return enabled.includes(site) || ALL_ZONES.includes(site);
}

function suggestedSubzones(label) {
  const zones = ALL_ZONES;
  const lower = String(label || "").toLowerCase();
  if (lower.includes("right thigh")) return zones.filter((z) => /Right Thigh/.test(z));
  if (lower.includes("left thigh")) return zones.filter((z) => /Left Thigh/.test(z));
  if (lower.includes("thigh")) return zones.filter((z) => /Thigh/.test(z));
  if (lower.includes("arm")) return zones.filter((z) => /Arm/.test(z));
  if (lower.includes("stomach")) return zones.filter((z) => /Stomach/.test(z));
  return zones.slice();
}

function findAmbiguities() {
  const hist = Array.isArray(state?.injection?.history) ? state.injection.history : [];
  const bad = [];
  for (let i = 0; i < hist.length; i++) {
    const h = hist[i];
    if (!h || !h.site) continue;
    if (!isValidZone(h.site)) {
      bad.push({ index: i, site: h.site });
    }
  }
  return bad;
}

function formatShortDate(ts) {
  if (!ts) return "—";
  let str = new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return str.replace(/^([A-Za-z]{3}) /, "$1. ");
}

function latestBySite() {
  const latest = new Map();
  const hist = Array.isArray(state?.injection?.history) ? state.injection.history : [];
  const sorted = hist.slice().sort((a, b) => b.ts - a.ts);
  for (const h of sorted) {
    if (!h.site) continue;
    if (!latest.has(h.site)) latest.set(h.site, h.ts);
  }
  return latest;
}

function chooseTagPosition(hotspotEl) {
  const container = hotspotEl.closest("#bodymap") || hotspotEl.parentElement;
  const c = container.getBoundingClientRect();
  const r = hotspotEl.getBoundingClientRect();
  const topSpace = r.top - c.top;
  const rightSpace = c.right - r.right;
  const bottomSpace = c.bottom - r.bottom;
  const leftSpace = r.left - c.left;
  if (topSpace > 22) return "top";
  if (rightSpace > 60) return "right";
  if (bottomSpace > 22) return "bottom";
  return "left";
}

function loadLabelPositions() {
  try {
    const stored = STORAGE.getItem(LABEL_POS_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch (err) {
    console.warn("Failed to read stored label positions", err);
  }
  return {};
}

function persistLabelPositions() {
  try {
    STORAGE.setItem(LABEL_POS_KEY, JSON.stringify(labelPositions));
  } catch (err) {
    console.warn("Failed to persist label positions", err);
  }
}

function getStoredLabelPosition(site, container) {
  if (!site || !container) return null;
  const stored = labelPositions?.[site];
  if (!stored || typeof stored.x !== "number" || typeof stored.y !== "number") {
    return null;
  }
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  return { left: stored.x * width, top: stored.y * height };
}

function setStoredLabelPosition(site, left, top, container) {
  if (!site || !container) return;
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  labelPositions[site] = {
    x: left / width,
    y: top / height,
  };
  persistLabelPositions();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function placeTagWithinBounds(tag, desiredLeft, desiredTop, container) {
  const maxLeft = Math.max(0, container.clientWidth - tag.offsetWidth);
  const maxTop = Math.max(0, container.clientHeight - tag.offsetHeight);
  const left = clamp(desiredLeft, 0, maxLeft);
  const top = clamp(desiredTop, 0, maxTop);
  tag.style.left = left + "px";
  tag.style.top = top + "px";
  return { left, top };
}

function defaultLabelCoords(hotspotEl, container, tag) {
  const cRect = container.getBoundingClientRect();
  const hRect = hotspotEl.getBoundingClientRect();
  const tagWidth = tag.offsetWidth;
  const tagHeight = tag.offsetHeight;
  const centerX = hRect.left - cRect.left + hRect.width / 2;
  const centerY = hRect.top - cRect.top + hRect.height / 2;
  const offset = 12;
  const pos = chooseTagPosition(hotspotEl);
  let left = centerX - tagWidth / 2;
  let top = centerY - tagHeight / 2;
  if (pos === "top") {
    top = hRect.top - cRect.top - tagHeight - offset;
  } else if (pos === "bottom") {
    top = hRect.bottom - cRect.top + offset;
  } else if (pos === "left") {
    left = hRect.left - cRect.left - tagWidth - offset;
  } else if (pos === "right") {
    left = hRect.right - cRect.left + offset;
  }
  return { left, top };
}

function createConnectorLayer(container) {
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("site-connector-layer");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");

  const defs = document.createElementNS(SVG_NS, "defs");
  const marker = document.createElementNS(SVG_NS, "marker");
  marker.setAttribute("id", SITE_ARROW_MARKER_ID);
  marker.setAttribute("markerWidth", "6");
  marker.setAttribute("markerHeight", "6");
  marker.setAttribute("refX", "5.5");
  marker.setAttribute("refY", "3");
  marker.setAttribute("orient", "auto");
  const markerPath = document.createElementNS(SVG_NS, "path");
  markerPath.setAttribute("d", "M0,0 L6,3 L0,6 Z");
  markerPath.setAttribute("fill", "#f4b6ce");
  marker.appendChild(markerPath);
  defs.appendChild(marker);
  svg.appendChild(defs);
  container.appendChild(svg);
  return svg;
}

function updateConnectorLine(line, hotspot, container, tag) {
  if (!line || !hotspot || !container || !tag) return;
  const cRect = container.getBoundingClientRect();
  const hRect = hotspot.getBoundingClientRect();
  const tagRect = tag.getBoundingClientRect();
  const startX = hRect.left - cRect.left + hRect.width / 2;
  const startY = hRect.top - cRect.top + hRect.height / 2;
  const endX = tagRect.left - cRect.left + tagRect.width / 2;
  const endY = tagRect.top - cRect.top + tagRect.height / 2;
  line.setAttribute("x1", startX);
  line.setAttribute("y1", startY);
  line.setAttribute("x2", endX);
  line.setAttribute("y2", endY);
}

function positionTagAndConnector(tag, line, container, hotspot, site) {
  const stored = getStoredLabelPosition(site, container);
  const coords = stored || defaultLabelCoords(hotspot, container, tag);
  placeTagWithinBounds(tag, coords.left, coords.top, container);
  tag.style.visibility = "";
  updateConnectorLine(line, hotspot, container, tag);
}

function enableTagDragging(tag, line, container, hotspot, site) {
  let pointerId = null;
  let offsetX = 0;
  let offsetY = 0;

  tag.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    pointerId = ev.pointerId;
    tag.setPointerCapture(pointerId);
    tag.classList.add("dragging");
    const rect = tag.getBoundingClientRect();
    offsetX = ev.clientX - rect.left;
    offsetY = ev.clientY - rect.top;
  });

  tag.addEventListener("pointermove", (ev) => {
    if (pointerId !== ev.pointerId) return;
    const containerRect = container.getBoundingClientRect();
    const desiredLeft = ev.clientX - containerRect.left - offsetX;
    const desiredTop = ev.clientY - containerRect.top - offsetY;
    const placed = placeTagWithinBounds(tag, desiredLeft, desiredTop, container);
    updateConnectorLine(line, hotspot, container, tag);
    setStoredLabelPosition(site, placed.left, placed.top, container);
  });

  const endDrag = (ev) => {
    if (pointerId === null || ev.pointerId !== pointerId) return;
    tag.releasePointerCapture(pointerId);
    pointerId = null;
    tag.classList.remove("dragging");
  };

  tag.addEventListener("pointerup", endDrag);
  tag.addEventListener("pointercancel", endDrag);
}

function ensureOutlineFor(hotspotEl) {
  const site = hotspotEl.dataset.site;
  const container = hotspotEl.closest("#bodymap");
  let outline = container.querySelector(`.site-outline[data-for="${site}"]`);
  if (!outline) {
    outline = document.createElement("div");
    outline.className = "site-outline";
    outline.dataset.for = site;
    container.appendChild(outline);
  }
  return outline;
}

function positionOutline(hotspotEl, outlineEl) {
  const container = hotspotEl.closest("#bodymap");
  const cRect = container.getBoundingClientRect();
  const hRect = hotspotEl.getBoundingClientRect();
  const centerX = hRect.left - cRect.left + hRect.width / 2;
  const centerY = hRect.top - cRect.top + hRect.height / 2;
  const base = Math.max(hRect.width, hRect.height);
  const diameter = Math.round(base * 0.6);
  outlineEl.style.left = centerX + "px";
  outlineEl.style.top = centerY + "px";
  outlineEl.style.width = diameter + "px";
  outlineEl.style.height = diameter + "px";
}

function cleanupOutlines(container) {
  const outlines = container.querySelectorAll(".site-outline");
  outlines.forEach((o) => {
    const site = o.getAttribute("data-for");
    const hotspot = container.querySelector(`.site-hotspot[data-site="${site}"]`);
    if (!hotspot || hotspot.style.display === "none") {
      o.remove();
    }
  });
}

function createZoneToggle(container, zone) {
  const wrapper = document.createElement("label");
  wrapper.className = "flex items-center gap-3 cursor-pointer select-none";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "sr-only peer";
  input.checked = state.injection.zones.includes(zone);

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
      if (!state.injection.zones.includes(zone)) {
        state.injection.zones.push(zone);
      }
    } else {
      state.injection.zones = state.injection.zones.filter((z) => z !== zone);
    }
    if (!state.injection.zones.includes(selectedSite)) {
      selectedSite = null;
    }
    save();
    renderBodymap();
    renderHistory();
  });

  wrapper.appendChild(input);
  wrapper.appendChild(slider);
  wrapper.appendChild(label);
  container.appendChild(wrapper);
}

function renderZoneOptions() {
  const container = document.getElementById("zone-options");
  const prevThigh = container.querySelector(".thigh-container");
  const wasOpen = prevThigh ? !prevThigh.classList.contains("hidden") : false;
  container.innerHTML = "";

  const thighZones = ALL_ZONES.filter((z) => z.includes("Thigh"));
  const nonThighZones = ALL_ZONES.filter((z) => !z.includes("Thigh"));

  nonThighZones.forEach((zone) => {
    createZoneToggle(container, zone);
  });

  const thighWrapper = document.createElement("div");
  thighWrapper.className = "mt-2 col-span-2";

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
  thighContainer.className = "thigh-container hidden flex flex-wrap gap-2 mt-2 animate-fadeIn";
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

  thighContainer.addEventListener("click", () => {
    if (!thighContainer.classList.contains("hidden")) scheduleAutoClose();
  });

  thighZones.forEach((zone) => {
    createZoneToggle(thighContainer, zone);
  });

  thighWrapper.appendChild(toggleBtn);
  thighWrapper.appendChild(thighContainer);
  container.appendChild(thighWrapper);

  if (wasOpen) {
    thighContainer.classList.remove("hidden");
    scheduleAutoClose();
  }
}

function computeUsedZones() {
  const enabled = state?.injection?.zones ?? [];
  if (enabled.length === 0) {
    return { usedSet: new Set(), oldestAvailable: null, fullCycle: false };
  }
  const hist = (Array.isArray(state?.injection?.history) ? state.injection.history : [])
    .slice()
    .sort((a, b) => b.ts - a.ts);
  const usedSet = new Set();
  let fullCycle = false;
  for (const entry of hist) {
    if (!entry.site || !enabled.includes(entry.site)) continue;
    usedSet.add(entry.site);
    if (usedSet.size === enabled.length) {
      fullCycle = true;
      break;
    }
  }

  let oldestAvailable = null;
  if (fullCycle) {
    const seen = new Set();
    for (const entry of hist) {
      if (!entry.site || !enabled.includes(entry.site)) continue;
      if (!seen.has(entry.site)) {
        seen.add(entry.site);
        oldestAvailable = entry.site;
      }
      if (seen.size === enabled.length) break;
    }
  }
  return { usedSet, oldestAvailable, fullCycle };
}

function renderBodymap() {
  const container = document.getElementById("bodymap");
  if (!container) return;

  container
    .querySelectorAll(
      ".site-hotspot, .site-outline, .site-tag, .site-callout, .site-dot, .site-connector-layer"
    )
    .forEach((el) => el.remove());

  const enabled = state.injection.zones || [];
  const { usedSet } = computeUsedZones();
  const latest = latestBySite();
  if (selectedSite && !enabled.includes(selectedSite)) {
    selectedSite = null;
  }

  const connectorLayer = createConnectorLayer(container);

  bodyHotspots.forEach((cfg) => {
    const hotspot = document.createElement("div");
    hotspot.className = "site-hotspot";
    hotspot.dataset.site = cfg.site;
    hotspot.title = cfg.site;
    hotspot.style.top = cfg.top;
    hotspot.style.left = cfg.left;
    hotspot.style.width = cfg.width;
    hotspot.style.height = cfg.height;

    const visible = enabled.includes(cfg.site);
    hotspot.style.display = visible ? "block" : "none";

    container.appendChild(hotspot);

    if (!visible) {
      return;
    }

    const outline = ensureOutlineFor(hotspot);
    positionOutline(hotspot, outline);
    outline.classList.add("visible");

    hotspot.addEventListener("mouseenter", () => outline.classList.add("accent"));
    hotspot.addEventListener("mouseleave", () => outline.classList.remove("accent"));
    hotspot.addEventListener("click", () => {
      outline.classList.add("accent");
      setTimeout(() => outline.classList.remove("accent"), 400);
    });

    if (selectedSite === cfg.site) {
      hotspot.classList.add("site-selected");
    }

    if (usedSet.has(cfg.site)) {
      hotspot.classList.add("site-used");
      hotspot.title = `${cfg.site} — used this rotation`;

      const dot = document.createElement("div");
      dot.className = "site-dot";
      hotspot.appendChild(dot);

      const ts = latest.get(cfg.site);
      if (ts) {
        const tag = document.createElement("div");
        tag.className = "site-tag";
        tag.textContent = formatShortDate(ts);
        tag.style.visibility = "hidden";
        tag.dataset.site = cfg.site;
        container.appendChild(tag);

        const line = document.createElementNS(SVG_NS, "line");
        line.classList.add("site-connector-line");
        line.setAttribute("marker-end", `url(#${SITE_ARROW_MARKER_ID})`);
        connectorLayer.appendChild(line);

        positionTagAndConnector(tag, line, container, hotspot, cfg.site);
        enableTagDragging(tag, line, container, hotspot, cfg.site);
      }
    }
  });

  cleanupOutlines(container);
}

window.addEventListener("resize", () => {
  renderBodymap();
});

function formatFullDate(ts) {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function renderHistory() {
  const container = document.getElementById("history");
  container.className = "mt-3 space-y-4 relative border-l border-slate-200 pl-4 text-sm list-none";
  container.innerHTML = "";

  const history = [...state.injection.history].sort((a, b) => b.ts - a.ts);

  history.forEach((h) => {
    const li = document.createElement("li");
    li.className = "relative";

    li.innerHTML = `
      <div class="absolute -left-7 top-1 w-3 h-3 bg-rose-500 rounded-full border border-white"></div>
      <p class="font-medium text-slate-700">${formatFullDate(h.ts)} — ${h.site || ""}</p>
      ${h.dose ? `<p class="text-xs text-slate-500">${h.dose}</p>` : ""}
    `;

    container.appendChild(li);
  });
}

function exportHistoryCSV() {
  const rows = [["Date", "Site", "Dose"]];
  state.injection.history.forEach((h) => {
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
  a.download = `injection-history.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function importHistoryCSV(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const text = e.target.result.trim();
    if (!text) return;
    const lines = text.split(/\r?\n/);

    let headers = lines[0].split(",");
    let hasHeader = ["Date", "Site", "Dose"].every((h) => headers.includes(h));

    const rows = hasHeader ? lines.slice(1) : lines;

    const data = rows
      .map((line) => {
        if (!line.trim()) return null;
        const parts = line.split(",");
        let [date, site, dose] = parts;
        let ts = Date.parse(`${date}T00:00:00Z`);
        if (isNaN(ts)) {
          const m = date.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
          if (m) {
            const [_, d, mo, y] = m;
            ts = Date.parse(`${y.length === 2 ? "20" + y : y}-${mo}-${d}T00:00:00Z`);
          }
        }
        return { ts: ts || Date.now(), site: site || "", dose: dose || "" };
      })
      .filter(Boolean);

    const existingDates = state.injection.history.map((h) => new Date(h.ts).toDateString());
    data.forEach((entry) => {
      const entryDate = new Date(entry.ts).toDateString();
      if (!existingDates.includes(entryDate)) {
        state.injection.history.push(entry);
      }
    });

    state.injection.history.sort((a, b) => a.ts - b.ts);
    save();
    renderHistory();
    renderBodymap();
    renderZoneOptions();

    AmbigUI.resolve();

    alert(`✅ History merged from CSV (old format handled).`);
  };
  reader.readAsText(file);
}

document.body.addEventListener("click", (e) => {
  const hotspot = e.target.closest(".site-hotspot");
  if (hotspot) {
    const mapContainer = document.getElementById("bodymap");
    if (mapContainer) {
      mapContainer
        .querySelectorAll(".site-hotspot")
        .forEach((h) => h.classList.remove("site-selected"));
    }
    hotspot.classList.add("site-selected");
    selectedSite = hotspot.dataset.site;
  }

  const btn = e.target.closest("button");
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === "logNow") {
    if (!selectedSite) {
      alert("⚠️ Please select an injection site before logging.");
      return;
    }
    const today = new Date().toDateString();
    if (state.injection.history.some((h) => new Date(h.ts).toDateString() === today)) {
      if (!confirm("⚠️ You already logged an injection today. Log another one anyway?")) {
        return;
      }
    }

    state.injection.history.push({
      ts: Date.now(),
      site: selectedSite,
      dose: state.injection.dose || "",
    });
    save();
    selectedSite = null;
    const mapContainer = document.getElementById("bodymap");
    if (mapContainer) {
      mapContainer
        .querySelectorAll(".site-hotspot")
        .forEach((h) => h.classList.remove("site-selected"));
    }

    renderHistory();
    renderBodymap();
    renderZoneOptions();
  }
  if (action === "ics") {
    createICS();
  }
  if (action === "clearHistory") {
    exportHistoryCSV();
    if (confirm(`Clear all history?`)) {
      state.injection.history = [];
      save();
      renderHistory();
      renderBodymap();
      renderZoneOptions();
    }
  }
  if (action === "exportHistory") {
    exportHistoryCSV();
  }
});

document.body.addEventListener("change", (e) => {
  if (e.target.dataset.action === "importHistory") {
    const file = e.target.files[0];
    e.target.value = "";
    if (file) importHistoryCSV(file);
  }
});

function createICS() {
  const m = state.injection;
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
  const oneYear = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  let cur = new Date(start);
  const occurrences = [];

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
    const toICS = (dt) => dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    lines.push("BEGIN:VEVENT");
    const uid =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `uid-injection-${toICS(d)}-${Math.random().toString(16).slice(2)}`;
    lines.push("UID:" + uid);
    lines.push("DTSTAMP:" + toICS(new Date()));
    lines.push("DTSTART:" + toICS(d));
    lines.push("DTEND:" + toICS(new Date(d.getTime() + 10 * 60000)));
    lines.push(
      "SUMMARY:Injection" + (m.dose ? ` — ${m.dose}` : "")
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
  a.download = `injection-schedule.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

const startInput = document.getElementById("start-date");
if (startInput) {
  startInput.addEventListener("change", (e) => {
    state.injection.start = e.target.value || null;
    save();
  });
}

function initAfterImages() {
  renderHistory();
  renderZoneOptions();
  renderBodymap();
  const startInput = document.getElementById("start-date");
  if (startInput) startInput.value = state.injection.start || "";
  setTimeout(() => AmbigUI.resolve(), 0);
}

window.addEventListener("load", initAfterImages);
