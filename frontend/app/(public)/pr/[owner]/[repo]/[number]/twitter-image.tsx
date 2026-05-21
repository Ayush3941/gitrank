import { ImageResponse } from "next/og";

export const alt = "GitRank PR report Twitter card";
export const size = {
  width: 1200,
  height: 628,
};
export const contentType = "image/png";

export default async function PRReportTwitterImage({
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
          padding: "52px",
          background:
            "linear-gradient(138deg, rgb(3, 8, 20) 0%, rgb(7, 16, 35) 54%, rgb(10, 24, 49) 100%)",
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
              "radial-gradient(circle at 14% 17%, rgba(34,226,255,0.18), transparent 42%), radial-gradient(circle at 85% 82%, rgba(244,114,255,0.15), transparent 42%)",
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
            GitRank PR Report
          </div>
          <div
            style={{
              fontSize: "66px",
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              maxWidth: "1000px",
              wordBreak: "break-word",
            }}
          >
            {prLabel}
          </div>
          <div
            style={{
              fontSize: "29px",
              lineHeight: 1.33,
              maxWidth: "960px",
              color: "rgba(236, 246, 255, 0.94)",
            }}
          >
            Contribution battle report: quality signals, evidence confidence, and progression value.
          </div>
        </div>
        <div style={{ display: "flex", gap: "14px", position: "relative" }}>
          {["Score Matrix", "Evidence Signals", "XP Breakdown", "Recommendations"].map((chip, index) => (
            <div
              key={`pr-twitter-chip-${index}-${chip}`}
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
