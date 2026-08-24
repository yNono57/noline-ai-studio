import { NextResponse } from "next/server";
import { authenticateForge } from "../../../_shared";
import { requireActiveGitHubConnection } from "@/lib/forge/github-store";
import { searchRepository } from "@/lib/forge/github-provider";
import { githubErrorResponse, parseRepository } from "../../_shared";

export async function GET(request: Request) { try { const user = await authenticateForge(request); const connection = await requireActiveGitHubConnection(user.id); const params = new URL(request.url).searchParams; const { owner, repo } = parseRepository(params.get("repository") || ""); return NextResponse.json({ results: await searchRepository(connection.installationId, owner, repo, params.get("q") || "") }); } catch (error) { return githubErrorResponse(error); } }
