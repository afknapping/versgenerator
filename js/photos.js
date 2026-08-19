// Local, static photo sources - no API, no key. Each source ("mountain",
// "water") is a folder under data/ with a manifest.json listing its image
// files (regenerate with build-manifests.py after adding/removing photos).

// Unsplash's default download filename is "{name-slug}-{11-char-id}-unsplash.ext"
// (optionally with a Finder " (1)" duplicate suffix). When a file matches,
// derive a plain-text credit from the slug; no reliable profile URL can be
// recovered from the filename alone, so credit is text-only (no link).
const UNSPLASH_FILENAME_RE = /^(.+)-([A-Za-z0-9_-]{11})-unsplash(?:\s*\(\d+\))?\.(jpe?g|png|webp)$/i;

function creditFromFilename(filename) {
  const match = UNSPLASH_FILENAME_RE.exec(filename);
  if (!match) return null;
  const name = match[1].split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return { name, link: null };
}

const manifestCache = new Map();

async function loadManifest(source) {
  if (manifestCache.has(source)) return manifestCache.get(source);
  const res = await fetch(`data/${source}/manifest.json`);
  const files = res.ok ? await res.json() : [];
  manifestCache.set(source, files);
  return files;
}

function shuffle(array) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// One shuffled cycle per source, reshuffled (avoiding an immediate repeat
// of the last photo shown) once exhausted.
const cycles = new Map();

function ensureCycle(source, files) {
  let cycle = cycles.get(source);
  if (!cycle || cycle.pos >= cycle.order.length) {
    let order = shuffle(files.map((_, i) => i));
    const lastFile = cycle ? files[cycle.order[cycle.order.length - 1]] : null;
    if (order.length > 1 && files[order[0]] === lastFile) {
      [order[0], order[1]] = [order[1], order[0]];
    }
    cycle = { order, pos: 0 };
    cycles.set(source, cycle);
  }
  return cycle;
}

function photoAt(source, files, fileIndex) {
  const file = files[fileIndex];
  return {
    url: `data/${source}/${encodeURIComponent(file)}`,
    credit: creditFromFilename(file),
  };
}

// Returns the next photo for a source, cycling through every photo in its
// folder before repeating. If `preferFile` is given and this is the very
// first pick of a fresh cycle, that file is returned instead of whatever the
// shuffle landed on (used only for the fixed first photo a brand-new visitor
// sees - see main.js). Throws "no-results" if the folder is empty.
export async function nextPhoto(source, { preferFile } = {}) {
  const files = await loadManifest(source);
  if (files.length === 0) throw new Error("no-results");
  const cycle = ensureCycle(source, files);
  if (preferFile && cycle.pos === 0) {
    const preferIndex = files.indexOf(preferFile);
    const orderIndex = cycle.order.indexOf(preferIndex);
    if (orderIndex > 0) [cycle.order[0], cycle.order[orderIndex]] = [cycle.order[orderIndex], cycle.order[0]];
  }
  const photo = photoAt(source, files, cycle.order[cycle.pos]);
  cycle.pos += 1;
  return photo;
}

// Returns what nextPhoto(source) would return next, without consuming it -
// lets the caller start loading the image ahead of time. Null for an empty
// folder.
export async function peekNextPhoto(source) {
  const files = await loadManifest(source);
  if (files.length === 0) return null;
  const cycle = ensureCycle(source, files);
  return photoAt(source, files, cycle.order[cycle.pos]);
}
