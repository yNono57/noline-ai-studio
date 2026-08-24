import { NextResponse } from "next/server";
import { getInstallationMetadata } from "@/lib/forge/github-provider";
import { GitHubAppError, verifyGitHubState } from "@/lib/forge/github-app";
import { upsertGitHubConnection } from "@/lib/forge/github-store";
import { githubErrorResponse } from "../_shared";

type CallbackStage =
  | "callback_state_validation"
  | "github_installation_metadata"
  | "supabase_connection_upsert"
  | "callback_redirect";

function stateCookie(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("forge_github_state="))
    ?.slice("forge_github_state=".length);
}

function logStage(stage: string) {
  console.info("[forge-github-callback]", { stage });
}

function safeErrorType(error: unknown) {
  if (error instanceof GitHubAppError) return "GitHubAppError";
  if (error instanceof TypeError) return "TypeError";
  if (error instanceof RangeError) return "RangeError";
  if (error instanceof SyntaxError) return "SyntaxError";
  if (error instanceof Error) return "Error";
  return "Unknown";
}

function logStageFailure(stage: CallbackStage, error: unknown) {
  console.error("[forge-github-callback]", {
    stage: `${stage}_failed`,
    errorType: safeErrorType(error),
    ...(error instanceof GitHubAppError ? { errorCode: error.code } : {}),
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  let stage: CallbackStage = "callback_state_validation";

  try {
    const verified = verifyGitHubState(
      url.searchParams.get("state") || "",
      stateCookie(request),
    );
    logStage("callback_state_validated");

    stage = "github_installation_metadata";
    logStage("github_installation_metadata_start");
    const metadata = await getInstallationMetadata(
      url.searchParams.get("installation_id") || "",
    );
    logStage("github_installation_metadata_success");

    stage = "supabase_connection_upsert";
    logStage("supabase_connection_upsert_start");
    await upsertGitHubConnection(verified.userId, metadata);
    logStage("supabase_connection_upsert_success");

    stage = "callback_redirect";
    const response = NextResponse.redirect(
      new URL("/forge?github=connected", request.url),
    );
    response.cookies.set("forge_github_state", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/forge/github/callback",
      maxAge: 0,
    });
    logStage("callback_redirect_success");
    return response;
  } catch (error) {
    logStageFailure(stage, error);
    const response = githubErrorResponse(error);
    response.cookies.set("forge_github_state", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/forge/github/callback",
      maxAge: 0,
    });
    return response;
  }
}
