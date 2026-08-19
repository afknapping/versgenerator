// Single source of truth for the visual constants the original spec asked to
// keep easily adjustable. These drive both the live preview canvas and the
// export canvas (same draw function), so tweaking a number here changes both.
export const THEME = {
  verseWeight: 800,
  verseFontRatio: 0.048, // verse font size as a fraction of canvas width, at textScale 1
  verseLineHeightRatio: 1.3,
  refWeight: 300, // reference line font size matches the verse text (see refPx in computeLayout)
  refGapRatio: 0.03, // gap between verse block and reference line, as fraction of canvas width
  stripeSidePaddingRatio: 0.04, // horizontal text margin inside the stripe, as fraction of canvas width - independent of vertical padding
  // Wider than the general side padding above - real lock screens (at least
  // iOS) apply extra zoom beyond a plain cover-fit crop for the parallax
  // effect, cropping further into the sides than the aspect ratio alone
  // would suggest. Confirmed on-device: the default 4% wasn't enough and
  // text ran off the edge.
  wallpaperSidePaddingRatio: 0.1,
  stripeVerticalPaddingRatio: 0.03, // top/bottom padding inside the stripe, as fraction of canvas width - independent of side padding
  defaultStripeOpacity: 0.77,
  defaultZoom: 1,
  minZoom: 1,
  maxZoom: 3,
  defaultTextScale: 0.67, // slider thumb at one third along its min-max track
  minTextScale: 0.2,
  maxTextScale: 1.6,
  // Default stripe position: bottom of the image, with a small margin.
  defaultStripeBottomRatio: 0.94,
  // Phone wallpaper mode: keeps the stripe's bottom edge just above the
  // reserved shortcuts/nav-bar zone (see WALLPAPER_SAFE_ZONE) instead of the
  // near-bottom default above.
  wallpaperSafeStripeBottomRatio: 0.68,
  // Photo credit watermark: tiny, translucent, bottom-center of the image.
  creditFontRatio: 0.016,
  creditBottomMarginRatio: 0.016,
  creditOpacity: 0.55,
};

export const SILVERTONE_FILTER = "grayscale(0.9) contrast(1.15) brightness(1.08)";

// "Modern" is the app's original sans-serif; "classic" is the earmarked
// serif alternative for a more traditional look. Both need the same weight
// range loaded (see ensureFontsLoaded in main.js) since verse/reference text
// use extrabold/light regardless of which is active.
export const FONT_STACKS = {
  modern: { label: "Modern", fontFamily: '"Atkinson Hyperlegible Next", sans-serif' },
  classic: { label: "Classic", fontFamily: '"EB Garamond", serif' },
};

export const ASPECT_RATIOS = {
  portrait: { label: "3:4", w: 3, h: 4 },
  square: { label: "1:1", w: 1, h: 1 },
  landscape: { label: "4:3", w: 4, h: 3 },
  wide: { label: "16:9", w: 16, h: 9 },
  // Taller than any current mainstream phone (modern iPhones/Androids top
  // out around 19.5:9-21:9) so cover-fit is always width-constrained: full
  // width shows with no horizontal crop, and any overflow crops top/bottom
  // instead, which the reserved zones already guard against. On-device
  // testing found the opposite (a squarer ratio needing width-crop) cut
  // text off the sides. As a bonus, the same text occupies a smaller
  // fraction of a taller frame, giving it more effective room relative to
  // the fixed-percentage safe zones below.
  wallpaper: { label: "Phone wallpaper", w: 9, h: 21 },
};

// Screen areas a lock-screen wallpaper needs to stay clear of - status bar,
// clock, and lock-screen widgets at the top; shortcuts, an optional second
// row of widgets, and the home indicator / gesture nav bar at the bottom.
// Hand-measured against an actual iOS lock screen (see conversation) rather
// than estimated - the real top zone runs much deeper than initially assumed.
export const WALLPAPER_SAFE_ZONE = {
  topRatio: 0.43,
  bottomRatio: 0.29,
};

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Draws the source image into ctx, cover-cropped to canvasWidth x
// canvasHeight. `focalPoint` is {x, y} in 0-100. `zoom` >= 1 scales the image
// up beyond the minimum cover-fit, giving the focal point room to pan.
function drawImageLayer(ctx, canvasWidth, canvasHeight, image, focalPoint, zoom, bw) {
  const coverScale = Math.max(canvasWidth / image.naturalWidth, canvasHeight / image.naturalHeight);
  const scale = coverScale * zoom;
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const offsetX = (canvasWidth - drawWidth) * (focalPoint.x / 100);
  const offsetY = (canvasHeight - drawHeight) * (focalPoint.y / 100);

  ctx.filter = bw ? SILVERTONE_FILTER : "none";
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  ctx.filter = "none";
}

