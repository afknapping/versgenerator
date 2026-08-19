import { parseReference, getVerseText, formatReferenceLabel, formatFileName, getSchlachterLabel } from "./bible.js";
import { nextPhoto, peekNextPhoto } from "./photos.js";
import { renderCard, ASPECT_RATIOS, THEME } from "./canvas.js";
import { saveCard } from "./export.js";

const PREVIEW_WIDTH = 640;
const DEFAULT_REFERENCE = "Matthäus 17:27";
const SETTINGS_KEY = "versgenerator.settings";
// Shown to a brand-new visitor with no saved photo yet - after that, whatever
// photo was last shown is persisted and restored as-is (see loadInitialPhoto).
const DEFAULT_MOUNTAIN_PHOTO = "neil-rosenstech-OxnhDqLcjU4-unsplash.jpg";

// Upload isn't working reliably yet - hidden from the UI (toggle option
// removed, drop zone/file-picker listeners not attached) but the
// implementation (handleUploadedFile, wireUpload, selectSource's "upload"
// handling) is left intact to pick back up later. Flip this back on once
// it's fixed.
const UPLOAD_ENABLED = false;

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

const saved = loadSettings();

const state = {
  ref: null,
  translation: saved.translation ?? "schlachter",
  verseText: "",
  refLabel: "",
  image: null,
  focalPoint: saved.focalPoint ?? { x: 50, y: 50 },
  zoom: saved.zoom ?? THEME.defaultZoom,
  bw: saved.bw ?? true,
  aspectKey: saved.aspectKey ?? "portrait",
  // "mountain" | "water" | "upload" - fall back to "mountain" if a
  // previous session persisted "upload" while it's disabled (see
  // UPLOAD_ENABLED above).
  imageSource: (!UPLOAD_ENABLED && saved.imageSource === "upload") ? "mountain" : (saved.imageSource ?? "mountain"),
  textTheme: saved.textTheme ?? "dark", // "light" = black text on white; "dark" = white text on black
  textScale: saved.textScale ?? THEME.defaultTextScale,
  stripeBottomRatio: saved.stripeBottomRatio ?? THEME.defaultStripeBottomRatio,
  photoCreditText: "",
  // The exact photo currently shown, persisted so a reload restores it
  // as-is - only "Change picture" (or switching source) picks a new one.
  photoUrl: saved.photoUrl ?? null,
  photoCredit: saved.photoCredit ?? null,
};

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    reference: el.refInput.value,
    translation: state.translation,
    aspectKey: state.aspectKey,
    bw: state.bw,
    imageSource: state.imageSource,
    textTheme: state.textTheme,
    zoom: state.zoom,
    textScale: state.textScale,
    stripeBottomRatio: state.stripeBottomRatio,
    focalPoint: state.focalPoint,
    photoUrl: state.photoUrl,
    photoCredit: state.photoCredit,
  }));
}

// Geometry of the last drawn stripe, used to hit-test drag gestures.
let lastLayout = null;

const el = {
  panelToggle: document.getElementById("panel-toggle"),
  panelContent: document.getElementById("panel-content"),
  refInput: document.getElementById("reference-input"),
  translationSelect: document.getElementById("translation-select"),
  refError: document.getElementById("reference-error"),
  changePicture: document.getElementById("change-picture"),
  filterButtons: document.getElementById("filter-buttons"),
  sourceButtons: document.getElementById("source-buttons"),
  uploadInput: document.getElementById("upload-input"),
  aspectButtons: document.getElementById("aspect-buttons"),
  textThemeButtons: document.getElementById("text-theme-buttons"),
  zoomSlider: document.getElementById("zoom-slider"),
  textSizeSlider: document.getElementById("text-size-slider"),
  photoError: document.getElementById("photo-error"),
  photoCredit: document.getElementById("photo-credit"),
  canvas: document.getElementById("preview-canvas"),
  saveStandardRow: document.getElementById("save-standard"),
  saveWideRow: document.getElementById("save-wide"),
  saveStandardBtn: document.getElementById("save-standard-btn"),
  saveHighresBtn: document.getElementById("save-highres-btn"),
  saveHdBtn: document.getElementById("save-hd-btn"),
  save4kBtn: document.getElementById("save-4k-btn"),
  gridOverlay: document.getElementById("grid-overlay"),
  side: document.querySelector(".side"),
};

