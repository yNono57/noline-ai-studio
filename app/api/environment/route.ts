import { NextResponse } from "next/server";
import { inspectEnvironmentIdentity } from "@/lib/environment-identity";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = inspectEnvironmentIdentity();
  return NextResponse.json({
    app_environment: identity.appEnvironment,
    vercel_environment: identity.vercelEnvironment,
    supabase_project_ref: identity.supabaseProjectRef,
    expected_supabase_project_ref: identity.expectedProjectRef,
    environment_guard: identity.mutationGuard,
  });
}
