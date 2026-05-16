import { proxyGateway } from "@/lib/api/gateway-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return proxyGateway(request, "/v1/sync/repository/execute");
}
