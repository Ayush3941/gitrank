import { ImageResponse } from "next/og";

export const alt = "GitRank contributor intelligence card";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px",
          background:
            "linear-gradient(140deg, rgb(4, 8, 20) 0%, rgb(7, 14, 34) 45%, rgb(11, 24, 52) 100%)",
          color: "rgb(245, 249, 255)",
          fontFamily: "Inter, Segoe UI, Helvetica, Arial, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "0",
            display: "flex",
            background:
              "radial-gradient(circle at 14% 18%, rgba(34,226,255,0.22), transparent 44%), radial-gradient(circle at 86% 82%, rgba(244,114,255,0.16), transparent 45%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "0",
            background:
              "repeating-linear-gradient(90deg, transparent 0 42px, rgba(255,255,255,0.04) 42px 43px)",
            opacity: 0.35,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              alignSelf: "flex-start",
              gap: "10px",
              padding: "10px 16px",
              border: "1px solid rgba(34,226,255,0.42)",
              background: "rgba(34,226,255,0.12)",
              fontSize: "20px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            GitRank
          </div>
          <div
            style={{
              fontSize: "78px",
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              maxWidth: "980px",
            }}
          >
            Turn Pull Requests Into Evidence-Backed Reputation
          </div>
          <div
            style={{
              fontSize: "31px",
              lineHeight: 1.34,
              maxWidth: "980px",
              color: "rgba(236, 246, 255, 0.94)",
            }}
          >
            Contribution impact, XP progression, and AI explanations with deterministic score guardrails.
          </div>
        </div>
        <div style={{ display: "flex", gap: "14px", position: "relative" }}>
          {["PR Impact", "XP + Levels", "Badges + Quests", "Public Profile"].map((chip, index) => (
            <div
              key={`home-og-chip-${index}-${chip}`}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "11px 17px",
                border: "1px solid rgba(34,226,255,0.3)",
                background: "linear-gradient(160deg, rgba(34,226,255,0.2), rgba(244,114,255,0.14))",
                fontSize: "21px",
                fontWeight: 600,
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
