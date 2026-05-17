import { ImageResponse } from "next/og";

export const alt = "GitRank public contributor profile card";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function ProfileOpenGraphImage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const handle = `@${username}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "54px",
          background:
            "linear-gradient(140deg, rgb(3, 8, 20) 0%, rgb(7, 15, 36) 52%, rgb(10, 24, 50) 100%)",
          color: "rgb(247, 252, 255)",
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
              "radial-gradient(circle at 14% 18%, rgba(34,226,255,0.2), transparent 42%), radial-gradient(circle at 84% 80%, rgba(244,114,255,0.16), transparent 42%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "0",
            background:
              "repeating-linear-gradient(90deg, transparent 0 46px, rgba(255,255,255,0.035) 46px 47px)",
            opacity: 0.3,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "15px", position: "relative" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              alignSelf: "flex-start",
              padding: "10px 16px",
              border: "1px solid rgba(34,226,255,0.42)",
              background: "rgba(34,226,255,0.12)",
              fontSize: "20px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            GitRank Profile
          </div>
          <div
            style={{
              fontSize: "76px",
              lineHeight: 1.03,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              maxWidth: "1000px",
              wordBreak: "break-word",
            }}
          >
            {handle}
          </div>
          <div
            style={{
              fontSize: "30px",
              lineHeight: 1.32,
              maxWidth: "980px",
              color: "rgba(236, 246, 255, 0.94)",
            }}
          >
            Evidence-backed open-source reputation with contribution impact, badges, and progression.
          </div>
        </div>
        <div style={{ display: "flex", gap: "14px", position: "relative" }}>
          {["PR Impact", "XP Movement", "Badge Story", "Rank Progression"].map((chip) => (
            <div
              key={chip}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 16px",
                border: "1px solid rgba(34,226,255,0.3)",
                background: "linear-gradient(160deg, rgba(34,226,255,0.2), rgba(244,114,255,0.14))",
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
    { ...size },
  );
}
