// Gera as versões WebP (com canal alpha) das ilustrações de serviço a partir dos PNGs originais
// em assets/ilustracoes. Só recorta a margem 100% transparente (mais 12 px de folga); o alpha
// e as bordas não são alterados. Uso: node scripts/ilustracoes.mjs
import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
const sharp = createRequire(import.meta.url)("sharp");

const src = "assets/ilustracoes";
const out = "public/ilustracoes";
const PAD = 12;

for (const f of readdirSync(src).filter((n) => n.endsWith(".png"))) {
  const img = sharp(`${src}/${f}`);
  const { width, height } = await img.metadata();
  const { data } = await img.clone().ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[y * width + x] > 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const left = Math.max(0, x0 - PAD), top = Math.max(0, y0 - PAD);
  const w = Math.min(width, x1 + PAD + 1) - left, h = Math.min(height, y1 + PAD + 1) - top;
  const name = f.replace(/\.png$/, ".webp");
  const info = await sharp(`${src}/${f}`)
    .extract({ left, top, width: w, height: h })
    .webp({ quality: 88, alphaQuality: 100, effort: 6, smartSubsample: true })
    .toFile(`${out}/${name}`);
  const m = await sharp(`${out}/${name}`).metadata();
  const a = (await sharp(`${out}/${name}`).stats()).channels[3];
  console.log(`${name}: ${w}x${h} ${(info.size / 1024).toFixed(0)} KB, alpha=${m.hasAlpha} (min ${a.min}, max ${a.max})`);
}
