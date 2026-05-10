import { proxyGateway } from "@/lib/api/gateway-server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  return proxyGateway(request, `/v1/users/${encodeURIComponent(username)}/card`);
}
