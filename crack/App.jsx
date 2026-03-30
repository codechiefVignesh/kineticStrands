import { useEffect, useRef, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";

// ── Physics ──────────────────────────────────────────────────────────────────
function derivatives(state, p) {
  const [th1, w1, th2, w2] = state;
  const { m1, m2, L1, L2, g } = p;
  const d = th2 - th1;
  const sd = Math.sin(d), cd = Math.cos(d);
  const D1 = (m1 + m2) * L1 - m2 * L1 * cd * cd;
  const D2 = (L2 / L1) * D1;
  const dw1 = (m2*L1*w1*w1*sd*cd + m2*g*Math.sin(th2)*cd + m2*L2*w2*w2*sd - (m1+m2)*g*Math.sin(th1)) / D1;
  const dw2 = (-m2*L2*w2*w2*sd*cd + (m1+m2)*g*Math.sin(th1)*cd - (m1+m2)*L1*w1*w1*sd - (m1+m2)*g*Math.sin(th2)) / D2;
  return [w1, dw1, w2, dw2];
}
function rk4Step(state, p, dt) {
  const k1 = derivatives(state, p);
  const k2 = derivatives(state.map((v,i)=>v+0.5*dt*k1[i]), p);
  const k3 = derivatives(state.map((v,i)=>v+0.5*dt*k2[i]), p);
  const k4 = derivatives(state.map((v,i)=>v+dt*k3[i]), p);
  return state.map((v,i)=>v+(dt/6)*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));
}

// ── Trail line using BufferGeometry updated every frame ───────────────────────
function Trail({ points, color }) {
  const ref = useRef();
  const MAX = 2000;

  const positions = useMemo(() => new Float32Array(MAX * 3), []);
  const colors    = useMemo(() => new Float32Array(MAX * 3), []);

  useFrame(() => {
    if (!ref.current) return;
    const count = Math.min(points.current.length, MAX);
    const start = Math.max(0, points.current.length - MAX);
    const c = new THREE.Color(color);

    for (let i = 0; i < count; i++) {
      const pt = points.current[start + i];
      positions[i*3]   = pt.x;
      positions[i*3+1] = pt.y;
      positions[i*3+2] = pt.z;
      const t = i / count;
      colors[i*3]   = c.r * t;
      colors[i*3+1] = c.g * t;
      colors[i*3+2] = c.b * t + (1-t)*0.6;
    }
    ref.current.geometry.setAttribute("position", new THREE.BufferAttribute(positions.slice(0, count*3), 3));
    ref.current.geometry.setAttribute("color",    new THREE.BufferAttribute(colors.slice(0, count*3), 3));
    ref.current.geometry.setDrawRange(0, count);
    ref.current.geometry.attributes.position.needsUpdate = true;
    ref.current.geometry.attributes.color.needsUpdate    = true;
  });

  return (
    <line ref={ref}>
      <bufferGeometry />
      <lineBasicMaterial vertexColors transparent opacity={0.85} />
    </line>
  );
}

