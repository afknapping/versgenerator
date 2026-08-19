// Small SVG icons built as DOM elements, for toggle-group options that are
// constructed dynamically in JS (buildToggleGroup) rather than written as
// static markup in index.html. Same stroke style as the static icons there
// (viewBox 0 0 24 24, 14x14, stroke=currentColor).
const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

export function renderPhoneIcon() {
  const svg = svgEl("svg", {
    class: "icon-phone",
    viewBox: "0 0 24 24",
    width: "14",
    height: "14",
    "aria-hidden": "true",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  svg.appendChild(svgEl("rect", { x: "7", y: "2", width: "10", height: "20", rx: "2" }));
  svg.appendChild(svgEl("line", { x1: "10", y1: "19", x2: "14", y2: "19" }));
  return svg;
}

// Marks the currently-selected photo source as also being the "change
// picture" trigger (tapping it again cycles to a new photo) - the same
// circular-arrow glyph as a browser's reload button.
export function renderReloadIcon() {
  const svg = svgEl("svg", {
    class: "icon-reload",
    viewBox: "0 0 24 24",
    width: "14",
    height: "14",
    "aria-hidden": "true",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  svg.appendChild(svgEl("path", { d: "M21 12a9 9 0 1 1-9-9c2.52 0 4.85.99 6.57 2.61" }));
  svg.appendChild(svgEl("path", { d: "M21 3v6h-6" }));
  return svg;
}
