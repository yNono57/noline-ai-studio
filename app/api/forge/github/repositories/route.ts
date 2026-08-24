import { NextResponse } from "next/server";
import { authenticateForge } from "../../_shared";
import { requireActiveGitHubConnection } from "@/lib/forge/github-store";
import { listInstallationRepositories } from "@/lib/forge/github-provider";
import { githubErrorResponse } from "../_shared";

export async function GET(request: Request) { try { const user = await authenticateForge(request); const connection = await requireActiveGitHubConnection(user.id); return NextResponse.json({ repositories: await listInstallationRepositories(connection.installationId) }); } catch (error) { return githubErrorResponse(error); } }
