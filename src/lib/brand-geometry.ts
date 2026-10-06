// Geometria do "S" da Spolaor: as três fitas do símbolo, em coordenadas normalizadas (0..1).
// Usada pelo hero (canvas) e pelos traços da marca em SVG, para que tudo saia do mesmo desenho.

export type V = [number, number];
export type Seg = [V, V, V, V];

// Espinha do S, em coordenadas normalizadas (0..1) da área do desenho.
export const SPINE: Seg[] = [
  [[0.97, 0.07], [0.62, 0.02], [0.2, 0.1], [0.24, 0.33]],
  [[0.24, 0.33], [0.28, 0.53], [0.82, 0.47], [0.82, 0.69]],
  [[0.82, 0.69], [0.82, 0.9], [0.56, 0.98], [0.3, 0.97]],
];
// Fita laranja: sai do lado interno do S e termina em gancho, como no símbolo.
export const LEAK: Seg[] = [
  [[0.3, 0.44], [0.12, 0.5], [0.08, 0.66], [0.2, 0.76]],
  [[0.2, 0.76], [0.28, 0.82], [0.36, 0.78], [0.34, 0.86]],
];
export const BRANCH_T = 0.4; // ponto da espinha onde um contato pode escapar
export const LANES = [-1, 0, 1];

export function bez(s: Seg, t: number): V {
  const u = 1 - t;
  return [
    u * u * u * s[0][0] + 3 * u * u * t * s[1][0] + 3 * u * t * t * s[2][0] + t * t * t * s[3][0],
    u * u * u * s[0][1] + 3 * u * u * t * s[1][1] + 3 * u * t * t * s[2][1] + t * t * t * s[3][1],
  ];
}

// Amostra uma cadeia de beziers em pontos (já em pixels) com normais, para desenho e partículas.
export function sample(chain: Seg[], w: number, h: number, n: number) {
  const pts: V[] = [];
  for (let i = 0; i <= n; i++) {
    const g = (i / n) * chain.length;
    const k = Math.min(chain.length - 1, Math.floor(g));
    const p = bez(chain[k], g - k);
    pts.push([p[0] * w, p[1] * h]);
  }
  const nor: V[] = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  });
  return { pts, nor };
}

export type Track = ReturnType<typeof sample>;

export function at(tr: Track, t: number, off = 0): V {
  const f = Math.max(0, Math.min(1, t)) * (tr.pts.length - 1);
  const i = Math.floor(f);
  const j = Math.min(tr.pts.length - 1, i + 1);
  const k = f - i;
  const x = tr.pts[i][0] + (tr.pts[j][0] - tr.pts[i][0]) * k;
  const y = tr.pts[i][1] + (tr.pts[j][1] - tr.pts[i][1]) * k;
  return [x + tr.nor[i][0] * off, y + tr.nor[i][1] * off];
}

