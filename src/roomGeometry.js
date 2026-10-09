const positive = (value, fallback) =>
  Number.isFinite(value) && value > 0 ? value : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function sizeLimits(photoRatio, artworkRatio) {
  const max = Math.min(
    0.86,
    (0.86 * positive(artworkRatio, 1)) / positive(photoRatio, 1),
  );
  return { min: Math.min(0.06, max / 2), max };
}

// All coordinates are fractions of the whole photo, independent of viewport.
export function constrainPlacement(placement, photoRatio, artworkRatio) {
  const { min, max } = sizeLimits(photoRatio, artworkRatio);
  const width = clamp(
    Number.isFinite(placement.width) ? placement.width : 0.28,
    min,
    max,
  );
  const height = (width * positive(photoRatio, 1)) / positive(artworkRatio, 1);
  return {
    width,
    x: clamp(
      Number.isFinite(placement.x) ? placement.x : 0.5,
      width / 2,
      1 - width / 2,
    ),
    y: clamp(
      Number.isFinite(placement.y) ? placement.y : 0.4,
      height / 2,
      1 - height / 2,
    ),
  };
}

export function artworkRect(placement, photoRatio, artworkRatio) {
  const safe = constrainPlacement(placement, photoRatio, artworkRatio);
  const height =
    (safe.width * positive(photoRatio, 1)) / positive(artworkRatio, 1);
  return {
    ...safe,
    height,
    left: safe.x - safe.width / 2,
    top: safe.y - height / 2,
  };
}
