import { NextResponse } from "next/server";
import { forgeErrorResponse } from "../_shared";
import { GitHubAppError } from "@/lib/forge/github-app";

export function githubErrorResponse(error: unknown) {
  if (error instanceof GitHubAppError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "LIMIT" ? 413 : error.code === "AUTHORIZATION" ? 403 : error.code === "CONFIGURATION" ? 503 : 502;
    return NextResponse.json({ error: error.message }, { status });
  }
  if (error instanceof Error && error.message === "GITHUB_CONNECTION_REQUIRED") return NextResponse.json({ error: "GitHub n’est pas connecté." }, { status: 409 });
  return forgeErrorResponse(error);
}

export function parseRepository(value: string) {
  const parts = value.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new GitHubAppError("AUTHORIZATION", "Repository invalide.");
  return { owner: parts[0], repo: parts[1] };
}
