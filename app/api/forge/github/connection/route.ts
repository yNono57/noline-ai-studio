import { NextResponse } from "next/server";
import { authenticateForge } from "../../_shared";
import { getGitHubConnection, revokeGitHubConnection } from "@/lib/forge/github-store";
import { githubErrorResponse } from "../_shared";

export async function GET(request: Request) { try { const user = await authenticateForge(request); return NextResponse.json({ connection: await getGitHubConnection(user.id) }); } catch (error) { return githubErrorResponse(error); } }
export async function DELETE(request: Request) { try { const user = await authenticateForge(request); await revokeGitHubConnection(user.id); return new NextResponse(null, { status: 204 }); } catch (error) { return githubErrorResponse(error); } }