// ── Rod between two points ────────────────────────────────────────────────────
function Rod({ from, to, color, radius = 0.025 }) {
  const ref = useRef();
  useFrame(() => {
    if (!ref.current) return;
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    ref.current.position.copy(mid);
    ref.current.scale.set(1, len, 1);
    ref.current.quaternion.setFromUnitVectors(
      new THREE.Vector3(0,1,0),
      dir.clone().normalize()
    );
  });
  return (
    <mesh ref={ref}>
      <cylinderGeometry args={[radius, radius, 1, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.3} metalness={0.6} />
    </mesh>
  );
}

// ── Main simulation scene ─────────────────────────────────────────────────────
function PendulumScene({ paramsRef, stateRef, trailRef, pausedRef, speedRef, trailLenRef }) {
  const pivot   = new THREE.Vector3(0, 0, 0);
  const bob1Ref = useRef();
  const bob2Ref = useRef();
  const bob1Pos = useRef(new THREE.Vector3());
  const bob2Pos = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    if (!pausedRef.current) {
      const steps = Math.max(1, Math.round(speedRef.current * 4));
      for (let i = 0; i < steps; i++) {
        stateRef.current = rk4Step(stateRef.current, paramsRef.current, dt / steps);
      }
    }

    const [th1,,th2] = stateRef.current;
    const { L1, L2 } = paramsRef.current;

    // Pendulum hangs DOWN: pivot at y=0, bob hangs in -Y direction
    // x = L*sin(theta),  y = -L*cos(theta)  ← negative Y = downward
    const x1 = L1 * Math.sin(th1);
    const y1 = -L1 * Math.cos(th1);
    const x2 = x1 + L2 * Math.sin(th2);
    const y2 = y1 - L2 * Math.cos(th2);

    bob1Pos.current.set(x1, y1, 0);
    bob2Pos.current.set(x2, y2, 0);

    if (bob1Ref.current) bob1Ref.current.position.set(x1, y1, 0);
    if (bob2Ref.current) bob2Ref.current.position.set(x2, y2, 0);

    // Push trail point
    if (!pausedRef.current) {
      trailRef.current.push(bob2Pos.current.clone());
      if (trailRef.current.length > trailLenRef.current) trailRef.current.shift();
    }
  });

  return (
    <>
      {/* Ceiling plate */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[1.5, 0.08, 1.5]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.8} metalness={0.4} />
      </mesh>

      {/* Pivot bolt */}
      <mesh position={[0, 0, 0]} castShadow>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Rods — updated every frame via component */}
      <RodDynamic from={bob1Pos} to={{ current: new THREE.Vector3(0,0,0) }} pivot color="#60a5fa" />
      <RodDynamic from={bob2Pos} to={bob1Pos} color="#c084fc" />

      {/* Bob 1 */}
      <mesh ref={bob1Ref} castShadow>
        <sphereGeometry args={[0.1, 32, 32]} />
        <meshStandardMaterial color="#60a5fa" emissive="#1d4ed8" emissiveIntensity={0.5} roughness={0.2} metalness={0.5} />
      </mesh>
      {/* Bob 1 glow point light */}
      <Bob1Light bob1Ref={bob1Ref} />

      {/* Bob 2 */}
      <mesh ref={bob2Ref} castShadow>
        <sphereGeometry args={[0.09, 32, 32]} />
        <meshStandardMaterial color="#f472b6" emissive="#9d174d" emissiveIntensity={0.6} roughness={0.2} metalness={0.5} />
      </mesh>
      <Bob2Light bob2Ref={bob2Ref} />

      {/* Trail */}
      <Trail points={trailRef} color="#f472b6" />

      {/* Floor */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -4, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <MeshReflectorMaterial
          blur={[300, 100]} resolution={1024} mixBlur={0.8}
          mixStrength={40} roughness={1} depthScale={1.2}
          minDepthThreshold={0.4} maxDepthThreshold={1.4}
          color="#05050f" metalness={0.5}
        />
      </mesh>

      {/* Room walls — subtle */}
      <mesh position={[0, -2, -8]} receiveShadow>
        <planeGeometry args={[30, 12]} />
        <meshStandardMaterial color="#0a0a18" roughness={1} />
      </mesh>
    </>
  );
}