const ctx = el.canvas.getContext("2d");

// Rule-of-thirds grid, shown while zooming/resizing text/dragging, fading
// out 1.5s after the interaction stops. Purely a DOM overlay - never drawn
// into the canvas, so it can never leak into an exported image. The control
// panel also goes very transparent while it's up, so it doesn't block the
// framing you're actively adjusting (mainly matters in overlay mode, where
// the panel sits on top of the photo).
const GRID_FADE_DELAY = 700;
let gridFadeTimer = null;
function showGrid() {
  el.gridOverlay.classList.add("visible");
  el.side.classList.add("dimmed");
  clearTimeout(gridFadeTimer);
  gridFadeTimer = setTimeout(() => {
    el.gridOverlay.classList.remove("visible");
    el.side.classList.remove("dimmed");
  }, GRID_FADE_DELAY);
}

function showError(node, message) {
  if (!message) {
    node.hidden = true;
    return;
  }
  node.textContent = message;
  node.hidden = false;
}

function currentRatio() {
  return ASPECT_RATIOS[state.aspectKey];
}

function resizePreviewCanvas() {
  const ratio = currentRatio();
  el.canvas.width = PREVIEW_WIDTH;
  el.canvas.height = Math.round((PREVIEW_WIDTH * ratio.h) / ratio.w);
}

function cardParams() {
  return {
    image: state.image,
    focalPoint: state.focalPoint,
    zoom: state.zoom,
    bw: state.bw,
    verseText: state.verseText,
    refLabel: state.refLabel,
    stripeOpacity: THEME.defaultStripeOpacity,
    textTheme: state.textTheme,
    textScale: state.textScale,
    stripeBottomRatio: state.stripeBottomRatio,
    credit: state.photoCreditText,
  };
}

