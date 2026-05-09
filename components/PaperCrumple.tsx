"use client";

// React Three Fiber drives shader uniforms by mutating `.value` inside the
// render-loop callback (`useFrame`). That's not a React render, so the
// no-mutate-after-render rule doesn't apply here — disable it for this file.
/* eslint-disable react-hooks/immutability */

/**
 * PaperCrumple — high-fidelity paper crumbling effect with React Three Fiber.
 *
 * How it works:
 *   - A high-density PlaneGeometry (64 x 64 segments) gives us enough vertices
 *     to deform smoothly.
 *   - A custom ShaderMaterial drives the displacement in the vertex shader.
 *     We sum three octaves of 3D simplex noise. The amplitude and the
 *     frequency are scaled by `uCrumple` (0..1) so a low value gives gentle
 *     ripples and a high value produces sharp jagged folds.
 *   - As `uCrumple` rises we *also* contract every vertex's xy position
 *     toward the center. Combined with the noise displacement that turns the
 *     flat sheet into a tightly wadded ball.
 *   - We compute a per-vertex normal analytically by sampling the displacement
 *     at two offset positions and taking the cross product, so the fragment
 *     shader receives accurate normals and the directional light catches the
 *     creases the way real paper would.
 *   - The fragment shader runs a simple Lambert + ambient + rim model and
 *     overlays a value-noise "fiber" texture for that off-white organic look.
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";

type PaperProps = {
  /** 0 = flat sheet, 1 = fully crumpled ball */
  crumple: number;
  color?: string;
  /** spring stiffness for the crumple value (higher = snappier) */
  ease?: number;
};

const VERTEX_SHADER = /* glsl */ `
  uniform float uCrumple;
  uniform float uTime;

  varying vec3 vNormal;
  varying vec3 vPos;
  varying vec2 vUv;
  varying float vCrumple;

  // ---- Ashima 3D simplex noise (public domain) ----
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.0-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
      +i.y+vec4(0.0,i1.y,i2.y,1.0))
      +i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;
    vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
  // ---------------------------------------------------

  // Returns the crumpled position for any base position p.
  // The same function is sampled at neighboring points to derive normals.
  vec3 displaceFn(vec3 p, float c) {
    // contract edges toward the center as crumple rises (the ball forms)
    vec2 toCenter = -p.xy;
    p.xy += toCenter * c * 0.55;

    // multi-octave simplex noise — frequencies and amplitudes ramp up with c
    float freq = mix(2.0, 7.0, c);
    float amp  = mix(0.02, 0.55, c);

    float n = 0.0;
    n += snoise(p * freq + uTime * 0.03) * 1.0;
    n += snoise(p * (freq * 2.1) + 7.31) * 0.55;
    n += snoise(p * (freq * 4.3) + 13.0) * 0.30;

    // Sharper folds at high crumple — bias toward extrema
    float sharp = mix(1.0, 2.4, c);
    n = sign(n) * pow(abs(n), 1.0 / sharp);

    p.z += n * amp;

    // pull a touch in z too so the ball has volume on both sides
    p.z += (snoise(p * 5.0 + 21.0)) * c * 0.18;

    return p;
  }

  void main() {
    vec3 base = position;
    vec3 displaced = displaceFn(base, uCrumple);

    // analytical normal via finite differences
    float eps = 0.015;
    vec3 dx = displaceFn(base + vec3(eps, 0.0, 0.0), uCrumple) - displaced;
    vec3 dy = displaceFn(base + vec3(0.0, eps, 0.0), uCrumple) - displaced;
    vec3 n  = normalize(cross(dx, dy));

    vNormal = normalize(normalMatrix * n);
    vPos    = (modelViewMatrix * vec4(displaced, 1.0)).xyz;
    vUv     = uv;
    vCrumple = uCrumple;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uLightDir;

  varying vec3 vNormal;
  varying vec3 vPos;
  varying vec2 vUv;
  varying float vCrumple;

  // Lightweight 2D value noise for paper fibers
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1,0));
    float c = hash(i + vec2(0,1));
    float d = hash(i + vec2(1,1));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(-vPos);

    // light both sides — paper is thin and gets backlit a little
    float diff = mix(max(dot(N, L), 0.0), max(dot(-N, L), 0.0) * 0.45,
                     step(dot(N, L), 0.0));
    float ambient = 0.55;

    // soft specular for paper sheen
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 24.0) * 0.18;

    // rim adds a subtle edge glow that reads as paper translucency
    float rim = pow(1.0 - max(dot(N, V), 0.0), 2.5) * 0.18;

    // organic paper grain
    float grain = vnoise(vUv * 280.0) * 0.06 - 0.03;
    float fibers = vnoise(vUv * 60.0) * 0.05 - 0.025;

    vec3 col = uColor * (ambient + diff * 0.8) + spec + rim + grain + fibers;

    // shadowed creases: AO-like darkening where displacement is strongest
    float crease = smoothstep(0.4, 0.95, 1.0 - max(dot(N, vec3(0.0, 0.0, 1.0)), 0.0));
    col -= crease * vCrumple * 0.18;

    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * The paper plane itself. Re-creates the shader material once and updates
 * uniforms each frame; the crumple value is spring-eased toward `target`
 * for a satisfying snap.
 */
function Paper({
  target,
  color = "#fbf3df",
  ease = 4.5,
}: {
  target: number;
  color?: string;
  ease: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  // Lazy-initialized uniforms — created once, then mutated freely inside
  // useFrame. Using useState's initializer keeps React's purity lint happy
  // while still giving us a stable mutable object.
  const [uniforms] = useState(() => ({
    uCrumple: { value: 0 },
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uLightDir: { value: new THREE.Vector3(0.4, 0.7, 0.8).normalize() },
  }));

  // Spring-ease the crumple uniform toward the target each frame.
  useFrame((_, dt) => {
    const u = uniforms.uCrumple;
    u.value += (target - u.value) * Math.min(1, dt * ease);
    uniforms.uTime.value += dt;
    const mesh = meshRef.current;
    if (mesh) {
      // a little rotational drift while crumpling adds life
      mesh.rotation.z += dt * 0.4 * u.value;
      mesh.rotation.x = Math.sin(uniforms.uTime.value * 0.6) * 0.06;
    }
  });

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      {/* High-density plane: 64x64 segments → 4225 vertices to deform. */}
      <planeGeometry args={[2, 2.6, 64, 64]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default function PaperCrumple({
  crumple,
  color,
  ease = 4.5,
  className,
}: PaperProps & { className?: string }) {
  return (
    <div className={className} style={{ width: "100%", height: "100%" }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 3.4], fov: 38 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        {/* Lights are not strictly required — the shader does its own lambert
            calculation — but a hemisphere light helps if we ever swap to
            MeshStandardMaterial. */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[2, 3, 4]} intensity={1.0} />
        <Paper target={crumple} color={color} ease={ease} />
      </Canvas>
    </div>
  );
}