// Dynamic rod that reads from refs every frame
function RodDynamic({ from, to, pivot, color }) {
  const ref = useRef();
  useFrame(() => {
    if (!ref.current) return;
    const f = pivot ? new THREE.Vector3(0,0,0) : from.current;
    const t = pivot ? from.current : to.current;
    if (!f || !t) return;
    const dir = new THREE.Vector3().subVectors(t, f);
    const len = dir.length();
    if (len < 0.001) return;
    const mid = new THREE.Vector3().addVectors(f, t).multiplyScalar(0.5);
    ref.current.position.copy(mid);
    ref.current.scale.set(1, len, 1);
    ref.current.quaternion.setFromUnitVectors(
      new THREE.Vector3(0,1,0), dir.normalize()
    );
  });
  return (
    <mesh ref={ref}>
      <cylinderGeometry args={[0.025, 0.025, 1, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} roughness={0.3} metalness={0.7} />
    </mesh>
  );
}

function Bob1Light({ bob1Ref }) {
  const ref = useRef();
  useFrame(() => {
    if (ref.current && bob1Ref.current) ref.current.position.copy(bob1Ref.current.position);
  });
  return <pointLight ref={ref} color="#60a5fa" intensity={1.5} distance={4} />;
}
function Bob2Light({ bob2Ref }) {
  const ref = useRef();
  useFrame(() => {
    if (ref.current && bob2Ref.current) ref.current.position.copy(bob2Ref.current.position);
  });
  return <pointLight ref={ref} color="#f472b6" intensity={2} distance={5} />;
}

// ── Slider UI ─────────────────────────────────────────────────────────────────
function Slider({ label, name, value, min, max, step, unit, onChange }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3 }}>
        <span style={{ color:"#94a3b8" }}>{label}</span>
        <span style={{ color:"#a78bfa", fontFamily:"monospace" }}>{value}{unit}</span>
      </div>
      <input type="range" name={name} min={min} max={max} step={step} value={value}
        onChange={onChange} style={{ width:"100%", accentColor:"#7c3aed", cursor:"pointer" }} />
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const stateRef    = useRef([2.0, 0, 1.5, 0]);
  const trailRef    = useRef([]);
  const pausedRef   = useRef(false);
  const paramsRef   = useRef({ m1:1, m2:1, L1:1.2, L2:1, g:9.81 });
  const speedRef    = useRef(1);
  const trailLenRef = useRef(1500);

  const [params, setParams]         = useState({ m1:1, m2:1, L1:1.2, L2:1, g:9.81 });
  const [initAngles, setInitAngles] = useState({ theta1:2.0, theta2:1.5 });
  const [paused, setPaused]         = useState(false);
  const [speed, setSpeed]           = useState(1);
  const [trailLen, setTrailLen]     = useState(1500);

  // Sync refs
  useEffect(() => { paramsRef.current = params; }, [params]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { trailLenRef.current = trailLen; }, [trailLen]);

  const resetSim = (angles) => {
    const a = angles || initAngles;
    stateRef.current = [a.theta1, 0, a.theta2, 0];
    trailRef.current = [];
  };

  const handleParam = (e) => {
    const v = parseFloat(e.target.value);
    setParams(prev => ({ ...prev, [e.target.name]: v }));
  };

  const handleAngle = (e) => {
    const v = parseFloat(e.target.value);
    setInitAngles(prev => {
      const next = { ...prev, [e.target.name]: v };
      resetSim(next);
      return next;
    });
  };

  return (
    <div style={{ display:"flex", width:"100vw", height:"100vh", background:"#05050f", overflow:"hidden" }}>

      {/* ── Sidebar ── */}
      <div style={{
        width:264, minWidth:264, background:"rgba(8,6,20,0.97)",
        borderRight:"1px solid rgba(120,80,200,0.18)",
        padding:"18px 16px", overflowY:"auto",
        display:"flex", flexDirection:"column", gap:4,
        zIndex:10
      }}>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#a78bfa", letterSpacing:"0.1em", fontFamily:"monospace" }}>
            DOUBLE PENDULUM
          </div>
          <div style={{ fontSize:9, color:"#3d3660", fontFamily:"monospace", marginTop:3, letterSpacing:"0.08em" }}>
            LAGRANGIAN · RK4 · THREE.JS 3D
          </div>
        </div>

        <div style={{ fontSize:9, color:"#5a5490", fontFamily:"monospace", marginBottom:6, letterSpacing:"0.12em" }}>
          — INITIAL CONDITIONS —
        </div>
        <Slider label="θ₁" name="theta1" value={initAngles.theta1} min={-3.14} max={3.14} step={0.05} unit=" rad" onChange={handleAngle}/>
        <Slider label="θ₂" name="theta2" value={initAngles.theta2} min={-3.14} max={3.14} step={0.05} unit=" rad" onChange={handleAngle}/>

        <div style={{ borderTop:"1px solid rgba(100,60,200,0.12)", margin:"8px 0 6px" }}/>
        <div style={{ fontSize:9, color:"#5a5490", fontFamily:"monospace", marginBottom:6, letterSpacing:"0.12em" }}>
          — PHYSICAL PARAMETERS —
        </div>
        <Slider label="Mass 1 (m₁)" name="m1" value={params.m1} min={0.1} max={5} step={0.1} unit=" kg" onChange={handleParam}/>
        <Slider label="Mass 2 (m₂)" name="m2" value={params.m2} min={0.1} max={5} step={0.1} unit=" kg" onChange={handleParam}/>
        <Slider label="Length 1 (L₁)" name="L1" value={params.L1} min={0.2} max={2.5} step={0.1} unit=" m" onChange={handleParam}/>
        <Slider label="Length 2 (L₂)" name="L2" value={params.L2} min={0.2} max={2.5} step={0.1} unit=" m" onChange={handleParam}/>
        <Slider label="Gravity (g)" name="g" value={params.g} min={0.5} max={25} step={0.1} unit=" m/s²" onChange={handleParam}/>

        <div style={{ borderTop:"1px solid rgba(100,60,200,0.12)", margin:"8px 0 6px" }}/>
        <div style={{ fontSize:9, color:"#5a5490", fontFamily:"monospace", marginBottom:6, letterSpacing:"0.12em" }}>
          — SIMULATION —
        </div>
        <Slider label="Speed" value={speed} min={0.25} max={4} step={0.25} unit="x"
          onChange={e => setSpeed(parseFloat(e.target.value))} name="speed"/>
        <Slider label="Trail length" value={trailLen} min={200} max={3000} step={100} unit=" pts"
          onChange={e => setTrailLen(parseInt(e.target.value))} name="trail"/>

        <div style={{ display:"flex", gap:8, marginTop:10 }}>
          <button onClick={() => setPaused(p => !p)} style={{
            flex:1, padding:"8px 0",
            background: paused ? "rgba(124,58,237,0.2)" : "transparent",
            color: paused ? "#a78bfa" : "#5a5490",
            border:"1px solid rgba(100,60,200,0.25)", borderRadius:6,
            cursor:"pointer", fontSize:11, fontFamily:"monospace", letterSpacing:"0.05em"
          }}>{paused ? "▶ RESUME" : "⏸ PAUSE"}</button>
          <button onClick={() => resetSim()} style={{
            flex:1, padding:"8px 0", background:"transparent",
            color:"#5a5490", border:"1px solid rgba(100,60,200,0.15)",
            borderRadius:6, cursor:"pointer", fontSize:11, fontFamily:"monospace"
          }}>↺ RESET</button>
        </div>

        <div style={{ marginTop:"auto", paddingTop:20, fontSize:9, color:"#2d2850",
          fontFamily:"monospace", lineHeight:1.9, letterSpacing:"0.04em" }}>
          LEFT DRAG — orbit camera<br/>
          RIGHT DRAG — pan<br/>
          SCROLL — zoom<br/>
          θ sliders reset trail
        </div>
      </div>

      {/* ── 3D Canvas ── */}
      <div style={{ flex:1, position:"relative" }}>
        <Canvas
          shadows
          camera={{ position: [0, -1, 5], fov: 50, near: 0.1, far: 100 }}
          style={{ background:"#05050f" }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
        >
          {/* Lighting */}
          <ambientLight intensity={0.15} />
          <spotLight
            position={[0, 3, 0]} angle={0.6} penumbra={0.8}
            intensity={2} castShadow color="#8b7cf8"
            shadow-mapSize={[1024,1024]}
          />
          <pointLight position={[3, 2, 3]} intensity={0.4} color="#3b4fd4" />
          <pointLight position={[-3, 2, -2]} intensity={0.3} color="#4d1e7a" />

          <PendulumScene
            paramsRef={paramsRef}
            stateRef={stateRef}
            trailRef={trailRef}
            pausedRef={pausedRef}
            speedRef={speedRef}
            trailLenRef={trailLenRef}
          />

          {/* OrbitControls — left drag orbits, right drag pans, scroll zooms */}
          <OrbitControls
            makeDefault
            enableDamping dampingFactor={0.08}
            minDistance={1.5} maxDistance={14}
            target={[0, -1.5, 0]}
          />
        </Canvas>

        {/* Overlay hint */}
        <div style={{
          position:"absolute", bottom:16, right:20,
          fontSize:10, color:"rgba(100,80,160,0.5)",
          fontFamily:"monospace", textAlign:"right", pointerEvents:"none"
        }}>
          drag to orbit · scroll to zoom
        </div>
      </div>
    </div>
  );
}