function render() {
  if (!state.image || !state.verseText) return;
  lastLayout = renderCard(ctx, el.canvas.width, el.canvas.height, cardParams());
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// `credit` is { name, link } (link may be null - see photos.js) or null for
// a locally uploaded photo (no attribution to show). Builds both the DOM
// credit line and the plain-text watermark drawn onto the canvas.
async function applyPhoto(image, credit, { resetFraming = true } = {}) {
  state.image = image;
  if (resetFraming) {
    // A new photo has a different composition - start centered, full zoom.
    state.focalPoint = { x: 50, y: 50 };
    state.zoom = THEME.defaultZoom;
    el.zoomSlider.value = 100;
    saveSettings();
  }
  if (credit) {
    el.photoCredit.hidden = false;
    el.photoCredit.innerHTML = credit.link
      ? `Photo by <a href="${credit.link}" target="_blank" rel="noopener">${credit.name}</a> on Unsplash`
      : `Photo by ${credit.name} on Unsplash`;
    state.photoCreditText = `Photo: ${credit.name} — Unsplash`;
  } else {
    el.photoCredit.hidden = true;
    el.photoCredit.innerHTML = "";
    state.photoCreditText = "";
  }
  render();
}

// The next photo for a source, already decoding, so "Change picture" has no
// loading time - started right after the previous photo finishes applying.
const prefetched = new Map(); // source -> { url, credit, imagePromise }

function prefetchNext(source) {
  peekNextPhoto(source).then((photo) => {
    if (!photo) return;
    const imagePromise = loadImage(photo.url);
    imagePromise.catch(() => {}); // avoid an unhandled rejection if it's never consumed
    prefetched.set(source, { url: photo.url, credit: photo.credit, imagePromise });
  });
}

// Loads and applies a new random photo for the given source ("mountain" or
// "water"), used on first-ever visit, "Change picture", and switching
// sources. `preferFile`, if given, forces that specific file as the pick
// (only meaningful for the very first photo of a fresh cycle - see
// nextPhoto in photos.js).
async function loadPhotoForSource(source, { preferFile } = {}) {
  el.changePicture.disabled = true;
  try {
    const photo = await nextPhoto(source, { preferFile });
    const pre = prefetched.get(source);
    const image = pre && pre.url === photo.url ? await pre.imagePromise : await loadImage(photo.url);
    prefetched.delete(source);
    showError(el.photoError, "");
    state.photoUrl = photo.url;
    state.photoCredit = photo.credit;
    await applyPhoto(image, photo.credit);
    prefetchNext(source);
  } catch (err) {
    if (err.message === "no-results") {
      showError(el.photoError, `No ${source} photos yet - add some to data/${source}/ and rerun build-manifests.py.`);
    } else {
      showError(el.photoError, "Couldn't load that photo.");
    }
  } finally {
    el.changePicture.disabled = false;
  }
}

function loadNextPhoto() {
  return loadPhotoForSource(state.imageSource);
}

// Reloading the page should show whatever photo was left on, not a new
// random one - restores it as-is (framing included) and falls back to
// picking a fresh photo only if it no longer loads (e.g. file was removed).
async function restorePhoto(source, url, credit) {
  try {
    const image = await loadImage(url);
    showError(el.photoError, "");
    await applyPhoto(image, credit, { resetFraming: false });
    prefetchNext(source);
  } catch {
    loadPhotoForSource(source);
  }
}

async function updateVerse() {
  const input = el.refInput.value.trim();
  if (!input) {
    showError(el.refError, "");
    return;
  }
  const ref = parseReference(input);
  if (!ref) {
    showError(el.refError, "Couldn't parse that reference. Try e.g. \"John 3:16\".");
    return;
  }
  try {
    const text = await getVerseText(state.translation, ref);
    if (text == null) {
      showError(el.refError, "That verse doesn't exist in this translation.");
      return;
    }
    state.ref = ref;
    state.verseText = text;
    state.refLabel = formatReferenceLabel(ref, state.translation);
    showError(el.refError, "");
    if (state.translation === "schlachter") {
      // Reflects whichever edition actually loaded (2000 locally, 1951 on
      // the public deploy where 2000 is gitignored) once it's known.
      el.translationSelect.querySelector('option[value="schlachter"]').textContent = getSchlachterLabel();
    }
    render();
  } catch (err) {
    showError(el.refError, "Couldn't load Bible data.");
  }
}

// 16:9 gets its own HD/4K save buttons; every other ratio gets the
// standard/high-resolution pair.
function updateSaveRowVisibility() {
  const isWide = state.aspectKey === "wide";
  el.saveStandardRow.hidden = isWide;
  el.saveWideRow.hidden = !isWide;
}

// Builds a connected segmented toggle (same look for aspect ratio, text
// theme, and photo filter). `options` is [{ key, label, renderIcon? }].
// `renderIcon(option)`, if given, returns an element prepended to the label.
function buildToggleGroup(container, options, selectedKey, onSelect, renderIcon) {
  container.innerHTML = "";
  for (const opt of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.key = opt.key;
    button.setAttribute("aria-pressed", opt.key === selectedKey ? "true" : "false");
    if (renderIcon) button.appendChild(renderIcon(opt));
    button.appendChild(document.createTextNode(opt.label));
    button.addEventListener("click", () => {
      for (const b of container.children) {
        b.setAttribute("aria-pressed", b.dataset.key === opt.key ? "true" : "false");
      }
      onSelect(opt.key);
    });
    container.appendChild(button);
  }
}

// Deliberately not a uniform formula: 3:4 is the reference (height = BOX,
// width = SMALL); 4:3 is its transpose (same footprint, rotated); 1:1's
// side is SMALL (3:4's narrow edge); 16:9 keeps 3:4's *height* instead of
// fitting the same box, so it reads as visibly wider/larger than the rest.
const ASPECT_SWATCH_BOX = 12; // 3:4 height, 4:3 width
const ASPECT_SWATCH_SMALL = Math.round((ASPECT_SWATCH_BOX * 3) / 4); // 3:4 width, 4:3 height, 1:1 side

const ASPECT_SWATCH_SIZES = {
  portrait: { width: ASPECT_SWATCH_SMALL, height: ASPECT_SWATCH_BOX },
  square: { width: ASPECT_SWATCH_SMALL, height: ASPECT_SWATCH_SMALL },
  landscape: { width: ASPECT_SWATCH_BOX, height: ASPECT_SWATCH_SMALL },
  wide: { width: Math.round((ASPECT_SWATCH_BOX * 16) / 9), height: ASPECT_SWATCH_BOX },
};

function renderAspectSwatch(opt) {
  const { width, height } = ASPECT_SWATCH_SIZES[opt.key];
  const swatch = document.createElement("span");
  swatch.className = "aspect-swatch";
  swatch.style.width = `${width}px`;
  swatch.style.height = `${height}px`;
  swatch.setAttribute("aria-hidden", "true");
  return swatch;
}

function buildAspectButtons() {
  const options = Object.entries(ASPECT_RATIOS).map(([key, ratio]) => ({ key, label: ratio.label, ratio }));
  buildToggleGroup(el.aspectButtons, options, state.aspectKey, (key) => {
    // Preview/export width is held fixed per ratio, so canvas *height*
    // changes with the ratio - scale text to track that height change so
    // it keeps roughly the same relative size instead of the same textScale
    // looking bigger/smaller as the frame gets shorter/taller.
    const oldRatio = ASPECT_RATIOS[state.aspectKey];
    const newRatio = ASPECT_RATIOS[key];
    const heightFactor = (newRatio.h / newRatio.w) / (oldRatio.h / oldRatio.w);
    state.textScale = Math.min(THEME.maxTextScale, Math.max(THEME.minTextScale, state.textScale * heightFactor));
    el.textSizeSlider.value = Math.round(state.textScale * 100);

    state.aspectKey = key;
    resizePreviewCanvas();
    updateSaveRowVisibility();
    render();
    saveSettings();
  }, renderAspectSwatch);
}

function buildFilterButtons() {
  const options = [
    { key: "color", label: "Original" },
    { key: "bw", label: "Silvertone" },
  ];
  buildToggleGroup(el.filterButtons, options, state.bw ? "bw" : "color", (key) => {
    state.bw = key === "bw";
    render();
    saveSettings();
  });
}

// "upload" hides "Change picture" (there's nothing to cycle through) - the
// canvas itself becomes the drop target instead (see wireUpload).
function updateChangePictureVisibility() {
  el.changePicture.hidden = state.imageSource === "upload";
}

// Switches the active image source and syncs the toggle UI to match.
// `loadPhoto: false` is used right before loading a just-dropped file, so
// we don't fetch-then-immediately-discard a random "upload" photo (there
// isn't one).
function selectSource(key, { loadPhoto = true } = {}) {
  state.imageSource = key;
  for (const b of el.sourceButtons.children) {
    b.setAttribute("aria-pressed", b.dataset.key === key ? "true" : "false");
  }
  updateChangePictureVisibility();
  saveSettings();
  if (loadPhoto && key !== "upload") loadPhotoForSource(key);
}

function buildSourceButtons() {
  const options = [
    { key: "mountain", label: "Mountain" },
    { key: "water", label: "Water" },
  ];
  if (UPLOAD_ENABLED) options.push({ key: "upload", label: "Upload" });
  buildToggleGroup(el.sourceButtons, options, state.imageSource, (key) => {
    selectSource(key);
    // Clicking "Upload" also opens a file picker - drag-and-drop alone
    // isn't discoverable enough as the only way in.
    if (key === "upload") el.uploadInput.click();
  });
}

function buildTextThemeButtons() {
  const options = [
    { key: "light", label: "Black on white text" },
    { key: "dark", label: "White on black text" },
  ];
  buildToggleGroup(el.textThemeButtons, options, state.textTheme, (key) => {
    state.textTheme = key;
    render();
    saveSettings();
  });
}

// Converts a pointer client position to canvas-internal pixel coordinates
// (the canvas's on-screen CSS size can differ from its width/height attrs).
function canvasPoint(clientX, clientY) {
  const rect = el.canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * el.canvas.width,
    y: ((clientY - rect.top) / rect.height) * el.canvas.height,
  };
}

