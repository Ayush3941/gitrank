import { ImageResponse } from "next/og";

export const alt = "GitRank PR battle report preview";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function PRReportOpenGraphImage({
  params,
}: {
  params: Promise<{ owner: string; repo: string; number: string }>;
}) {
  const { owner, repo, number } = await params;
  const prLabel = `${owner}/${repo} #${number}`;

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
            "linear-gradient(140deg, rgb(3, 8, 20) 0%, rgb(8, 15, 34) 52%, rgb(11, 24, 48) 100%)",
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
              "radial-gradient(circle at 13% 18%, rgba(34,226,255,0.2), transparent 42%), radial-gradient(circle at 86% 84%, rgba(244,114,255,0.16), transparent 42%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "0",
            background:
              "repeating-linear-gradient(90deg, transparent 0 42px, rgba(255,255,255,0.035) 42px 43px)",
            opacity: 0.3,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "15px", position: "relative" }}>
          <div
            style={{
              display: "flex",
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
            GitRank Battle Report
          </div>
          <div
            style={{
              fontSize: "70px",
              lineHeight: 1.04,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              maxWidth: "1020px",
              wordBreak: "break-word",
            }}
          >
            {prLabel}
          </div>
          <div
            style={{
              fontSize: "30px",
              lineHeight: 1.32,
              maxWidth: "980px",
              color: "rgba(236, 246, 255, 0.94)",
            }}
          >
            Evidence-driven PR analysis with score drivers, review depth, and impact narrative.
          </div>
        </div>
        <div style={{ display: "flex", gap: "14px", position: "relative" }}>
          {["Difficulty", "Impact", "Review Depth", "XP Drivers"].map((chip) => (
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
