import { NextResponse } from "next/server";
import { getUserFromRequest, isSupabaseServerConfigured, selectFirst, supabaseAdmin } from "@/lib/supabase-server";
import { getAppUrl, getPriceId, isStripeConfigured, stripeRequest, type StripePlan } from "@/lib/stripe";

type CheckoutRequest = {
  plan: StripePlan;
};

type StripeCustomer = {
  id: string;
};

type StripeCheckoutSession = {
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

  const body = (await request.json()) as CheckoutRequest;
  if (body.plan !== "starter" && body.plan !== "pro") {
    return NextResponse.json({ error: "Plan invalide." }, { status: 400 });
  }

  const subscription = await selectFirst<{ stripe_customer_id?: string }>(
    `/rest/v1/subscriptions?user_id=eq.${user.id}&select=stripe_customer_id&limit=1`
  );

  let customerId = subscription?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripeRequest<StripeCustomer>("/customers", {
      email: user.email,
      "metadata[user_id]": user.id
    });
    customerId = customer.id;

    await supabaseAdmin("/rest/v1/subscriptions?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        user_id: user.id,
        stripe_customer_id: customerId,
        plan: "free",
        status: "active",
        updated_at: new Date().toISOString()
      })
    });
  }

  const appUrl = getAppUrl();
  const session = await stripeRequest<StripeCheckoutSession>("/checkout/sessions", {
    mode: "subscription",
    customer: customerId,
    "line_items[0][price]": getPriceId(body.plan),
    "line_items[0][quantity]": 1,
    success_url: `${appUrl}/settings?checkout=success`,
    cancel_url: `${appUrl}/pricing?checkout=cancelled`,
    "metadata[user_id]": user.id,
    "metadata[plan]": body.plan,
    "subscription_data[metadata][user_id]": user.id,
    "subscription_data[metadata][plan]": body.plan,
    allow_promotion_codes: true
  });

  return NextResponse.json({ url: session.url });
}