// Pixel size the image is currently drawn at (cover-fit x zoom), needed to
// convert a pointer-drag delta into a focalPoint delta for free panning.
function drawnImageSize() {
  const { image, zoom } = state;
  const coverScale = Math.max(el.canvas.width / image.naturalWidth, el.canvas.height / image.naturalHeight);
  const scale = coverScale * zoom;
  return { width: image.naturalWidth * scale, height: image.naturalHeight * scale };
}

function wireDrag() {
  // "stripe": dragging the text stripe up/down. "image": freely panning the photo.
  let dragMode = null;
  let grabOffsetY = 0; // stripe mode: pointerY - stripeY at drag start, in canvas px
  let lastPoint = null; // image mode: previous pointer position, for delta panning

  el.canvas.addEventListener("pointerdown", (e) => {
    if (!state.image) return;
    const point = canvasPoint(e.clientX, e.clientY);
    if (lastLayout && point.y >= lastLayout.stripeY && point.y <= lastLayout.stripeY + lastLayout.stripeHeight) {
      dragMode = "stripe";
      grabOffsetY = point.y - lastLayout.stripeY;
    } else {
      dragMode = "image";
      lastPoint = point;
    }
    el.canvas.setPointerCapture(e.pointerId);
    showGrid();
  });

  el.canvas.addEventListener("pointermove", (e) => {
    if (!dragMode) return;
    const point = canvasPoint(e.clientX, e.clientY);
    if (dragMode === "image") {
      panImage(point.x - lastPoint.x, point.y - lastPoint.y);
      lastPoint = point;
    } else if (dragMode === "stripe" && lastLayout) {
      const stripeY = point.y - grabOffsetY;
      const bottom = stripeY + lastLayout.stripeHeight;
      state.stripeBottomRatio = Math.min(1, Math.max(0, bottom / el.canvas.height));
    }
    showGrid();
    render();
  });

  // Moves the image by (dx, dy) canvas pixels, following the pointer 1:1 -
  // free dragging, not a jump-to-click. No-op on an axis with no pan slack
  // (image exactly fills that dimension).
  function panImage(dx, dy) {
    const { width: drawWidth, height: drawHeight } = drawnImageSize();
    const slackX = el.canvas.width - drawWidth; // <= 0
    const slackY = el.canvas.height - drawHeight; // <= 0
    const { x, y } = state.focalPoint;
    state.focalPoint = {
      x: slackX === 0 ? x : Math.min(100, Math.max(0, x + (dx / slackX) * 100)),
      y: slackY === 0 ? y : Math.min(100, Math.max(0, y + (dy / slackY) * 100)),
    };
  }

  el.canvas.addEventListener("pointerup", () => {
    if (dragMode) saveSettings();
    dragMode = null;
  });
  el.canvas.addEventListener("pointercancel", () => {
    dragMode = null;
  });
}

