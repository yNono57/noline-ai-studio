import { NextResponse } from "next/server";
import { authenticateForge } from "../../../_shared";
import { requireActiveGitHubConnection } from "@/lib/forge/github-store";
import { readRepositoryFile } from "@/lib/forge/github-provider";
import { githubErrorResponse, parseRepository } from "../../_shared";

export async function GET(request: Request) { try { const user = await authenticateForge(request); const connection = await requireActiveGitHubConnection(user.id); const params = new URL(request.url).searchParams; const { owner, repo } = parseRepository(params.get("repository") || ""); const ref = params.get("ref")?.trim() || ""; const path = params.get("path")?.trim() || ""; if (!ref || !path) return NextResponse.json({ error: "Branche et chemin requis." }, { status: 400 }); return NextResponse.json({ file: await readRepositoryFile(connection.installationId, owner, repo, ref, path) }); } catch (error) { return githubErrorResponse(error); } }
