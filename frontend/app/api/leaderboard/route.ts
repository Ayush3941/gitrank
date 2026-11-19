import { proxyGateway } from "@/lib/api/gateway-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const source = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  for (const key of ["lane", "limit"]) {
    const value = source.get(key);
    if (value !== null) query.set(key, value);
  }
  const suffix = query.size ? `?${query.toString()}` : "";
  return proxyGateway(request, `/v1/leaderboard${suffix}`);
}
