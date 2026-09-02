/**
 * WellViewport3D — Oil well 3D model viewer.
 *
 * Loads the GLB rig model and auto-fits it to the viewport regardless of
 * the source model's native scale, so the showcase works on any screen.
 *
 * The scene:
 *   - GLB model normalized to a fixed world size (auto-fit via Box3)
 *   - Slow Y-rotation when simulation is PLAYING
 *   - Risk-reactive ambient light color shift (low intensity)
 *   - OrbitControls for user exploration (touch-friendly)
 *   - Status overlay (top-left); telemetry callouts hidden on narrow screens
 *
 * API bindings (no fabricated values):
 *   - simulationState.status === "PLAYING" → slow model rotation
 *   - riskScore → ambient light color
 *   - wellId → label in overlay
 *
 * Design system:
 *   - transparent backdrop, hairline-free floating presentation
 *   - Overlays: rgba(6,22,39,0.82) glass, IBM Plex Mono + Inter
 */
import { useRef, useMemo, Suspense, Component, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Center, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// World size the model is normalized to, so camera framing is model-agnostic
const TARGET_SIZE = 8;

// ── Loaded GLB Model ────────────────────────────────────────
function LoadedWellModel({ playing }) {
  const groupRef = useRef();

  const { scene } = useGLTF("/meshy_1788283030252.glb");

  // Normalize scale + recenter so any GLB fits the fixed camera framing
  useEffect(() => {
    if (!scene) return;
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = TARGET_SIZE / maxDim;

    scene.scale.setScalar(scale);
    scene.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    scene.traverse((child) => {
      if (child.isMesh && child.material) {
        // Normalize metalness/roughness so textures read without HDR lighting
        child.material.metalness = 0.1;
        child.material.roughness = 0.8;
        child.material.needsUpdate = true;
      }
    });
  }, [scene]);

  useFrame((_, delta) => {
    if (groupRef.current && playing) {
      groupRef.current.rotation.y += delta * 0.25; // slow deliberate rotation
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}

// ── Scene lighting ──────────────────────────────────────────
function SceneLighting({ riskScore }) {
  const ambientColor = useMemo(() => {
    if (riskScore == null || riskScore < 40) return "#c8dce8";
    if (riskScore < 70) return "#ddd0b8";
    return "#ddbcb8";
  }, [riskScore]);

  return (
    <>
      <ambientLight intensity={1.2} color={ambientColor} />
      <directionalLight position={[6, 10, 6]} intensity={2.5} color="#ffffff" />
      <directionalLight position={[-4, 4, -4]} intensity={1.2} color="#f0f8ff" />
      <pointLight position={[0, -8, 4]} intensity={0.8} color="#7C9885" />
    </>
  );
}

// ── Status overlay ──────────────────────────────────────────
function StatusOverlay({ status, wellId, riskScore }) {
  const riskLabel =
    riskScore == null ? "—" : riskScore >= 70 ? "ELEVATED" : riskScore >= 40 ? "WATCH" : "NORMAL";
  const riskColor =
    riskScore == null ? "#8C99A6" : riskScore >= 70 ? "#B3261E" : riskScore >= 40 ? "#C77A2E" : "#2F6F4E";

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        zIndex: 2,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: "rgba(6,22,39,0.82)",
          color: "#EAF0EE",
          fontFamily: "'Inter', sans-serif",
          fontSize: "11px",
          fontWeight: 500,
          padding: "4px 8px",
          borderRadius: "6px",
        }}
      >
        {wellId}
      </div>
      <div
        style={{
          background: "rgba(6,22,39,0.82)",
          color: riskColor,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "11px",
          fontWeight: 500,
          padding: "4px 8px",
          borderRadius: "6px",
        }}
      >
        {riskScore != null ? `${riskScore.toFixed(0)} · ` : ""}
        {riskLabel}
      </div>
      {status === "PLAYING" && (
        <div
          style={{
            background: "rgba(30,138,138,0.18)",
            color: "#1E8A8A",
            fontFamily: "'Inter', sans-serif",
            fontSize: "10px",
            fontWeight: 500,
            padding: "3px 8px",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#1E8A8A",
              animation: "livePulse 1.8s ease-in-out infinite",
            }}
          />
          LIVE
        </div>
      )}
    </div>
  );
}

// ── 3D Telemetry Callouts ──────────────────────────────────────────
function TelemetryCallouts({ telemetry }) {
  if (!telemetry) return null;

  const getMeasurementValue = (key) =>
    telemetry?.measurements?.[key]?.value ?? null;

  const formatVal = (val) => (val != null ? val.toFixed(1) : "—");
  const depthVal = getMeasurementValue("depth");

  return (
    <>
      {/* Depth Indicator Callout (Attached lower on the rig) */}
      <Html position={[0, -3, 3]} center zIndexRange={[100, 0]}>
        <div style={{
          background: "rgba(6,22,39,0.85)",
          borderLeft: "2px solid var(--color-signal-teal)",
          padding: "8px 12px",
          color: "#EAF0EE",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "11px",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          borderRadius: "0 6px 6px 0",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
        }}>
          <div style={{ color: "var(--color-mute)", fontSize: "9px", marginBottom: 2, letterSpacing: "0.05em" }}>LIVE DEPTH</div>
          <div style={{ fontSize: "12px", fontWeight: "bold" }}>
            {depthVal != null ? `${formatVal(depthVal)} ft` : "Unavailable"}
          </div>
        </div>
      </Html>

      {/* Main Telemetry Box (Attached higher up) */}
      <Html position={[4, 3, 0]} center zIndexRange={[100, 0]}>
        <div style={{
          background: "rgba(6,22,39,0.85)",
          border: "1px solid rgba(234,240,238,0.1)",
          padding: "10px",
          color: "#EAF0EE",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "10px",
          pointerEvents: "none",
          borderRadius: "6px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px 16px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
        }}>
          <div>
            <div style={{ color: "var(--color-mute)", fontSize: "9px" }}>SPP (psi)</div>
            <div>{formatVal(getMeasurementValue("standpipe_pressure"))}</div>
          </div>
          <div>
            <div style={{ color: "var(--color-mute)", fontSize: "9px" }}>FLOW (gpm)</div>
            <div>{formatVal(getMeasurementValue("flow_rate"))}</div>
          </div>
          <div>
            <div style={{ color: "var(--color-mute)", fontSize: "9px" }}>HKLD (klbs)</div>
            <div>{formatVal(getMeasurementValue("hookload"))}</div>
          </div>
          <div>
            <div style={{ color: "var(--color-mute)", fontSize: "9px" }}>TORQUE (kft-lb)</div>
            <div>{formatVal(getMeasurementValue("torque"))}</div>
          </div>
        </div>
      </Html>
    </>
  );
}

// ── Loading fallback ────────────────────────────────────────
function ModelLoader() {
  return (
    <Html center>
      <div
        style={{
          color: "rgba(234,240,238,0.5)",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "11px",
          whiteSpace: "nowrap",
        }}
      >
        Building rig…
      </div>
    </Html>
  );
}

// ── ErrorBoundary ───────────────────────────────────────────
class ViewportErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "rgba(234,240,238,0.4)" }}>3D context unavailable</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "rgba(234,240,238,0.25)" }}>WebGL may not be supported</span>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Main export ─────────────────────────────────────────────
export default function WellViewport3D({
  wellId = "WELL-1",
  riskScore = null,
  depth = null,
  telemetry = null,
  simulationState = null,
  height = 420,
}) {
  const playing = simulationState?.status === "PLAYING";
  const containerRef = useRef(null);
  const [narrow, setNarrow] = useState(false);

  // Hide 3D callouts when the viewport is too tight for them
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setNarrow(entry.contentRect.width < 560);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: `clamp(280px, 58vw, ${height}px)`,
        background: "transparent",
      }}
    >
      <StatusOverlay
        status={simulationState?.status}
        wellId={wellId}
        riskScore={riskScore}
      />
      {!narrow && (
        <div
          style={{
            position: "absolute",
            bottom: 10,
            right: 12,
            zIndex: 2,
            color: "rgba(234,240,238,0.3)",
            fontFamily: "'Inter', sans-serif",
            fontSize: "10px",
            pointerEvents: "none",
          }}
        >
          drag · scroll
        </div>
      )}

      <ViewportErrorBoundary>
        <Canvas
          camera={{ position: [6.5, 5, 8.5], fov: 35, near: 0.1, far: 500 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          style={{ background: "transparent" }}
        >
          <SceneLighting riskScore={riskScore} />
          {!narrow && <TelemetryCallouts telemetry={telemetry} />}

          <Suspense fallback={<ModelLoader />}>
            <Center>
              <LoadedWellModel playing={playing} riskScore={riskScore} />
            </Center>
          </Suspense>

          <OrbitControls
            enablePan={!narrow}
            minDistance={4}
            maxDistance={60}
            maxPolarAngle={Math.PI * 0.88}
            dampingFactor={0.1}
            enableDamping
          />
        </Canvas>
      </ViewportErrorBoundary>
    </div>
  );
}
