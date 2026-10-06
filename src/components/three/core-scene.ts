import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  LineSegments,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from "three";

// Metáfora visual da Spolaor: a operação de uma empresa.
// progress = 0 → dados soltos, nós desconectados, leads "vazando" em laranja (perda).
// progress = 1 → os mesmos pontos se organizam em órbitas, os nós se conectam em rede
//                e pulsos ciano correm pelas conexões (processos automatizados, fluxo).

const R = 1.75;

// Deriva usada pelos nós e pelas linhas: precisa ser idêntica nos dois shaders.
const drift = /* glsl */ `
  vec3 drift(vec3 base, float seed, float t, float amount) {
    return base + vec3(
      sin(t * 0.42 + seed * 6.2831),
      cos(t * 0.35 + seed * 4.1),
      sin(t * 0.29 + seed * 9.7)
    ) * amount;
  }
`;

// ── Partículas (informação) ────────────────────────────────────────────────
const particleVertex = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uPixelRatio;
  uniform float uSize;
  attribute vec3 aGrid;
  attribute float aLeak;
  attribute float aSeed;
  varying float vAlpha;
  varying float vLeak;
  varying float vOrder;
  varying float vSeed;
  varying float vHeight;

  void main() {
    float t = uTime;
    float order = smoothstep(0.0, 1.0, uProgress);
    vec3 p = position;
    // dispersão: ruído amplo quando desorganizado
    float n = sin(p.x * 2.3 + t * 0.6 + aSeed * 6.2831) * 0.5
            + sin(p.y * 3.1 - t * 0.45 + aSeed * 3.0) * 0.35
            + sin(p.z * 2.7 + t * 0.35) * 0.25;
    p += normalize(p) * n * mix(0.22, 0.04, order);

    // vazamento: leads que saem e se perdem (só no estado desorganizado)
    float leakOn = step(0.82, aLeak) * (1.0 - smoothstep(0.0, 0.5, uProgress));
    float lt = fract(t * (0.05 + aSeed * 0.07) + aSeed * 17.0);
    vec3 dir = normalize(normalize(p) + vec3(0.6, -0.4, 0.3));
    p += dir * (lt * lt) * 3.2 * leakOn;

    // organização: órbitas de latitude girando em sentidos alternados
    vec3 g = aGrid;
    float ringSpin = t * 0.14 * (mod(floor(aSeed * 10.0), 2.0) * 2.0 - 1.0);
    float c = cos(ringSpin), s = sin(ringSpin);
    g.xz = mat2(c, -s, s, c) * g.xz;

    vec3 target = mix(p, g, order);
    vec4 mv = modelViewMatrix * vec4(target, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = uSize * (0.5 + aSeed * 0.85) * mix(1.0, 0.82, order);
    size *= mix(1.0, 1.7, leakOn);
    gl_PointSize = size * uPixelRatio / -mv.z;

    vAlpha = mix(mix(0.55, 1.0, order), 1.0 - lt, leakOn);
    vLeak = leakOn;
    vOrder = order;
    vSeed = aSeed;
    vHeight = clamp(g.y / ${R.toFixed(2)} * 0.5 + 0.5, 0.0, 1.0);
  }
`;

const particleFragment = /* glsl */ `
  varying float vAlpha;
  varying float vLeak;
  varying float vOrder;
  varying float vSeed;
  varying float vHeight;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = pow(smoothstep(0.5, 0.0, d), 1.6);
    vec3 loose = mix(vec3(0.30, 0.40, 0.62), vec3(0.58, 0.68, 0.88), vSeed);
    vec3 orange = vec3(1.0, 0.54, 0.12);
    vec3 royal = vec3(0.12, 0.36, 1.0);
    vec3 cyan = vec3(0.13, 0.83, 1.0);
    vec3 organized = mix(royal, cyan, vHeight);
    organized = mix(organized, vec3(0.85, 0.95, 1.0), step(0.93, vSeed) * 0.6);
    organized = mix(organized, orange, step(0.985, vSeed));
    vec3 col = mix(loose, orange, vLeak);
    col = mix(col, organized, vOrder * (1.0 - vLeak));
    gl_FragColor = vec4(col * 1.15, a * vAlpha);
  }
`;

// ── Nós (leads, processos, sistemas) ───────────────────────────────────────
const nodeVertex = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uPixelRatio;
  uniform float uSize;
  attribute vec3 aChaos;
  attribute float aSeed;
  attribute float aAlert;
  varying float vOrder;
  varying float vAlert;
  varying float vPulse;
  ${drift}

  void main() {
    float order = smoothstep(0.0, 1.0, uProgress);
    vec3 loose = drift(aChaos, aSeed, uTime, 0.22);
    vec3 p = mix(loose, position, order);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float pulse = 0.5 + 0.5 * sin(uTime * (1.6 + aSeed) + aSeed * 20.0);
    gl_PointSize = uSize * (0.9 + 0.35 * pulse) * uPixelRatio / -mv.z;
    vOrder = order;
    vAlert = aAlert;
    vPulse = pulse;
  }
`;

