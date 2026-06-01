import { NextResponse } from "next/server";
import {
  ensureProfile,
  getQuotaState,
  getUserFromRequest,
  isSupabaseServerConfigured,
  selectFirst
} from "@/lib/supabase-server";

export async function GET(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ mode: "local" });
  }

  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Non connecte." }, { status: 401 });

  await ensureProfile(user);
  const quota = await getQuotaState(user.id);
  const subscription = await selectFirst(
    `/rest/v1/subscriptions?user_id=eq.${user.id}&select=plan,status,current_period_end&limit=1`
  );

  return NextResponse.json({
    user,
    quota,
    subscription
  });
}
