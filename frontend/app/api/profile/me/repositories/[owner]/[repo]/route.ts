import { proxyGateway } from "@/lib/api/gateway-server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> },
) {
  const { owner, repo } = await params;
  return proxyGateway(
    request,
    `/v1/me/profile/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
  );
}
