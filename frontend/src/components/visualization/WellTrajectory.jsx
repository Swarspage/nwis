import { useMemo, useState } from "react";
import { Line, Html } from "@react-three/drei";
import CurrentBitMarker from "./CurrentBitMarker.jsx";
import { toScenePosition, toSurfacePosition, getWellColor, SCENE_SCALE } from "./geometryTransform.js";

export default function WellTrajectory({
  geometry,
  isPrimary = false,
  isSelected = false,
  onSelect = null,
  scale = SCENE_SCALE
}) {
  const [hovered, setHovered] = useState(false);

  const points = useMemo(() => {
    if (!geometry || !geometry.trajectory || !geometry.trajectory.survey_points) {
      return [];
    }
    return geometry.trajectory.survey_points.map(pt =>
      toScenePosition(geometry.surface, pt, scale)
    );
  }, [geometry, scale]);

  const surfacePosition = useMemo(() => {
    if (!geometry || !geometry.surface) return null;
    return toSurfacePosition(geometry.surface, scale);
  }, [geometry, scale]);

  if (points.length < 2) return null;

  // Distinct trajectory line color from wireframe palette
  const baseColor = getWellColor(geometry.well_id, isPrimary, isSelected);
  let lineColor = baseColor;
  let lineWidth = 2.0;
  let opacity = 0.85;

  if (isPrimary) {
    lineColor = "#1E8A8A";
    lineWidth = 3.8;
    opacity = 1.0;
  } else if (isSelected) {
    lineColor = "#38BDF8";
    lineWidth = 3.2;
    opacity = 1.0;
  } else if (hovered) {
    lineWidth = 3.0;
    opacity = 1.0;
  }

  const handleClick = (e) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(geometry.well_id);
    }
  };

  return (
    <group>
      {/* Trajectory Line */}
      <Line
        points={points}
        color={lineColor}
        lineWidth={lineWidth}
        transparent
        opacity={opacity}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      />

      {/* Current Bit Marker for Active Well */}
      {isPrimary && geometry.current_md != null && (
        <CurrentBitMarker geometry={geometry} scale={scale} />
      )}
    </group>
  );
}
