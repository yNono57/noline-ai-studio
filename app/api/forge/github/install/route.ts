import { NextResponse } from "next/server";
import { authenticateForge } from "../../_shared";
import { createGitHubState, getGitHubInstallUrl } from "@/lib/forge/github-app";
import { githubErrorResponse } from "../_shared";

export async function GET(request: Request) { try { const user = await authenticateForge(request); const generated = createGitHubState(user.id); const response = NextResponse.json({ url: getGitHubInstallUrl(generated.state) }); response.cookies.set("forge_github_state", generated.nonce, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/forge/github/callback", maxAge: generated.maxAge }); return response; } catch (error) { return githubErrorResponse(error); } }
