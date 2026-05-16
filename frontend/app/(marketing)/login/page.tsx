import type { Metadata } from "next";
import { LoginPanel } from "@/features/onboarding/components/LoginPanel";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in with GitHub OAuth to sync contribution evidence and open your GitRank dashboard.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const returnTo = sanitizeReturnTo(params.return_to);
  return <LoginPanel returnTo={returnTo} />;
}

function sanitizeReturnTo(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || candidate.trim() === "") {
    return "/dashboard";
  }
  if (!candidate.startsWith("/")) {
    return "/dashboard";
  }
  return candidate;
}
