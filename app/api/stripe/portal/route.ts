import { NextResponse } from "next/server";
import { getUserFromRequest, isSupabaseServerConfigured, selectFirst } from "@/lib/supabase-server";
import { getAppUrl, isStripeConfigured, stripeRequest } from "@/lib/stripe";

type PortalSession = {
  url: string;
};

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase doit etre configure pour Stripe." }, { status: 500 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe n'est pas configure." }, { status: 500 });
  }

  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Non connecte." }, { status: 401 });

  const subscription = await selectFirst<{ stripe_customer_id?: string }>(
    `/rest/v1/subscriptions?user_id=eq.${user.id}&select=stripe_customer_id&limit=1`
  );

  if (!subscription?.stripe_customer_id) {
    return NextResponse.json({ error: "Aucun client Stripe trouve." }, { status: 404 });
  }

  const session = await stripeRequest<PortalSession>("/billing_portal/sessions", {
    customer: subscription.stripe_customer_id,
    return_url: `${getAppUrl()}/settings`
  });

  return NextResponse.json({ url: session.url });
}
