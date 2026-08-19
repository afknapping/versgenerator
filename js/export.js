import { renderCard } from "./canvas.js";

// Target pixel size of the *smaller* edge of the exported image, and the
// JPEG quality to use, fixed regardless of the source photo's resolution -
// so text (drawn fresh at render time, not resized from a raster) is
// reliably sharp at a known size every time.
//
// "standard" is pinned to the iPhone 17's native portrait width (1206px @
// 460ppi) for guaranteed 1:1 crispness on a phone screen. "hd"/"4k" are the
// 16:9-only presets, named for the standard video resolutions they match
// (1080p / 2160p on the shorter edge).
export const EXPORT_PRESETS = {
  standard: { edgePx: 1206, quality: 0.75 },
  highres: { edgePx: 2400, quality: 1.0 },
  hd: { edgePx: 1080, quality: 0.75 },
  "4k": { edgePx: 2160, quality: 1.0 },
};

function targetCanvasSize(ratio, edgePx) {
  const smallerEdgeIsWidth = ratio.w <= ratio.h;
  if (smallerEdgeIsWidth) {
    return { width: edgePx, height: Math.round((edgePx * ratio.h) / ratio.w) };
  }
  return { width: Math.round((edgePx * ratio.w) / ratio.h), height: edgePx };
}

// Renders the card fresh at the target output size (not a resize of a fixed
// raster) so text stays crisp at every export size, then triggers a download.
export function saveCard(presetKey, ratio, params, fileNameBase) {
  const preset = EXPORT_PRESETS[presetKey];
  const { width, height } = targetCanvasSize(ratio, preset.edgePx);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  renderCard(ctx, width, height, params);

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileNameBase}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, "image/jpeg", preset.quality);
}
