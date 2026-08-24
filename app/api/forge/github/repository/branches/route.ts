import { NextResponse } from "next/server";
import { authenticateForge } from "../../../_shared";
import { requireActiveGitHubConnection } from "@/lib/forge/github-store";
import { listRepositoryBranches } from "@/lib/forge/github-provider";
import { githubErrorResponse, parseRepository } from "../../_shared";

export async function GET(request: Request) { try { const user = await authenticateForge(request); const connection = await requireActiveGitHubConnection(user.id); const { owner, repo } = parseRepository(new URL(request.url).searchParams.get("repository") || ""); return NextResponse.json({ branches: await listRepositoryBranches(connection.installationId, owner, repo) }); } catch (error) { return githubErrorResponse(error); } }
