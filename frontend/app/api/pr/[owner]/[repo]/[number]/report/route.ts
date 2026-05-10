import { proxyGateway } from "@/lib/api/gateway-server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string; number: string }> },
) {
  const { owner, repo, number } = await params;
  return proxyGateway(
    request,
    `/v1/pr/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(number)}/report`,
  );
}
