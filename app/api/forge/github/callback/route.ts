import { NextResponse } from "next/server";
import { getInstallationMetadata } from "@/lib/forge/github-provider";
import { verifyGitHubState } from "@/lib/forge/github-app";
import { upsertGitHubConnection } from "@/lib/forge/github-store";
import { githubErrorResponse } from "../_shared";

function stateCookie(request: Request) { return request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith("forge_github_state="))?.slice("forge_github_state=".length); }
export async function GET(request: Request) { const url = new URL(request.url); try { const verified = verifyGitHubState(url.searchParams.get("state") || "", stateCookie(request)); const metadata = await getInstallationMetadata(url.searchParams.get("installation_id") || ""); await upsertGitHubConnection(verified.userId, metadata); const response = NextResponse.redirect(new URL("/forge?github=connected", request.url)); response.cookies.set("forge_github_state", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/forge/github/callback", maxAge: 0 }); return response; } catch (error) { const response = githubErrorResponse(error); response.cookies.set("forge_github_state", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/forge/github/callback", maxAge: 0 }); return response; } }