// Loads a local File as the card's photo: switches to "Upload" (no fallback
// fetch needed, we already have the image) and shows no attribution.
async function handleUploadedFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  selectSource("upload", { loadPhoto: false });
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    await applyPhoto(image, null);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// The canvas is *always* a stealth drop zone for a local image file - no
// visible affordance except a highlight while a file is actually being
// dragged over it, and no need to pre-select "Upload" first (dropping a
// file switches the source toggle to "Upload" itself). Clicking the
// "Upload" toggle button (wired in buildSourceButtons) opens a real file
// picker as the more discoverable alternative to drag-and-drop alone.
function wireUpload() {
  const isFileDrag = (e) => !!e.dataTransfer?.types.includes("Files");

  // Chrome requires preventDefault on dragenter *and* dragover for a drop
  // to be accepted; without it the browser's default action (navigating to
  // the file) wins over our "drop" listener.
  el.canvas.addEventListener("dragenter", (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
  });
  el.canvas.addEventListener("dragover", (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    el.canvas.classList.add("drop-active");
  });
  el.canvas.addEventListener("dragleave", () => {
    el.canvas.classList.remove("drop-active");
  });
  el.canvas.addEventListener("drop", async (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    el.canvas.classList.remove("drop-active");
    const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith("image/"));
    await handleUploadedFile(file);
  });

  el.uploadInput.addEventListener("change", async () => {
    await handleUploadedFile(el.uploadInput.files?.[0]);
    el.uploadInput.value = ""; // allow picking the same file again later
  });
}

