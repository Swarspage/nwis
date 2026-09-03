import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { toScenePosition, SCENE_SCALE } from "./geometryTransform.js";

/**
 * CurrentBitMarker: Smoothly interpolates bit position along survey points based on current_md.
 * Note: useFrame performs visual interpolation ONLY, not engineering calculations.
 */
export default function CurrentBitMarker({ geometry, scale = SCENE_SCALE }) {
  const meshRef = useRef();

  // Compute 3D position corresponding to current_md from survey points using canonical transform
  const targetPosition = useMemo(() => {
    if (!geometry || !geometry.trajectory || !geometry.trajectory.survey_points) {
      return null;
    }
    const pts = geometry.trajectory.survey_points;
    const currentMd = geometry.current_md;
    if (currentMd == null || pts.length === 0) return null;

    // Interpolate position along survey points
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      if (p1.md <= currentMd && currentMd <= p2.md) {
        const ratio = (p2.md > p1.md) ? (currentMd - p1.md) / (p2.md - p1.md) : 0;
        const x = p1.x + ratio * (p2.x - p1.x);
        const tvd = p1.tvd + ratio * (p2.tvd - p1.tvd);
        const y = p1.y + ratio * (p2.y - p1.y);
        return toScenePosition(geometry.surface, { x, tvd, y }, scale);
      }
    }

    // Fallback to last point if current_md is at or beyond total depth
    const last = pts[pts.length - 1];
    return toScenePosition(geometry.surface, last, scale);
  }, [geometry, scale]);

  // Smooth position lerp in useFrame for visual animation
  useFrame((_, delta) => {
    if (!meshRef.current || !targetPosition) return;
    meshRef.current.position.lerp(targetPosition, Math.min(1.0, delta * 5.0));
  });

  if (!targetPosition) return null;

  return (
    <group ref={meshRef} position={targetPosition}>
      {/* Bit Sphere Marker */}
      <mesh>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshBasicMaterial color="#1E8A8A" />
      </mesh>

      {/* Subtle outer pulse ring */}
      <mesh>
        <sphereGeometry args={[0.55, 16, 16]} />
        <meshBasicMaterial color="#1E8A8A" transparent opacity={0.25} wireframe />
      </mesh>

      {/* Bit Depth Label */}
      <Html position={[0.6, 0.4, 0]} distanceFactor={30}>
        <div
          style={{
            background: "rgba(6, 22, 39, 0.85)",
            border: "1px solid var(--color-signal-teal, #1E8A8A)",
            color: "#fff",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "10px",
            padding: "2px 6px",
            borderRadius: "3px",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "0 2px 6px rgba(0,0,0,0.4)"
          }}
        >
          BIT: {geometry.current_md?.toFixed(0)} ft MD
          {geometry.current_tvd != null && ` | ${geometry.current_tvd.toFixed(0)} ft TVD`}
        </div>
      </Html>
    </group>
  );
}
