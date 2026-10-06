import { ImageResponse } from "next/og";

export const alt = "Spolaor Tecnologia: quanto sua empresa perde sem perceber?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "radial-gradient(circle at 80% 30%, #1d2433 0%, #07080a 55%)",
          color: "#eef0f3",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30 }}>
          <div style={{ width: 22, height: 22, borderRadius: 999, background: "#d7ff3a" }} />
          <span style={{ fontWeight: 600 }}>Spolaor</span>
          <span style={{ color: "#a1a5af" }}>Tecnologia</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 92, lineHeight: 1, letterSpacing: -4, fontWeight: 600 }}>
          <span>Quanto sua empresa perde</span>
          <span style={{ color: "#ff6b3d", fontStyle: "italic", fontWeight: 400 }}>sem perceber?</span>
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 28, color: "#a1a5af" }}>
          <span>Sites que convertem</span>
          <span>·</span>
          <span>Automação</span>
          <span>·</span>
          <span>Sistemas sob medida</span>
        </div>
      </div>
    ),
    size,
  );
}
