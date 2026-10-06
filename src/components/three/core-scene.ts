import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from "three";

// Núcleo de partículas: uma esfera ruidosa com partículas "vazando" (o prejuízo invisível)
// que, conforme o scroll avança, se organiza em anéis perfeitos (a tecnologia colocando ordem).

const vertex = /* glsl */ `
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

  void main() {
    vec3 p = position;
    float t = uTime;
    float n = sin(p.x * 2.3 + t * 0.7 + aSeed * 6.2831) * 0.5
            + sin(p.y * 3.1 - t * 0.55 + aSeed * 3.0) * 0.35
            + sin(p.z * 2.7 + t * 0.4) * 0.25;
    p += normalize(p) * n * 0.085;

    float order = smoothstep(0.0, 1.0, uProgress);
    float side = smoothstep(-0.2, 0.9, dot(normalize(position), normalize(vec3(0.8, -0.5, 0.4))));
    float leakOn = step(0.8, aLeak) * side * (1.0 - smoothstep(0.0, 0.45, uProgress));
    float lt = fract(t * (0.05 + aSeed * 0.07) + aSeed * 17.0);
    vec3 dir = normalize(normalize(p) + vec3(0.55, -0.35, 0.25));
    p += dir * (lt * lt) * 3.4 * leakOn;

    vec3 g = aGrid;
    float ringSpin = t * 0.12 * (mod(floor(aSeed * 10.0), 2.0) * 2.0 - 1.0);
    float c = cos(ringSpin), s = sin(ringSpin);
    g.xz = mat2(c, -s, s, c) * g.xz;

    vec3 target = mix(p, g, order);
    vec4 mv = modelViewMatrix * vec4(target, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = uSize * (0.55 + aSeed * 0.9) * mix(1.0, 0.8, order);
    size *= mix(1.0, 1.6, leakOn);
    gl_PointSize = size * uPixelRatio / -mv.z;

    vAlpha = mix(1.0, 1.0 - lt, leakOn);
    vLeak = leakOn;
    vOrder = order;
    vSeed = aSeed;
  }
`;

const fragment = /* glsl */ `
  varying float vAlpha;
  varying float vLeak;
  varying float vOrder;
  varying float vSeed;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float a = smoothstep(0.5, 0.0, d);
    a = pow(a, 1.6);
    vec3 cool = mix(vec3(0.62, 0.70, 0.86), vec3(0.95, 0.96, 1.0), vSeed);
    vec3 ember = vec3(1.0, 0.42, 0.24);
    vec3 signal = vec3(0.84, 1.0, 0.23);
    vec3 col = mix(cool, ember, vLeak);
    col = mix(col, mix(cool, signal, step(0.86, vSeed)), vOrder);
    gl_FragColor = vec4(col * 1.15, a * vAlpha);
  }
`;

export type CoreSceneOptions = { count: number; dpr: number; fps?: number };

export function createCoreScene(canvas: HTMLCanvasElement, opts: CoreSceneOptions) {
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(opts.dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.set(0, 0, 7.2);

  const N = opts.count;
  const R = 1.75;
  const pos = new Float32Array(N * 3);
  const grid = new Float32Array(N * 3);
  const leak = new Float32Array(N);
  const seed = new Float32Array(N);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const rings = 22;
  const perRing = Math.ceil(N / rings);

  for (let i = 0; i < N; i++) {
    // Esfera de Fibonacci com espessura irregular
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const jitter = 1 + (Math.random() - 0.5) * 0.22;
    pos[i * 3] = Math.cos(th) * r * R * jitter;
    pos[i * 3 + 1] = y * R * jitter;
    pos[i * 3 + 2] = Math.sin(th) * r * R * jitter;

    // Alvo ordenado: anéis de latitude igualmente espaçados
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

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(pos, 3));
  geometry.setAttribute("aGrid", new BufferAttribute(grid, 3));
  geometry.setAttribute("aLeak", new BufferAttribute(leak, 1));
  geometry.setAttribute("aSeed", new BufferAttribute(seed, 1));

  const material = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uPixelRatio: { value: opts.dpr },
      uSize: { value: 34 },
    },
  });

  const points = new Points(geometry, material);
  points.rotation.z = -0.18;
  scene.add(points);

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
    current.progress += (target.progress - current.progress) * 0.08;
    material.uniforms.uTime.value = elapsed;
    material.uniforms.uProgress.value = current.progress;
    points.rotation.y = elapsed * 0.07 + current.x * 0.35;
    points.rotation.x = current.y * 0.25 + current.progress * 0.35;
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
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
