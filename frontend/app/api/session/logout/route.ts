import { proxyAuth } from "@/lib/api/auth-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return proxyAuth(request, "/v1/session/logout");
}
