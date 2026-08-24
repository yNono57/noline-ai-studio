import { NextResponse } from "next/server";
import { authenticateForge } from "../../../_shared";
import { requireActiveGitHubConnection } from "@/lib/forge/github-store";
import { listRepositoryTree } from "@/lib/forge/github-provider";
import { githubErrorResponse, parseRepository } from "../../_shared";

export async function GET(request: Request) { try { const user = await authenticateForge(request); const connection = await requireActiveGitHubConnection(user.id); const params = new URL(request.url).searchParams; const { owner, repo } = parseRepository(params.get("repository") || ""); const ref = params.get("ref")?.trim() || ""; if (!ref) return NextResponse.json({ error: "Branche requise." }, { status: 400 }); return NextResponse.json({ entries: await listRepositoryTree(connection.installationId, owner, repo, ref, params.get("path") || "") }); } catch (error) { return githubErrorResponse(error); } }
