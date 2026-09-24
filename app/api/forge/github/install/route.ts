import { NextResponse } from "next/server";
import { authenticateForge } from "../../_shared";
import { createGitHubState, getGitHubInstallUrl } from "@/lib/forge/github-app";
import { GITHUB_ONBOARDING_COOKIE, resolveGitHubReturnOrigin } from "@/lib/forge/github-onboarding";
import { githubErrorResponse } from "../_shared";

export async function GET(request: Request) { try { const user = await authenticateForge(request); const generated = createGitHubState(user.id, resolveGitHubReturnOrigin(request.url)); const response = NextResponse.json({ url: getGitHubInstallUrl(generated.state) }); response.cookies.set(GITHUB_ONBOARDING_COOKIE, generated.nonce, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/forge/github", maxAge: generated.maxAge }); return response; } catch (error) { return githubErrorResponse(error); } }
