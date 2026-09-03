import { useMemo, useEffect, useRef } from "react";
import { useGLTF, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Preload both 3D model assets globally
useGLTF.preload("/meshy_1788283030252.glb");
useGLTF.preload("/meshy_1788461932040.glb");

const TARGET_HEIGHT = 36.4; // Big 3D model height in Three.js scene units (increased by 30%)

export default function DrillingWellModel({
  surfacePosition,
  wellId,
  isPrimary = false,
  isSelected = false,
  isPlaying = false,
  modelPath = "/meshy_1788283030252.glb"
}) {
  const groupRef = useRef();
  const { scene } = useGLTF(modelPath);

  // Clone scene instance safely once & configure material properties
  const clonedScene = useMemo(() => {
    if (!scene) return null;
    const cloned = scene.clone(true);
    cloned.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.metalness = 0.1;
        child.material.roughness = 0.8;
      }
    });
    return cloned;
  }, [scene]);

  // Clean up materials on unmount to prevent WebGL GPU context loss
  useEffect(() => {
    return () => {
      if (clonedScene) {
        clonedScene.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material.dispose();
          }
        });
      }
    };
  }, [clonedScene]);

  // Compute exact bounding box math
  const isSecondModel = modelPath.includes("1788461932040");

  const { scaleFactor, xShift, yShift, zShift, actualHeight } = useMemo(() => {
    if (!scene) return { scaleFactor: 1, xShift: 0, yShift: 0, zShift: 0, actualHeight: TARGET_HEIGHT };
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    const baseH = isPrimary ? TARGET_HEIGHT : isSelected ? TARGET_HEIGHT * 0.85 : TARGET_HEIGHT * 0.7;
    // 1st model increased by 30%, 2nd model at 50% scale
    const h = isSecondModel ? baseH * 0.5 : baseH;
    const s = h / maxDim;

    // Shift Y so bottom of local GLB sits at Y = 0 inside group
    const yS = -box.min.y * s;
    const xS = -center.x * s;
    const zS = -center.z * s;
    return { scaleFactor: s, xShift: xS, yShift: yS, zShift: zS, actualHeight: size.y * s };
  }, [scene, isPrimary, isSelected, isSecondModel]);

  // Apply position and scale to clonedScene without cloning materials
  useEffect(() => {
    if (!clonedScene) return;
    clonedScene.scale.setScalar(scaleFactor);
    clonedScene.position.set(xShift, yShift, zShift);
  }, [clonedScene, scaleFactor, xShift, yShift, zShift]);

  // Subtle Y-axis rotation when active simulation is playing
  useFrame((_, delta) => {
    if (groupRef.current && isPlaying && isPrimary) {
      groupRef.current.rotation.y += delta * 0.2;
    }
  });

  // Vertical placement: 2nd model is brought UP 100% above grid (0% underground), Model 1 keeps 30% above / 70% below split
  const subsurfaceDepth = isSecondModel ? 0.0 : actualHeight * 0.70;
  const anchorPos = surfacePosition
    ? [surfacePosition.x, surfacePosition.y - subsurfaceDepth, surfacePosition.z]
    : [0, -subsurfaceDepth, 0];

  const badgeBorderColor = isPrimary ? "#1E8A8A" : isSelected ? "#38BDF8" : "#94A3B8";

  return (
    <group position={anchorPos}>
      <group ref={groupRef}>
        {clonedScene && <primitive object={clonedScene} />}
      </group>

      {/* Wellhead Label positioned above top derrick tip */}
      <Html position={[0, actualHeight + 2.5, 0]} center distanceFactor={35}>
        <div
          style={{
            background: isPrimary
              ? "rgba(30, 138, 138, 0.95)"
              : isSelected
              ? "rgba(14, 116, 144, 0.95)"
              : "rgba(15, 23, 42, 0.85)",
            border: `1px solid ${badgeBorderColor}`,
            color: "#EAF0EE",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "10px",
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: "4px",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
          }}
        >
          {isPrimary ? "ACTIVE: " : isSelected ? "SELECTED: " : ""}{wellId}
        </div>
      </Html>
    </group>
  );
}
