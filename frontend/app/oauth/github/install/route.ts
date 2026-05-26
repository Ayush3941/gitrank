import { proxyAuth } from "@/lib/api/auth-server";

export const dynamic = "force-dynamic";

type InstallPreviewResponse = {
  install_url?: string;
};

export async function GET(request: Request) {
  const upstream = await proxyAuth(request, "/oauth/github/install?preview=1");
  if (!upstream.ok) {
    return upstream;
  }

  let payload: InstallPreviewResponse;
  try {
    payload = (await upstream.json()) as InstallPreviewResponse;
  } catch {
    return new Response(
      JSON.stringify({
        error: {
          code: "invalid_github_install_response",
          message: "GitHub install response was not valid JSON.",
        },
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const installURL = payload.install_url?.trim();
  if (!installURL) {
    return new Response(
      JSON.stringify({
        error: {
          code: "missing_install_url",
          message: "GitHub install response did not include install_url.",
        },
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return Response.redirect(installURL, 302);
}
