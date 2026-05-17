import { ImageResponse } from "next/og";

export const alt = "GitRank open-source contributor profile platform";
export const size = {
  width: 1200,
  height: 628,
};
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "52px",
          background:
            "linear-gradient(138deg, rgb(3, 8, 19) 0%, rgb(6, 16, 36) 52%, rgb(11, 25, 53) 100%)",
          color: "rgb(246, 250, 255)",
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
              "radial-gradient(circle at 15% 18%, rgba(34,226,255,0.2), transparent 44%), radial-gradient(circle at 84% 83%, rgba(244,114,255,0.16), transparent 44%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "0",
            background:
              "repeating-linear-gradient(90deg, transparent 0 44px, rgba(255,255,255,0.035) 44px 45px)",
            opacity: 0.32,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", position: "relative" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              alignSelf: "flex-start",
              gap: "10px",
              padding: "9px 15px",
              border: "1px solid rgba(34,226,255,0.4)",
              background: "rgba(34,226,255,0.12)",
              fontSize: "19px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            GitRank
          </div>
          <div
            style={{
              fontSize: "74px",
              lineHeight: 1.03,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              maxWidth: "980px",
            }}
          >
            Duolingo + RPG + LinkedIn for Open Source
          </div>
          <div
            style={{
              fontSize: "29px",
              lineHeight: 1.32,
              maxWidth: "960px",
              color: "rgba(236, 246, 255, 0.94)",
            }}
          >
            Real GitHub evidence. Explainable scoring. Share-ready contributor identity.
          </div>
        </div>
        <div style={{ display: "flex", gap: "14px", position: "relative" }}>
          {["Sync GitHub", "Analyze PRs", "Earn XP", "Climb Leaderboard"].map((chip) => (
            <div
              key={chip}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 16px",
                border: "1px solid rgba(34,226,255,0.28)",
                background: "linear-gradient(160deg, rgba(34,226,255,0.18), rgba(244,114,255,0.13))",
                fontSize: "20px",
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