function wireEvents() {
  el.panelToggle.addEventListener("click", () => {
    el.panelContent.hidden = !el.panelContent.hidden;
    el.panelToggle.textContent = el.panelContent.hidden ? "Show settings" : "Hide settings";
  });

  el.refInput.addEventListener("change", () => {
    updateVerse();
    saveSettings();
  });
  el.translationSelect.addEventListener("change", () => {
    state.translation = el.translationSelect.value;
    updateVerse();
    saveSettings();
  });

  el.changePicture.addEventListener("click", loadNextPhoto);

  el.zoomSlider.addEventListener("input", () => {
    state.zoom = Number(el.zoomSlider.value) / 100;
    showGrid();
    render();
    saveSettings();
  });

  el.textSizeSlider.addEventListener("input", () => {
    state.textScale = Number(el.textSizeSlider.value) / 100;
    showGrid();
    render();
    saveSettings();
  });

  const doSave = (presetKey) => {
    if (!state.image || !state.verseText || !state.ref) return;
    const fileNameBase = formatFileName(state.ref, state.translation, presetKey);
    saveCard(presetKey, currentRatio(), cardParams(), fileNameBase);
  };
  el.saveStandardBtn.addEventListener("click", () => doSave("standard"));
  el.saveHighresBtn.addEventListener("click", () => doSave("highres"));
  el.saveHdBtn.addEventListener("click", () => doSave("hd"));
  el.save4kBtn.addEventListener("click", () => doSave("4k"));
}

function loadInitialPhoto() {
  // "upload" has nothing to restore - wait for a dropped file.
  if (state.imageSource === "upload") return;
  if (state.photoUrl) return restorePhoto(state.imageSource, state.photoUrl, state.photoCredit);
  const preferFile = state.imageSource === "mountain" ? DEFAULT_MOUNTAIN_PHOTO : undefined;
  return loadPhotoForSource(state.imageSource, { preferFile });
}

// Canvas text doesn't wait for webfonts the way DOM text does - drawing
// before "Atkinson Hyperlegible Next" finishes loading silently falls back
// to the default sans-serif and never repaints once the font arrives. Force
// both weights we actually draw with to load before the first render.
async function ensureFontsLoaded() {
  if (!document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`${THEME.verseWeight} 16px ${THEME.fontFamily}`),
      document.fonts.load(`italic ${THEME.refWeight} 16px ${THEME.fontFamily}`),
    ]);
  } catch {
    // Font failed to load (offline, blocked, etc.) - fall back silently.
  }
}

async function init() {
  el.translationSelect.value = state.translation;
  el.zoomSlider.value = Math.round(state.zoom * 100);
  el.textSizeSlider.value = Math.round(state.textScale * 100);

  resizePreviewCanvas();
  buildAspectButtons();
  buildFilterButtons();
  buildSourceButtons();
  buildTextThemeButtons();
  updateSaveRowVisibility();
  updateChangePictureVisibility();
  wireDrag();
  if (UPLOAD_ENABLED) wireUpload();
  wireEvents();
  el.refInput.value = saved.reference ?? DEFAULT_REFERENCE;
  updateVerse();
  await ensureFontsLoaded();
  loadInitialPhoto();
}

init();
