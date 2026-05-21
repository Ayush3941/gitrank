import { ImageResponse } from "next/og";

export const alt = "GitRank public profile Twitter card";
export const size = {
  width: 1200,
  height: 628,
};
export const contentType = "image/png";

export default async function ProfileTwitterImage({
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
          padding: "52px",
          background:
            "linear-gradient(138deg, rgb(3, 8, 20) 0%, rgb(6, 16, 37) 54%, rgb(10, 25, 51) 100%)",
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
              "radial-gradient(circle at 14% 17%, rgba(34,226,255,0.18), transparent 42%), radial-gradient(circle at 84% 82%, rgba(244,114,255,0.15), transparent 42%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "0",
            background:
              "repeating-linear-gradient(90deg, transparent 0 44px, rgba(255,255,255,0.032) 44px 45px)",
            opacity: 0.3,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "9px 15px",
              border: "1px solid rgba(34,226,255,0.42)",
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
              fontSize: "72px",
              lineHeight: 1.04,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              maxWidth: "980px",
              wordBreak: "break-word",
            }}
          >
            {handle}
          </div>
          <div
            style={{
              fontSize: "29px",
              lineHeight: 1.33,
              maxWidth: "960px",
              color: "rgba(236, 246, 255, 0.94)",
            }}
          >
            Public contributor identity: real GitHub evidence, score explanations, and progression.
          </div>
        </div>
        <div style={{ display: "flex", gap: "14px", position: "relative" }}>
          {["Contributions", "Badges", "Quests", "Leaderboard"].map((chip, index) => (
            <div
              key={`profile-twitter-chip-${index}-${chip}`}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 16px",
                border: "1px solid rgba(34,226,255,0.28)",
                background: "linear-gradient(160deg, rgba(34,226,255,0.19), rgba(244,114,255,0.13))",
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
