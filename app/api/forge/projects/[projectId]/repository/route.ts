import { NextResponse } from "next/server";
import { authenticateForge, forgeErrorResponse } from "../../../_shared";
import { getForgeProject } from "@/lib/forge/forge-store";
import { supabaseAdmin } from "@/lib/supabase-server";
import { requireActiveGitHubConnection } from "@/lib/forge/github-store";
import { listInstallationRepositories, listRepositoryBranches } from "@/lib/forge/github-provider";
import { githubErrorResponse } from "../../../github/_shared";

type Context = { params: Promise<{ projectId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  try {
    const user = await authenticateForge(request);
    const { projectId } = await params;
    await getForgeProject(user.id, projectId);
    const body = await request.json() as { repository?: unknown; branch?: unknown };
    if (typeof body.repository !== "string" || typeof body.branch !== "string" || !body.repository.trim() || !body.branch.trim()) return NextResponse.json({ error: "Repository et branche requis." }, { status: 400 });
    const connection = await requireActiveGitHubConnection(user.id);
    const repositories = await listInstallationRepositories(connection.installationId);
    const repository = repositories.find((item) => item.fullName.toLowerCase() === body.repository!.toString().toLowerCase());
    if (!repository) return NextResponse.json({ error: "Repository non autorisé." }, { status: 403 });
    const branches = await listRepositoryBranches(connection.installationId, repository.owner, repository.name);
    if (!branches.some((branch) => branch.name === body.branch!.toString())) return NextResponse.json({ error: "Branche non autorisée ou introuvable." }, { status: 403 });
    const data = await supabaseAdmin(`/rest/v1/forge_projects?id=eq.${encodeURIComponent(projectId)}&user_id=eq.${encodeURIComponent(user.id)}`, { method: "PATCH", body: JSON.stringify({ repository_provider: "github", repository_identifier: repository.fullName, default_branch: body.branch.trim() }) }) as unknown[];
    return NextResponse.json({ project: data[0] });
  } catch (error) { return error instanceof SyntaxError ? forgeErrorResponse(error) : githubErrorResponse(error); }
}
