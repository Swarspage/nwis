import { Suspense, useMemo, useRef, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Line, Grid } from "@react-three/drei";
import * as THREE from "three";
import WellTrajectory from "./WellTrajectory.jsx";
import DrillingWellModel from "./DrillingWellModel.jsx";
import { toScenePosition, toSurfacePosition, getWellColor, SCENE_SCALE, SURFACE_SPREAD } from "./geometryTransform.js";

function ModelLoader() {
  return (
    <Html center>
      <div style={{ color: "#475569", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", whiteSpace: "nowrap" }}>
        Building spatial scene…
      </div>
    </Html>
  );
}

/**
 * DynamicCameraController handles camera placement for the 6 visual guide modes in light theme.
 */
function DynamicCameraController({ viewMode, framingTarget, activeGeometry, selectedOffsetGeometry, allGeometries }) {
  const { camera, controls } = useThree();
  const targetCamPosRef = useRef(new THREE.Vector3(10, 8.5, 10));
  const targetLookAtRef = useRef(new THREE.Vector3(0, 3.2, 0));

  // Compute spatial bounding metrics
  const spatialBounds = useMemo(() => {
    const surfaceBox = new THREE.Box3();
    const trajectoryBox = new THREE.Box3();

    allGeometries.forEach(geom => {
      if (geom?.surface) {
        const sPos = toSurfacePosition(geom.surface, SCENE_SCALE);
        surfaceBox.expandByPoint(sPos);
        surfaceBox.expandByPoint(new THREE.Vector3(sPos.x, sPos.y + 6, sPos.z));
      }
      if (geom?.trajectory?.survey_points) {
        geom.trajectory.survey_points.forEach(pt => {
          trajectoryBox.expandByPoint(toScenePosition(geom.surface, pt, SCENE_SCALE));
        });
      }
    });

    const surfaceCenter = new THREE.Vector3();
    const surfaceSize = new THREE.Vector3();
    surfaceBox.getCenter(surfaceCenter);
    surfaceBox.getSize(surfaceSize);

    const trajCenter = new THREE.Vector3();
    const trajSize = new THREE.Vector3();
    trajectoryBox.getCenter(trajCenter);
    trajectoryBox.getSize(trajSize);

    return {
      surfaceCenter,
      surfaceSize,
      maxSurfaceDim: Math.max(surfaceSize.x, surfaceSize.z, 15),
      trajCenter,
      trajSize,
      maxTrajDim: Math.max(trajSize.x, trajSize.y, trajSize.z, 25)
    };
  }, [allGeometries]);

  const isAnimatingRef = useRef(false);

  useEffect(() => {
    if (!controls) return;
    const onStart = () => {
      isAnimatingRef.current = false;
    };
    controls.addEventListener("start", onStart);
    return () => controls.removeEventListener("start", onStart);
  }, [controls]);

  useEffect(() => {
    const { surfaceCenter, maxSurfaceDim, trajCenter, maxTrajDim } = spatialBounds;

    // Active wellhead anchor position
    let activeAnchor = surfaceCenter.clone();
    if (activeGeometry?.surface) {
      activeAnchor = toSurfacePosition(activeGeometry.surface, SCENE_SCALE);
    }

    if (framingTarget === "FIT_ALL") {
      targetCamPosRef.current.set(trajCenter.x + maxTrajDim * 0.9, Math.max(20.0, trajCenter.y + maxTrajDim * 0.5), trajCenter.z + maxTrajDim * 1.1);
      targetLookAtRef.current.set(surfaceCenter.x, 10.0, surfaceCenter.z);
    } else if (framingTarget === "FOCUS_ACTIVE") {
      const dist = 35;
      targetCamPosRef.current.set(activeAnchor.x + dist, activeAnchor.y + dist * 0.75 + 5.0, activeAnchor.z + dist);
      targetLookAtRef.current.set(activeAnchor.x, activeAnchor.y + 10.0, activeAnchor.z);
    } else if (framingTarget === "FOCUS_SELECTED") {
      let selAnchor = activeAnchor.clone();
      if (selectedOffsetGeometry?.surface) {
        selAnchor = toSurfacePosition(selectedOffsetGeometry.surface, SCENE_SCALE);
      }
      const dist = 35;
      targetCamPosRef.current.set(selAnchor.x + dist, selAnchor.y + dist * 0.75 + 5.0, selAnchor.z + dist);
      targetLookAtRef.current.set(selAnchor.x, selAnchor.y + 10.0, selAnchor.z);
    } else if (viewMode === "TOP") {
      targetCamPosRef.current.set(surfaceCenter.x, surfaceCenter.y + maxSurfaceDim * 1.8 + 40, surfaceCenter.z + 0.01);
      targetLookAtRef.current.set(surfaceCenter.x, 0, surfaceCenter.z);
    } else if (viewMode === "SIDE / TRAJECTORY") {
      targetCamPosRef.current.set(trajCenter.x + maxTrajDim * 1.6, Math.max(10.0, trajCenter.y), trajCenter.z);
      targetLookAtRef.current.set(trajCenter.x, Math.max(0.0, trajCenter.y), trajCenter.z);
    } else if (viewMode === "CLOSE-UP NEAR WELLHEAD") {
      targetCamPosRef.current.set(activeAnchor.x + 18, activeAnchor.y + 12, activeAnchor.z + 20);
      targetLookAtRef.current.set(activeAnchor.x, activeAnchor.y + 12.0, activeAnchor.z);
    } else if (viewMode === "MID TRAJECTORY ZOOM") {
      targetCamPosRef.current.set(activeAnchor.x + 25, 15.0, activeAnchor.z + 25);
      targetLookAtRef.current.set(activeAnchor.x, -20.0, activeAnchor.z);
    } else if (viewMode === "DEEP SECTION ZOOM") {
      targetCamPosRef.current.set(activeAnchor.x + 25, 10.0, activeAnchor.z + 25);
      targetLookAtRef.current.set(activeAnchor.x, -50.0, activeAnchor.z);
    } else {
      const dist = 35;
      targetCamPosRef.current.set(activeAnchor.x + dist, activeAnchor.y + dist * 0.75 + 5.0, activeAnchor.z + dist);
      targetLookAtRef.current.set(activeAnchor.x, activeAnchor.y + 10.0, activeAnchor.z);
    }

    // Trigger smooth transition animation only when mode/target changes
    isAnimatingRef.current = true;
  }, [viewMode, framingTarget, spatialBounds, activeGeometry, selectedOffsetGeometry]);

  useFrame((_, delta) => {
    if (!controls || !isAnimatingRef.current) return;
    // Ensure target position Y stays above ground
    targetCamPosRef.current.y = Math.max(2.0, targetCamPosRef.current.y);

    camera.position.lerp(targetCamPosRef.current, Math.min(1.0, delta * 5.0));
    controls.target.lerp(targetLookAtRef.current, Math.min(1.0, delta * 5.0));

    // Clamp camera position above ground plane
    if (camera.position.y < 1.5) {
      camera.position.y = 1.5;
    }
    controls.update();

    if (
      camera.position.distanceTo(targetCamPosRef.current) < 0.05 &&
      controls.target.distanceTo(targetLookAtRef.current) < 0.05
    ) {
      isAnimatingRef.current = false;
    }
  });

  return null;
}

/**
 * DynamicDepthGrid renders discrete depth ticks along Y axis in clean slate dark style.
 */
function DynamicDepthGrid({ maxTvd = 10000 }) {
  const ticks = useMemo(() => {
    const list = [];
    const step = 2000;
    for (let tvd = 0; tvd <= maxTvd; tvd += step) {
      list.push({ tvd, y: -tvd * SCENE_SCALE });
    }
    return list;
  }, [maxTvd]);

  return (
    <group position={[-20, 0, -20]}>
      {/* Vertical Depth Scale Bar */}
      <Line
        points={[[0, 0, 0], [0, -maxTvd * SCENE_SCALE, 0]]}
        color="#64748B"
        opacity={0.4}
        transparent={true}
        lineWidth={1.5}
      />
      {ticks.map(t => (
        <group key={t.tvd} position={[0, t.y, 0]}>
          <Line points={[[0, 0, 0], [0.8, 0, 0]]} color="#64748B" opacity={0.5} transparent={true} lineWidth={1} />
          <Html position={[1.2, 0, 0]} distanceFactor={40}>
            <div style={{ color: "#475569", fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 600, whiteSpace: "nowrap" }}>
              {t.tvd === 0 ? "0 ft" : `-${t.tvd} ft`}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

/**
 * MeasurementVisualizer renders Surface Distance or Minimum 3D Separation lines.
 */
function MeasurementVisualizer({ measurementMode, activeGeometry, selectedOffsetGeometry, offsetRelationship }) {
  if (measurementMode === "OFF" || !activeGeometry || !selectedOffsetGeometry) return null;
  if (activeGeometry.geometry_status === "UNAVAILABLE" || selectedOffsetGeometry.geometry_status === "UNAVAILABLE") return null;

  if (measurementMode === "SURFACE DISTANCE") {
    const p1 = toSurfacePosition(activeGeometry.surface, SCENE_SCALE);
    const p2 = toSurfacePosition(selectedOffsetGeometry.surface, SCENE_SCALE);
    p1.y += 0.1;
    p2.y += 0.1;
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    const distFt = offsetRelationship?.surface_distance;

    return (
      <group>
        <Line points={[p1, p2]} color="#D97706" lineWidth={2} dashSize={0.5} gapSize={0.25} />
        <Html position={mid} center distanceFactor={35}>
          <div style={{
            background: "rgba(255, 255, 255, 0.95)",
            border: "1px solid #D97706",
            color: "#92400E",
            fontWeight: 700,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "10px",
            padding: "2px 6px",
            borderRadius: "3px",
            whiteSpace: "nowrap",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)"
          }}>
            SURFACE DISTANCE: {distFt != null ? `${distFt.toFixed(0)} ft` : "Unavailable"}
          </div>
        </Html>
      </group>
    );
  }

  if (measurementMode === "MINIMUM 3D SEPARATION") {
    const min3dFt = offsetRelationship?.minimum_3d_separation;
    const closestMdFt = offsetRelationship?.closest_approach_md;
    const closestTvdFt = offsetRelationship?.closest_approach_tvd;

    if (min3dFt == null || closestTvdFt == null || !selectedOffsetGeometry.trajectory?.survey_points) return null;

    const pts = selectedOffsetGeometry.trajectory.survey_points;
    let closestPt = pts[0];
    let minDiff = Infinity;
    pts.forEach(p => {
      if (p.tvd != null) {
        const diff = Math.abs(p.tvd - closestTvdFt);
        if (diff < minDiff) {
          minDiff = diff;
          closestPt = p;
        }
      }
    });

    const p2 = toScenePosition(selectedOffsetGeometry.surface, closestPt, SCENE_SCALE);
    const p1 = toScenePosition(activeGeometry.surface, { x: 0, y: 0, tvd: closestTvdFt }, SCENE_SCALE);
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

    return (
      <group>
        <Line points={[p1, p2]} color="#E11D48" lineWidth={2.5} />
        <mesh position={p2}>
          <sphereGeometry args={[0.3, 12, 12]} />
          <meshBasicMaterial color="#E11D48" />
        </mesh>
        <Html position={mid} center distanceFactor={35}>
          <div style={{
            background: "rgba(255, 255, 255, 0.95)",
            border: "1px solid #E11D48",
            color: "#9F1239",
            fontWeight: 700,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "10px",
            padding: "3px 8px",
            borderRadius: "3px",
            whiteSpace: "nowrap",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
          }}>
            MIN 3D SEPARATION: {min3dFt.toFixed(0)} ft
            <div style={{ fontSize: "9px", fontWeight: 400, opacity: 0.9 }}>
              At Closest Approach (MD {closestMdFt?.toFixed(0)} ft, TVD {closestTvdFt?.toFixed(0)} ft)
            </div>
          </div>
        </Html>
      </group>
    );
  }

  return null;
}

// ─── Oil Field Terrain: bumpy procedural ground mesh ─────────────────────────
function OilFieldTerrain({ surfaceCenter }) {
  const geometry = useMemo(() => {
    const W = 200, H = 200, SEG = 80;
    const geo = new THREE.PlaneGeometry(W, H, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const { x: cx, z: cz } = surfaceCenter;

    // Multi-octave smooth pseudo-Perlin height using sin/cos harmonics
    const pseudoNoise = (x, z) => {
      const f1 = Math.sin(x * 0.18 + 1.3) * Math.cos(z * 0.14 - 0.7) * 1.8;
      const f2 = Math.sin(x * 0.34 - 0.9) * Math.cos(z * 0.29 + 2.1) * 0.9;
      const f3 = Math.sin(x * 0.61 + 2.7) * Math.cos(z * 0.55 - 1.4) * 0.4;
      const f4 = Math.sin(x * 1.1 - 1.8) * Math.cos(z * 0.92 + 0.6) * 0.18;
      return f1 + f2 + f3 + f4;
    };

    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i) + cx;
      const wz = pos.getZ(i) + cz;
      // Flatten near site center so well pads sit level
      const distFromCenter = Math.sqrt(wx * wx + wz * wz);
      const flattenFactor = Math.min(1.0, distFromCenter / 8.0);
      pos.setY(i, pseudoNoise(wx, wz) * flattenFactor);
    }
    geo.computeVertexNormals();
    return geo;
  }, [surfaceCenter]);

  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2048; canvas.height = 2048;
    const ctx = canvas.getContext("2d");

    // Base: dry cracked oil-field dirt
    const grad = ctx.createLinearGradient(0, 0, 2048, 2048);
    grad.addColorStop(0, "#9C7B5C");
    grad.addColorStop(0.3, "#8A6D4D");
    grad.addColorStop(0.6, "#7E6244");
    grad.addColorStop(1, "#6B5038");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2048, 2048);

    // Oil stain dark blotches
    for (let i = 0; i < 28; i++) {
      const ox = Math.random() * 2048, oy = Math.random() * 2048;
      const r = 40 + Math.random() * 120;
      const sg = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
      sg.addColorStop(0, "rgba(20,12,5,0.55)");
      sg.addColorStop(1, "rgba(20,12,5,0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.ellipse(ox, oy, r, r * (0.5 + Math.random() * 0.5), Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tire track mud ruts
    ctx.strokeStyle = "rgba(45,28,15,0.35)";
    ctx.lineWidth = 8;
    for (let t = 0; t < 12; t++) {
      const tx = Math.random() * 2048, ty = Math.random() * 2048;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      for (let k = 0; k < 8; k++) {
        ctx.lineTo(tx + (Math.random() - 0.5) * 600, ty + k * 200 + (Math.random() - 0.5) * 80);
      }
      ctx.stroke();
    }

    // Dried cracked mud
    ctx.strokeStyle = "rgba(55,35,18,0.22)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 80; i++) {
      const cx2 = Math.random() * 2048, cy2 = Math.random() * 2048;
      const l = 30 + Math.random() * 100;
      const a = Math.random() * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx2, cy2);
      ctx.lineTo(cx2 + Math.cos(a) * l, cy2 + Math.sin(a) * l);
      ctx.stroke();
    }

    // Sparse gravel scatter
    ctx.fillStyle = "rgba(180, 155, 120, 0.3)";
    for (let i = 0; i < 300; i++) {
      const gx = Math.random() * 2048, gy = Math.random() * 2048;
      const gs = 2 + Math.random() * 6;
      ctx.beginPath();
      ctx.ellipse(gx, gy, gs, gs * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // Faint survey grid lines
    ctx.strokeStyle = "rgba(220,200,170,0.18)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= 2048; i += 128) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 2048); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(2048, i); ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  }, []);

  return (
    <mesh geometry={geometry} position={[surfaceCenter.x, -0.1, surfaceCenter.z]} receiveShadow>
      <meshStandardMaterial
        map={texture}
        roughness={0.97}
        metalness={0.0}
        transparent={true}
        opacity={0.72}
        depthWrite={true}
      />
    </mesh>
  );
}

// ─── Gravel Well Pad beneath each wellhead ────────────────────────────────────
function WellPad({ position }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext("2d");

    // Compacted gravel base
    ctx.fillStyle = "#B0936E";
    ctx.fillRect(0, 0, 256, 256);

    // Gravel aggregate
    for (let i = 0; i < 600; i++) {
      const gx = Math.random() * 256, gy = Math.random() * 256;
      const gs = 1.5 + Math.random() * 4;
      const brightness = 120 + Math.floor(Math.random() * 80);
      ctx.fillStyle = `rgb(${brightness}, ${Math.floor(brightness * 0.85)}, ${Math.floor(brightness * 0.68)})`;
      ctx.beginPath();
      ctx.ellipse(gx, gy, gs, gs * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // Oil stains near center
    const sg = ctx.createRadialGradient(128, 128, 0, 128, 128, 60);
    sg.addColorStop(0, "rgba(15,8,2,0.5)");
    sg.addColorStop(1, "rgba(15,8,2,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, 256, 256);

    // Edge boundary ring
    ctx.strokeStyle = "rgba(80,55,30,0.6)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(128, 128, 118, 0, Math.PI * 2);
    ctx.stroke();

    return new THREE.CanvasTexture(canvas);
  }, []);

  return (
    <mesh position={[position.x, 0.02, position.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[5.5, 36]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.99}
        metalness={0.0}
        transparent={true}
        opacity={0.85}
      />
    </mesh>
  );
}

// ─── Dirt access road from pad to site center ─────────────────────────────────
function AccessRoad({ from, to }) {
  const geometry = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(to, from).normalize();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x);
    const w = 1.4;
    const s = new THREE.Shape();
    s.moveTo(from.x + perp.x * w, from.z + perp.z * w);
    s.lineTo(to.x + perp.x * w, to.z + perp.z * w);
    s.lineTo(to.x - perp.x * w, to.z - perp.z * w);
    s.lineTo(from.x - perp.x * w, from.z - perp.z * w);
    s.closePath();
    const geo = new THREE.ShapeGeometry(s);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [from, to]);

  return (
    <mesh geometry={geometry} position={[0, 0.01, 0]}>
      <meshStandardMaterial
        color="#6B4F33"
        roughness={1.0}
        metalness={0.0}
        transparent={true}
        opacity={0.55}
      />
    </mesh>
  );
}

function LookAheadVisualizer({ activeGeometry, lookAhead }) {
  if (!lookAhead || lookAhead.status !== "AHEAD" || lookAhead.tvd_ahead_start_ft == null || !activeGeometry?.surface) {
    return null;
  }

  const sPos = toSurfacePosition(activeGeometry.surface, SCENE_SCALE);
  const aheadTvd = (activeGeometry.current_tvd || 0) + lookAhead.tvd_ahead_start_ft;
  const markerPos = new THREE.Vector3(sPos.x, -aheadTvd * SCENE_SCALE, sPos.z);

  return (
    <group position={markerPos}>
      {/* 3D Pulse Ring */}
      <mesh rotation-x={Math.PI / 2}>
        <ringGeometry args={[1.2, 1.8, 32]} />
        <meshBasicMaterial color="#F59E0B" side={THREE.DoubleSide} transparent opacity={0.75} />
      </mesh>
      {/* Vertical Beacon Cylinder */}
      <mesh position={[0, -1.0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 2.0, 16]} />
        <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={0.6} transparent opacity={0.85} />
      </mesh>
      {/* Label Overlay */}
      <Html position={[2, 0, 0]} center>
        <div style={{
          background: "#FEF3C7",
          color: "#92400E",
          border: "1px solid #F59E0B",
          borderRadius: "4px",
          padding: "3px 8px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "10px",
          fontWeight: 700,
          whiteSpace: "nowrap",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
        }}>
          ⚠️ LOOK-AHEAD: {lookAhead.tvd_ahead_start_ft.toFixed(0)} ft TVD ({lookAhead.target_event_id || "HISTORICAL EVENT"})
        </div>
      </Html>
    </group>
  );
}

export default function OffsetWellScene({
  activeGeometry,
  offsetGeometries = [],
  selectedWellId,
  selectedOffsetWellId,
  onSelectWell,
  viewMode = "PERSPECTIVE",
  framingTarget = "FOCUS_ACTIVE",
  measurementMode = "OFF",
  offsetRelationships = [],
  historicalEvents = [],
  intelligenceResult = null,
  isPlaying = false
}) {

  const allGeometries = useMemo(() => {
    const map = new Map();
    if (activeGeometry && activeGeometry.well_id) {
      map.set(activeGeometry.well_id, activeGeometry);
    }
    (offsetGeometries || []).forEach(g => {
      if (g && g.well_id && !map.has(g.well_id)) {
        map.set(g.well_id, g);
      }
    });
    return Array.from(map.values());
  }, [activeGeometry, offsetGeometries]);


  const selectedOffsetGeometry = useMemo(() => {
    return offsetGeometries.find(g => g.well_id === selectedOffsetWellId);
  }, [offsetGeometries, selectedOffsetWellId]);

  const selectedRelationship = useMemo(() => {
    return offsetRelationships.find(r => r.offset_well_id === selectedOffsetWellId);
  }, [offsetRelationships, selectedOffsetWellId]);

  const surfaceCenter = useMemo(() => {
    let sx = 0, sz = 0, count = 0;
    allGeometries.forEach(g => {
      if (g?.surface) {
        const sPos = toSurfacePosition(g.surface, SCENE_SCALE);
        sx += sPos.x;
        sz += sPos.z;
        count++;
      }
    });
    return count > 0 ? new THREE.Vector3(sx / count, 0, sz / count) : new THREE.Vector3(0, 0, 0);
  }, [allGeometries]);

  const maxTvd = useMemo(() => {
    let maxVal = 0;
    allGeometries.forEach(g => {
      if (g?.summary?.max_tvd) {
        maxVal = Math.max(maxVal, g.summary.max_tvd);
      }
    });
    return maxVal || 10000;
  }, [allGeometries]);

  // Collect all well surface positions for pads and roads
  const wellSurfacePositions = useMemo(() =>
    allGeometries
      .filter(g => g.surface || g.well_id === "WELL-1")
      .map(g => toSurfacePosition(g.surface, SCENE_SCALE, SURFACE_SPREAD, g.well_id)),
    [allGeometries]
  );

  return (
    <div style={{ width: "100%", height: "100%", background: "#D6C9B6", position: "relative" }}>
      {/* Unavailable Geometry Badge for Active Well */}
      {activeGeometry && activeGeometry.geometry_status === "UNAVAILABLE" && (
        <div style={{
          position: "absolute",
          top: 54,
          left: 12,
          zIndex: 10,
          background: "rgba(255, 255, 255, 0.95)",
          border: "1px solid #D97706",
          borderRadius: "6px",
          padding: "6px 12px",
          color: "#B45309",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "11px",
          fontWeight: 600,
          pointerEvents: "none",
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
        }}>
          ⚠️ {activeGeometry.well_id}: GEOMETRY UNAVAILABLE
        </div>
      )}

      <Canvas
        camera={{ position: [10, 8.5, 10], fov: 45, near: 0.1, far: 3000 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", (event) => {
            event.preventDefault();
            console.warn("WebGL context lost - attempting automatic context restoration.");
          }, false);
        }}
      >

        <ambientLight intensity={1.8} color="#FFF4E0" />
        <directionalLight position={[20, 40, 15]} intensity={2.8} color="#FFFFFF" castShadow
          shadow-mapSize-width={2048} shadow-mapSize-height={2048}
          shadow-camera-far={500} shadow-camera-left={-100} shadow-camera-right={100}
          shadow-camera-top={100} shadow-camera-bottom={-100}
        />
        <directionalLight position={[-15, 20, -20]} intensity={1.0} color="#FFE8C0" />
        {/* Warm fill from below to simulate ground bounce */}
        <hemisphereLight skyColor="#FFF4E0" groundColor="#8B6340" intensity={0.6} />

        <Suspense fallback={<ModelLoader />}>
          <group>
            {/* Oil Field Terrain */}
            <OilFieldTerrain surfaceCenter={surfaceCenter} />

            {/* Gravel Well Pads */}
            {wellSurfacePositions.map((pos, i) => (
              <WellPad key={i} position={pos} />
            ))}

            {/* Dirt Access Roads from each pad to site center */}
            {wellSurfacePositions.map((pos, i) => {
              const to2D = new THREE.Vector3(surfaceCenter.x, 0, surfaceCenter.z);
              const from2D = new THREE.Vector3(pos.x, 0, pos.z);
              if (from2D.distanceTo(to2D) < 1) return null;
              return <AccessRoad key={i} from={from2D} to={to2D} />;
            })}

            {/* Shared Drilling Rig Models with original GLB materials for ALL Wells */}
            {allGeometries.map((geom, idx) => {
              if (!geom?.surface && geom.well_id !== "WELL-1") return null;
              const isPrimary = geom.well_id === activeGeometry?.well_id;
              const isSelected = geom.well_id === selectedOffsetWellId;
              const sPos = toSurfacePosition(geom.surface, SCENE_SCALE, SURFACE_SPREAD, geom.well_id);

              // Explicit 3D model mapping so WELL-1 (Model 1) and WELL-6 (Model 2) use distinct assets
              const modelPath = (geom.well_id === "WELL-1" || geom.well_id === "WELL-2" || geom.well_id === "WELL-4" || geom.well_id === "WELL-5")
                ? "/meshy_1788283030252.glb"
                : "/meshy_1788461932040.glb";

              return (
                <DrillingWellModel
                  key={`rig-${geom.well_id}-${idx}`}
                  surfacePosition={sPos}
                  wellId={geom.well_id}
                  isPrimary={isPrimary}
                  isSelected={isSelected}
                  isPlaying={isPlaying}
                  modelPath={modelPath}
                />
              );

            })}

            {/* Active Well Trajectory */}
            {activeGeometry && activeGeometry.geometry_status !== "UNAVAILABLE" && (
              <WellTrajectory
                geometry={activeGeometry}
                isPrimary={true}
                isSelected={selectedWellId === activeGeometry.well_id}
                onSelect={onSelectWell}
                scale={SCENE_SCALE}
              />
            )}

            {/* Offset Well Trajectories */}
            {offsetGeometries.map(geom => (
              geom.geometry_status !== "UNAVAILABLE" && (
                <WellTrajectory
                  key={geom.well_id}
                  geometry={geom}
                  isPrimary={false}
                  isSelected={selectedOffsetWellId === geom.well_id}
                  onSelect={onSelectWell}
                  scale={SCENE_SCALE}
                />
              )
            ))}

            {/* Measurement Visualizer */}
            <MeasurementVisualizer
              measurementMode={measurementMode}
              activeGeometry={activeGeometry}
              selectedOffsetGeometry={selectedOffsetGeometry}
              offsetRelationship={selectedRelationship}
            />

            {/* Look-Ahead Visualizer */}
            <LookAheadVisualizer
              activeGeometry={activeGeometry}
              lookAhead={intelligenceResult?.look_ahead}
            />

            {/* Dynamic Depth Axis */}
            {maxTvd > 0 && <DynamicDepthGrid maxTvd={maxTvd} />}
          </group>

        </Suspense>

        {/* Dynamic Camera Controller */}
        <DynamicCameraController
          viewMode={viewMode}
          framingTarget={framingTarget}
          activeGeometry={activeGeometry}
          selectedOffsetGeometry={selectedOffsetGeometry}
          allGeometries={allGeometries}
        />

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={0.5}
          maxDistance={3000}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
        />

        {/* Industrial Oil Field Survey Grid */}
        <Grid
          position={[surfaceCenter.x, 0.05, surfaceCenter.z]}
          args={[400, 400]}
          cellSize={10}
          cellThickness={0.8}
          cellColor="#C4922A"
          sectionSize={50}
          sectionThickness={2.0}
          sectionColor="#A0620F"
          fadeDistance={350}
          fadeStrength={1.5}
        />
      </Canvas>

      {/* Light Theme Viewport Legend Overlay */}
      <div style={{
        position: "absolute",
        bottom: 12,
        left: 12,
        zIndex: 10,
        background: "rgba(255, 255, 255, 0.92)",
        border: "1px solid #CBD5E1",
        borderRadius: "6px",
        padding: "8px 12px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        fontSize: "11px",
        fontFamily: "'IBM Plex Mono', monospace",
        color: "#0F172A",
        pointerEvents: "none",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
      }}>
        <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", marginBottom: "2px" }}>
          LEGEND
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: 12, height: 3, background: "#0F766E", borderRadius: 1 }} />
          <span>ACTIVE WELL ({activeGeometry?.well_id || "NONE"})</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: 12, height: 3, background: "#0284C7", borderRadius: 1 }} />
          <span>SELECTED OFFSET ({selectedOffsetWellId || "NONE"})</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: 12, height: 3, background: "#64748B", borderRadius: 1 }} />
          <span>OTHER OFFSETS</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0F766E" }} />
          <span>CURRENT BIT</span>
        </div>
      </div>
    </div>
  );
}
