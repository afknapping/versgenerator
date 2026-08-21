// Small SVG icons built as DOM elements, for toggle-group options that are
// constructed dynamically in JS (buildToggleGroup) rather than written as
// static markup in index.html. Same stroke style as the static icons there
// (viewBox 0 0 24 24, stroke=currentColor, 14px by default - pass `size` for
// the larger icon-only mobile toolbar buttons).
const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

function iconSvg(className, size) {
  return svgEl("svg", {
    class: className,
    viewBox: "0 0 24 24",
    width: String(size),
    height: String(size),
    "aria-hidden": "true",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
}

export function renderPhoneIcon(size = 14) {
  const svg = iconSvg("icon-phone", size);
  svg.appendChild(svgEl("rect", { x: "7", y: "2", width: "10", height: "20", rx: "2" }));
  svg.appendChild(svgEl("line", { x1: "10", y1: "19", x2: "14", y2: "19" }));
  return svg;
}

// Marks the currently-selected photo source as also being the "change
// picture" trigger (tapping it again cycles to a new photo) - the same
// circular-arrow glyph as a browser's reload button.
export function renderReloadIcon(size = 14) {
  const svg = iconSvg("icon-reload", size);
  svg.appendChild(svgEl("path", { d: "M21 12a9 9 0 1 1-9-9c2.52 0 4.85.99 6.57 2.61" }));
  svg.appendChild(svgEl("path", { d: "M21 3v6h-6" }));
  return svg;
}

export function renderMountainIcon(size = 16) {
  const svg = iconSvg("icon-mountain", size);
  svg.appendChild(svgEl("path", { d: "m3 19 6-10 4 6 2-3 6 7Z" }));
  return svg;
}

export function renderWaterDropIcon(size = 16) {
  const svg = iconSvg("icon-water", size);
  svg.appendChild(svgEl("path", { d: "M12 3s6 6.5 6 11a6 6 0 1 1-12 0c0-4.5 6-11 6-11Z" }));
  return svg;
}

// "Original" (unfiltered) - a small color wheel. The one deliberate break
// from the otherwise-monochrome icon set: a plain circle didn't read as
// "color" clearly enough next to Silvertone's half-filled circle, and
// legibility won out over strict consistency here.
export function renderColorWheelIcon(size = 16) {
  const span = document.createElement("span");
  span.className = "icon-color-wheel";
  span.style.width = `${size}px`;
  span.style.height = `${size}px`;
  span.setAttribute("aria-hidden", "true");
  return span;
}

// "Silvertone" - a circle with one half filled, the standard monochrome
// shorthand for a contrast/black-and-white effect.
export function renderHalfCircleIcon(size = 16) {
  const svg = iconSvg("icon-half-circle", size);
  svg.setAttribute("stroke-linejoin", "round");
  const path = svgEl("path", { d: "M12 4a8 8 0 0 1 0 16Z" });
  path.setAttribute("fill", "currentColor");
  path.setAttribute("stroke", "none");
  svg.appendChild(path);
  svg.appendChild(svgEl("circle", { cx: "12", cy: "12", r: "8" }));
  return svg;
}

export function renderMinusIcon(size = 16) {
  const svg = iconSvg("icon-minus", size);
  svg.appendChild(svgEl("line", { x1: "5", y1: "12", x2: "19", y2: "12" }));
  return svg;
}

export function renderPlusIcon(size = 16) {
  const svg = iconSvg("icon-plus", size);
  svg.appendChild(svgEl("line", { x1: "5", y1: "12", x2: "19", y2: "12" }));
  svg.appendChild(svgEl("line", { x1: "12", y1: "5", x2: "12", y2: "19" }));
  return svg;
}

export function renderChevronDownIcon(size = 14) {
  const svg = iconSvg("icon-chevron-down", size);
  svg.appendChild(svgEl("polyline", { points: "6 9 12 15 18 9" }));
  return svg;
}

// Matches the static download icon markup used elsewhere (16x16 viewBox,
// 1.4 stroke) - not routed through iconSvg(), whose 24x24 viewBox doesn't
// match these coordinates.
export function renderDownloadIcon(size = 14) {
  const svg = svgEl("svg", {
    class: "icon-download",
    viewBox: "0 0 16 16",
    width: String(size),
    height: String(size),
    "aria-hidden": "true",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.4",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  svg.appendChild(svgEl("path", { d: "M8 1v8m0 0L4.5 5.5M8 9l3.5-3.5M2 12.5h12" }));
  return svg;
}