// Computes stripe + text geometry for canvasWidth x canvasHeight, without
// drawing anything. Shared by renderCard (to draw) and main.js (to hit-test
// drag gestures against the current stripe rectangle).
export function computeLayout(ctx, canvasWidth, canvasHeight, {
  verseText, textScale, stripeBottomRatio, sidePaddingRatio = THEME.stripeSidePaddingRatio,
  fontFamily = FONT_STACKS.modern.fontFamily,
}) {
  const versePx = canvasWidth * THEME.verseFontRatio * textScale;
  const refPx = versePx; // reference line matches the verse text size
  const sidePadding = canvasWidth * sidePaddingRatio;
  // Top/bottom padding and the verse-to-reference gap scale with text size
  // too, so the stripe's whitespace stays proportional to the text it holds.
  const vPadding = canvasWidth * THEME.stripeVerticalPaddingRatio * textScale;
  const refGap = canvasWidth * THEME.refGapRatio * textScale;
  const textMaxWidth = canvasWidth - sidePadding * 2;
  const verseLineHeight = versePx * THEME.verseLineHeightRatio;

  ctx.font = `${THEME.verseWeight} ${versePx}px ${fontFamily}`;
  const verseLines = wrapText(ctx, verseText, textMaxWidth);
  const verseBlockHeight = verseLines.length * verseLineHeight;
  const stripeHeight = vPadding * 2 + verseBlockHeight + refGap + refPx;

  const stripeBottom = canvasHeight * stripeBottomRatio;
  const stripeY = Math.min(Math.max(stripeBottom - stripeHeight, 0), canvasHeight - stripeHeight);

  return {
    versePx, refPx, vPadding, refGap, verseLines, verseLineHeight, verseBlockHeight,
    stripeY, stripeHeight,
  };
}

// Draws the full verse card into ctx, sized to canvasWidth x canvasHeight.
// `image` is a loaded HTMLImageElement. Returns the stripe layout
// ({ stripeY, stripeHeight }) so callers can hit-test drag gestures.
export function renderCard(ctx, canvasWidth, canvasHeight, {
  image,
  focalPoint,
  zoom,
  bw,
  verseText,
  refLabel,
  stripeOpacity,
  textTheme,
  textScale,
  stripeBottomRatio,
  sidePaddingRatio,
  fontFamily = FONT_STACKS.modern.fontFamily,
  credit,
}) {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  drawImageLayer(ctx, canvasWidth, canvasHeight, image, focalPoint, zoom, bw);

  const layout = computeLayout(ctx, canvasWidth, canvasHeight, { verseText, textScale, stripeBottomRatio, sidePaddingRatio, fontFamily });
  const { versePx, refPx, vPadding, refGap, verseLines, verseLineHeight, verseBlockHeight, stripeY, stripeHeight } = layout;

  // "light" = black text on a white stripe (default); "dark" = inverted.
  const isDark = textTheme === "dark";
  const stripeRgb = isDark ? "0, 0, 0" : "255, 255, 255";
  const verseColor = isDark ? "#ffffff" : "#000000";
  const refColor = isDark ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.7)";

  // Stripe.
  ctx.fillStyle = `rgba(${stripeRgb}, ${stripeOpacity})`;
  ctx.fillRect(0, stripeY, canvasWidth, stripeHeight);

  // Verse text.
  ctx.fillStyle = verseColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${THEME.verseWeight} ${versePx}px ${fontFamily}`;
  verseLines.forEach((line, i) => {
    const y = stripeY + vPadding + verseLineHeight * (i + 0.5);
    ctx.fillText(line, canvasWidth / 2, y);
  });

  // Reference line.
  ctx.font = `italic ${THEME.refWeight} ${refPx}px ${fontFamily}`;
  ctx.fillStyle = refColor;
  const refY = stripeY + vPadding + verseBlockHeight + refGap + refPx / 2;
  ctx.fillText(refLabel, canvasWidth / 2, refY);

  // Photo credit watermark - tiny, translucent, bottom-center of the image.
  // Fixed to the canvas edge (not stripe-aware): if the stripe is dragged
  // all the way to the bottom it can cover this, which is an accepted
  // trade-off of a fixed bottom-center placement.
  if (credit) {
    const creditPx = canvasWidth * THEME.creditFontRatio;
    const creditY = canvasHeight - canvasWidth * THEME.creditBottomMarginRatio;
    ctx.font = `${THEME.refWeight} ${creditPx}px ${fontFamily}`;
    ctx.fillStyle = `rgba(255, 255, 255, ${THEME.creditOpacity})`;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(credit, canvasWidth / 2, creditY);
  }

  return { stripeY, stripeHeight };
}
