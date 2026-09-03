import * as THREE from "three";

export const SCENE_SCALE = 0.01; // 1 scene unit = 100 ft
export const SURFACE_SPREAD = 15.0; // 15.0x wellhead spacing multiplier — extra spacious oilfield layout

// Professional engineering palette: Active Teal, Selected Blue, Subdued Slate for offsets
export const WELL_COLOR_PALETTE = {
  "WELL-1": "#E69F00", // Unavailable Warning / Amber Rig
  "WELL-2": "#1E8A8A", // Active Teal
  "WELL-3": "#38BDF8", // Selected Blue
  "WELL-4": "#94A3B8", // Offset Slate
  "WELL-5": "#94A3B8", // Offset Slate
  "WELL-6": "#94A3B8"  // Offset Slate
};

export function getWellColor(wellId, isPrimary = false, isSelected = false) {
  if (isPrimary) return "#1E8A8A";
  if (isSelected) return "#38BDF8";
  return WELL_COLOR_PALETTE[wellId] || "#94A3B8";
}

/**
 * Converts backend surface location + survey point into canonical 3D Three.js scene position.
 */
export function toScenePosition(surface, point, scale = SCENE_SCALE, spread = SURFACE_SPREAD, wellId = null) {
  let sx = (surface?.x || 0);
  let sy = (surface?.y || 0);
  let elev = surface?.elevation || 0;

  if (wellId === "WELL-5") {
    sx += 200;
    sy += 200;
  } else if (wellId === "WELL-2") {
    sx -= 60;
    sy -= 60;
  } else if (wellId === "WELL-1") {
    // Unique distinct position far from WELL-6 (-300, -300)
    sx = 220;
    sy = -180;
  }

  const px = point?.x || 0;
  const py = point?.y || 0;
  const tvd = point?.tvd || 0;

  return new THREE.Vector3(
    (sx * spread + px) * scale,
    (elev - tvd) * scale,
    (sy * spread + py) * scale
  );
}

/**
 * Converts surface location alone to canonical 3D Three.js scene position at surface level (Y=elev).
 */
export function toSurfacePosition(surface, scale = SCENE_SCALE, spread = SURFACE_SPREAD, wellId = null) {
  let sx = (surface?.x || 0);
  let sy = (surface?.y || 0);
  let elev = surface?.elevation || 0;

  if (wellId === "WELL-5") {
    sx += 200;
    sy += 200;
  } else if (wellId === "WELL-2") {
    sx -= 60;
    sy -= 60;
  } else if (wellId === "WELL-1") {
    // Unique distinct position far from WELL-6 (-300, -300)
    sx = 220;
    sy = -180;
  }

  return new THREE.Vector3(sx * spread * scale, elev * scale, sy * spread * scale);
}
