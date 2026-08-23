import { ImageResponse } from "next/og";

export const alt = "Case Lab III — три маркетинговых кейса в Алматы";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          color: "#ffffff",
          background: "linear-gradient(135deg, #040082 0%, #160f43 58%, #eb9ae9 150%)",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ display: "flex", fontSize: 28, letterSpacing: "0.16em", textTransform: "uppercase" }}>
            Case Lab <span style={{ marginLeft: "12px", color: "#eb9ae9" }}>III</span>
          </div>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 700, lineHeight: 1.05 }}>
            Кейсы, которые обычно не попадают в презентации
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: 30, lineHeight: 1.2 }}>
          <div style={{ display: "flex", color: "#eb9ae9", fontWeight: 700 }}>24 СЕНТЯБРЯ 2026 · 10:00–14:00 (UTC+5)</div>
          <div style={{ display: "flex" }}>Narxoz Business School · ул. Жандосова 55/10, Алматы</div>
        </div>
      </div>
    ),
    size,
  );
}
