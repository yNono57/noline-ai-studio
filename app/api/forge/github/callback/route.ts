import { NextResponse } from "next/server";
import { getGitHubAppConfig, verifyGitHubState } from "@/lib/forge/github-app";
import { verifySelectedInstallation } from "@/lib/forge/github-provider";
import { buildGitHubResultUrl, createGitHubCompletion, parseGitHubSetupAction } from "@/lib/forge/github-onboarding";

export async function GET(request: Request) {
  const url = new URL(request.url);
  let returnOrigin: string | undefined;
  try {
    const state = verifyGitHubState(url.searchParams.get("state") || "");
    returnOrigin = state.returnOrigin;
    if (url.searchParams.get("setup_action") === "cancel") return NextResponse.redirect(buildGitHubResultUrl(returnOrigin, "cancelled"));
    const setupAction = parseGitHubSetupAction(url.searchParams.get("setup_action"));
    const installationId = url.searchParams.get("installation_id") || "";
    await verifySelectedInstallation(installationId);
    const completion = createGitHubCompletion(state, installationId, setupAction, getGitHubAppConfig().stateSecret);
    return NextResponse.redirect(buildGitHubResultUrl(returnOrigin, "complete", completion));
  } catch (error) {
    console.error("[forge-github-callback]", { errorType: error instanceof Error ? error.name : "Unknown" });
    if (returnOrigin) return NextResponse.redirect(buildGitHubResultUrl(returnOrigin, "failed"));
    return NextResponse.json({ error: "La réponse GitHub est invalide ou a expiré." }, { status: 400 });
  }
}
