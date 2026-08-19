const API_BASE = "https://api.unsplash.com";
const PER_PAGE = 30;
const STORAGE_KEY = "versgenerator.unsplashKey";

// "water" alternates between these two search terms (see nextTermFor).
const WATER_TERMS = ["river", "ocean"];

export function getApiKey() {
  return localStorage.getItem(STORAGE_KEY) || "";
}

// A key that Unsplash has already told us is invalid (401). Cleared only
// when the key actually changes, so we don't keep burning requests on a key
// we already know is rejected.
let unauthorizedKey = null;

export function setApiKey(key) {
  const trimmed = key.trim();
  if (trimmed !== getApiKey()) unauthorizedKey = null;
  localStorage.setItem(STORAGE_KEY, trimmed);
}

// Each search term gets its own independent page/result cycle, so paging
// through "river" and "ocean" (alternated per call for source "water")
// doesn't clobber each other's position.
const cycles = new Map();
function cycleFor(term) {
  if (!cycles.has(term)) cycles.set(term, { results: [], index: -1, page: 0, totalPages: Infinity });
  return cycles.get(term);
}

let waterTurn = 0;

function nextTermFor(source) {
  if (source !== "water") return "mountain";
  const term = WATER_TERMS[waterTurn % WATER_TERMS.length];
  waterTurn += 1;
  return term;
}

async function fetchNextPage(term) {
  const key = getApiKey();
  if (!key) throw new Error("missing-key");
  if (key === unauthorizedKey) throw new Error("unauthorized");
  const cycle = cycleFor(term);
  if (cycle.page >= cycle.totalPages) cycle.page = 0; // wrap around once we've seen every page
  cycle.page += 1;
  const url = `${API_BASE}/search/photos?query=${term}&page=${cycle.page}&per_page=${PER_PAGE}`;
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
  if (res.status === 401) {
    unauthorizedKey = key;
    throw new Error("unauthorized");
  }
  // Unsplash returns 403 for a rate-limited demo app (50 req/hour).
  if (res.status === 403) throw new Error("rate-limited");
  if (!res.ok) throw new Error(`unsplash-error-${res.status}`);
  const data = await res.json();
  cycle.totalPages = data.total_pages || 1;
  cycle.results = cycle.results.concat(data.results);
  if (data.results.length === 0) throw new Error("no-results");
}

// Returns the next photo for the given source ("mountain" or "water" -
// water alternates its search term each call), fetching more results as
// needed. Photo shape: { url, downloadLocation, credit: {name, link} }
export async function nextPhoto(source) {
  const term = nextTermFor(source);
  const cycle = cycleFor(term);
  cycle.index += 1;
  if (cycle.index >= cycle.results.length) {
    await fetchNextPage(term);
  }
  const photo = cycle.results[cycle.index];
  if (!photo) throw new Error("no-results");

  // Unsplash API guidelines require pinging download_location when a photo
  // is put to use (not just displayed in search results).
  const key = getApiKey();
  fetch(`${photo.links.download_location}&client_id=${key}`).catch(() => {});

  return {
    url: photo.urls.full,
    downloadLocation: photo.links.download_location,
    credit: { name: photo.user.name, link: photo.user.links.html },
  };
}

export function resetCycle() {
  cycles.clear();
  waterTurn = 0;
}
