import { NextResponse } from "next/server";
import { authenticateForge } from "../../_shared";
import { getGitHubAppConfig } from "@/lib/forge/github-app";
import { verifySelectedInstallation } from "@/lib/forge/github-provider";
import { upsertGitHubConnection } from "@/lib/forge/github-store";
import { GITHUB_ONBOARDING_COOKIE, verifyGitHubCompletion } from "@/lib/forge/github-onboarding";
import { githubErrorResponse } from "../_shared";

function cookieValue(request: Request) {
  return request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${GITHUB_ONBOARDING_COOKIE}=`))?.slice(GITHUB_ONBOARDING_COOKIE.length + 1);
}

export async function POST(request: Request) {
  try {
    const user = await authenticateForge(request);
    const body = await request.json().catch(() => ({})) as { completion?: unknown };
    if (typeof body.completion !== "string") return NextResponse.json({ error: "Finalisation GitHub invalide." }, { status: 400 });
    const verified = verifyGitHubCompletion(body.completion, getGitHubAppConfig().stateSecret, { userId: user.id, nonce: cookieValue(request) });
    const { metadata } = await verifySelectedInstallation(verified.installationId);
    const connection = await upsertGitHubConnection(user.id, metadata);
    const response = NextResponse.json({ connection });
    response.cookies.set(GITHUB_ONBOARDING_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/forge/github", maxAge: 0 });
    return response;
  } catch (error) {
    return githubErrorResponse(error);
  }
}
