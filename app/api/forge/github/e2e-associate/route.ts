import { NextResponse } from "next/server";
import { authenticateForge } from "../../_shared";
import { createGitHubAppJwt } from "@/lib/forge/github-app";
import { getInstallationMetadata, getInstallationToken } from "@/lib/forge/github-provider";
import { upsertGitHubConnection } from "@/lib/forge/github-store";

const INSTALLATION_ID = "156064094";
const E2E_USER_ID = "ef5a5032-2f15-40a7-a96f-4d5db63472cc";
const EXPECTED_REPOSITORY = "yNono57/noline-phase1u-e2e-1790017210";
const GITHUB_API = "https://api.github.com";
const GITHUB_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "NOLINE-Forge-E2E",
};

export async function POST(request: Request) {
  try {
    const user = await authenticateForge(request);
    if (user.id !== E2E_USER_ID) {
      return NextResponse.json({ error: "E2E staging identity required." }, { status: 403 });
    }

    const installationResponse = await fetch(`${GITHUB_API}/app/installations/${INSTALLATION_ID}`, {
      headers: { ...GITHUB_HEADERS, Authorization: `Bearer ${createGitHubAppJwt()}` },
      cache: "no-store",
    });
    if (!installationResponse.ok) {
      return NextResponse.json({ error: "Installation verification failed." }, { status: 502 });
    }
    const installation = await installationResponse.json() as { id: number; repository_selection: string };
    if (String(installation.id) !== INSTALLATION_ID || installation.repository_selection !== "selected") {
      return NextResponse.json({ error: "Installation scope verification failed." }, { status: 409 });
    }

    const token = await getInstallationToken(INSTALLATION_ID);
    const repositoriesResponse = await fetch(`${GITHUB_API}/installation/repositories?per_page=100`, {
      headers: { ...GITHUB_HEADERS, Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!repositoriesResponse.ok) {
      return NextResponse.json({ error: "Repository scope verification failed." }, { status: 502 });
    }
    const repositoryScope = await repositoriesResponse.json() as {
      total_count: number;
      repositories: Array<{ full_name: string }>;
    };
    const repositories = repositoryScope.repositories.map((repository) => repository.full_name);
    if (repositoryScope.total_count !== 1 || repositories.length !== 1 || repositories[0] !== EXPECTED_REPOSITORY) {
      return NextResponse.json({ error: "Repository scope is not exact." }, { status: 409 });
    }

    const metadata = await getInstallationMetadata(INSTALLATION_ID);
    await upsertGitHubConnection(user.id, metadata);
    return NextResponse.json({
      associated: true,
      installationId: INSTALLATION_ID,
      repositorySelection: installation.repository_selection,
      repositories,
    });
  } catch {
    return NextResponse.json({ error: "E2E association failed." }, { status: 500 });
  }
}
