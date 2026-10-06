import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Spolaor Tecnologia: quantos clientes sua empresa perde antes mesmo de falar com eles?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const mark = await readFile(join(process.cwd(), "public/brand/spolaor-mark.png"), "base64");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "radial-gradient(circle at 82% 22%, #123a8f 0%, #0a1a3d 32%, #050913 62%)",
          color: "#eef3fb",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${mark}`} width={64} height={64} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: 4 }}>SPOLAOR</span>
            <span style={{ fontSize: 14, letterSpacing: 9, color: "#2f8cff" }}>TECNOLOGIA</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 64, lineHeight: 1.1, letterSpacing: -1, fontWeight: 700 }}>
          <span>Quantos clientes sua</span>
          <div style={{ display: "flex" }}>
            <span>empresa</span>
            <span style={{ color: "#ff8a1f", marginLeft: 16 }}>perde</span>
          </div>
          <span style={{ color: "#3ca8ff" }}>antes mesmo de falar com eles?</span>
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 28, color: "#a5b1c6" }}>
          <span>Sites de alta conversão</span>
          <span style={{ color: "#22d3ff" }}>·</span>
          <span>Automação de processos</span>
          <span style={{ color: "#22d3ff" }}>·</span>
          <span>Sistemas sob medida</span>
        </div>
      </div>
    ),
    size,
  );
}
