import { proxyGateway } from "@/lib/api/gateway-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return proxyGateway(request, "/v1/me/account/export");
}