const nodeFragment = /* glsl */ `
  varying float vOrder;
  varying float vAlert;
  varying float vPulse;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.16, 0.0, d);
    float halo = pow(smoothstep(0.5, 0.0, d), 2.2);
    // desorganizado: nós de alerta em laranja, os demais apagados
    vec3 idle = mix(vec3(0.42, 0.52, 0.72), vec3(1.0, 0.54, 0.12), vAlert);
    float idleA = mix(0.45, 0.6 + 0.4 * vPulse, vAlert);
    // organizado: todos conectados, em ciano
    vec3 live = vec3(0.2, 0.85, 1.0);
    vec3 col = mix(idle, live, vOrder);
    float alpha = mix(idleA, 0.95, vOrder);
    gl_FragColor = vec4(col * (halo * 1.1) + vec3(core * 0.9), (halo + core) * alpha);
  }
`;

// ── Conexões e fluxos ──────────────────────────────────────────────────────
const lineVertex = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  attribute vec3 aChaos;
  attribute float aSeed;
  attribute float aT;
  attribute float aOff;
  varying float vT;
  varying float vOff;
  varying float vOrder;
  ${drift}

  void main() {
    float order = smoothstep(0.0, 1.0, uProgress);
    vec3 loose = drift(aChaos, aSeed, uTime, 0.22);
    vec3 p = mix(loose, position, order);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    vT = aT;
    vOff = aOff;
    vOrder = order;
  }
`;

const lineFragment = /* glsl */ `
  uniform float uTime;
  varying float vT;
  varying float vOff;
  varying float vOrder;

  void main() {
    float on = smoothstep(0.3, 0.85, vOrder);
    float head = fract(uTime * (0.22 + vOff * 0.25) + vOff * 7.0);
    float dir = step(0.5, fract(vOff * 13.0));
    float t = mix(vT, 1.0 - vT, dir);
    float pulse = smoothstep(0.12, 0.0, abs(t - head)) * step(0.35, fract(vOff * 5.3));
    vec3 base = vec3(0.16, 0.42, 1.0);
    vec3 glow = vec3(0.45, 0.92, 1.0);
    vec3 col = base * 0.55 + glow * pulse * 1.4;
    gl_FragColor = vec4(col, on * (0.22 + pulse * 0.78));
  }
`;

export type CoreSceneOptions = { count: number; dpr: number; fps?: number };

export function createCoreScene(canvas: HTMLCanvasElement, opts: CoreSceneOptions) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(opts.dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.set(0, 0, 7.2);

  const group = new Group();
  group.rotation.z = -0.18;
  scene.add(group);

  // ── partículas ──
  const N = opts.count;
  const pos = new Float32Array(N * 3);
  const grid = new Float32Array(N * 3);
  const leak = new Float32Array(N);
  const seed = new Float32Array(N);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const rings = 20;
  const perRing = Math.ceil(N / rings);

  for (let i = 0; i < N; i++) {
    // Desorganizado: nuvem espessa e irregular
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const spread = 0.55 + Math.pow(Math.random(), 0.7) * 0.85;
    pos[i * 3] = Math.cos(th) * r * R * spread;
    pos[i * 3 + 1] = y * R * spread;
    pos[i * 3 + 2] = Math.sin(th) * r * R * spread;

    // Organizado: órbitas de latitude igualmente espaçadas
    const ring = i % rings;
    const k = Math.floor(i / rings);
    const phi = (Math.PI * (ring + 0.5)) / rings;
    const ang = (k / perRing) * Math.PI * 2;
    grid[i * 3] = Math.sin(phi) * Math.cos(ang) * R;
    grid[i * 3 + 1] = Math.cos(phi) * R;
    grid[i * 3 + 2] = Math.sin(phi) * Math.sin(ang) * R;

    leak[i] = Math.random();
    seed[i] = Math.random();
  }

  const pGeo = new BufferGeometry();
  pGeo.setAttribute("position", new BufferAttribute(pos, 3));
  pGeo.setAttribute("aGrid", new BufferAttribute(grid, 3));
  pGeo.setAttribute("aLeak", new BufferAttribute(leak, 1));
  pGeo.setAttribute("aSeed", new BufferAttribute(seed, 1));

  const shared = {
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uPixelRatio: { value: opts.dpr },
  };

  const pMat = new ShaderMaterial({
    vertexShader: particleVertex,
    fragmentShader: particleFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { ...shared, uSize: { value: 30 } },
  });
  group.add(new Points(pGeo, pMat));

  // ── nós ──
  const H = N > 5000 ? 84 : 56;
  const hubOrder = new Float32Array(H * 3);
  const hubChaos = new Float32Array(H * 3);
  const hubSeed = new Float32Array(H);
  const hubAlert = new Float32Array(H);
  const RH = R * 1.04;
  for (let i = 0; i < H; i++) {
    const y = 1 - ((i + 0.5) / H) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i * 1.0003;
    hubOrder[i * 3] = Math.cos(th) * r * RH;
    hubOrder[i * 3 + 1] = y * RH;
    hubOrder[i * 3 + 2] = Math.sin(th) * r * RH;
    // posição solta: espalhada num volume maior, sem relação com os vizinhos
    const u = Math.random() * 2 - 1;
    const a = Math.random() * Math.PI * 2;
    const rr = R * (0.6 + Math.random() * 0.95);
    const s = Math.sqrt(1 - u * u);
    hubChaos[i * 3] = Math.cos(a) * s * rr * 1.15;
    hubChaos[i * 3 + 1] = u * rr;
    hubChaos[i * 3 + 2] = Math.sin(a) * s * rr;
    hubSeed[i] = Math.random();
    hubAlert[i] = Math.random() < 0.34 ? 1 : 0;
  }

  const nGeo = new BufferGeometry();
  nGeo.setAttribute("position", new BufferAttribute(hubOrder, 3));
  nGeo.setAttribute("aChaos", new BufferAttribute(hubChaos, 3));
  nGeo.setAttribute("aSeed", new BufferAttribute(hubSeed, 1));
  nGeo.setAttribute("aAlert", new BufferAttribute(hubAlert, 1));
  const nMat = new ShaderMaterial({
    vertexShader: nodeVertex,
    fragmentShader: nodeFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { ...shared, uSize: { value: 120 } },
  });
  group.add(new Points(nGeo, nMat));

  // ── conexões: cada nó liga aos 3 vizinhos mais próximos na forma organizada ──
  const edges: [number, number][] = [];
  const seen = new Set<string>();
  for (let i = 0; i < H; i++) {
    const d: [number, number][] = [];
    for (let j = 0; j < H; j++) {
      if (i === j) continue;
      const dx = hubOrder[i * 3] - hubOrder[j * 3];
      const dy = hubOrder[i * 3 + 1] - hubOrder[j * 3 + 1];
      const dz = hubOrder[i * 3 + 2] - hubOrder[j * 3 + 2];
      d.push([dx * dx + dy * dy + dz * dz, j]);
    }
    d.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < 3; k++) {
      const j = d[k][1];
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([i, j]);
      }
    }
  }

  const E = edges.length;
  const lPos = new Float32Array(E * 6);
  const lChaos = new Float32Array(E * 6);
  const lSeed = new Float32Array(E * 2);
  const lT = new Float32Array(E * 2);
  const lOff = new Float32Array(E * 2);
  edges.forEach(([a, b], e) => {
    const off = Math.random();
    [a, b].forEach((h, v) => {
      const o = e * 2 + v;
      for (let c = 0; c < 3; c++) {
        lPos[o * 3 + c] = hubOrder[h * 3 + c];
        lChaos[o * 3 + c] = hubChaos[h * 3 + c];
      }
      lSeed[o] = hubSeed[h];
      lT[o] = v;
      lOff[o] = off;
    });
  });

  const lGeo = new BufferGeometry();
  lGeo.setAttribute("position", new BufferAttribute(lPos, 3));
  lGeo.setAttribute("aChaos", new BufferAttribute(lChaos, 3));
  lGeo.setAttribute("aSeed", new BufferAttribute(lSeed, 1));
  lGeo.setAttribute("aT", new BufferAttribute(lT, 1));
  lGeo.setAttribute("aOff", new BufferAttribute(lOff, 1));
  const lMat = new ShaderMaterial({
    vertexShader: lineVertex,
    fragmentShader: lineFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: shared.uTime, uProgress: shared.uProgress },
  });
  group.add(new LineSegments(lGeo, lMat));

  let target = { x: 0, y: 0, progress: 0 };
  const current = { x: 0, y: 0, progress: 0 };
  let raf = 0;
  let running = false;
  let last = performance.now();
  let elapsed = 0;

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = w / h < 0.9 ? 9.4 : 7.2;
    camera.updateProjectionMatrix();
  }

  const minFrame = 1000 / (opts.fps ?? 60) - 2;

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (now - last < minFrame) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    elapsed += dt;
    current.x += (target.x - current.x) * 0.05;
    current.y += (target.y - current.y) * 0.05;
    current.progress += (target.progress - current.progress) * 0.06;
    shared.uTime.value = elapsed;
    shared.uProgress.value = current.progress;
    group.rotation.y = elapsed * (0.05 + current.progress * 0.04) + current.x * 0.35;
    group.rotation.x = current.y * 0.25 + current.progress * 0.3;
    renderer.render(scene, camera);
  }

  resize();

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    setPointer(x: number, y: number) {
      target = { ...target, x, y };
    },
    setProgress(p: number) {
      target = { ...target, progress: p };
    },
    renderOnce() {
      renderer.render(scene, camera);
    },
    resize,
    dispose() {
      cancelAnimationFrame(raf);
      pGeo.dispose();
      pMat.dispose();
      nGeo.dispose();
      nMat.dispose();
      lGeo.dispose();
      lMat.dispose();
      renderer.dispose();
    },
  };
}
