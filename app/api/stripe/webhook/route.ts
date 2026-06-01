import { NextResponse } from "next/server";
import { getPlanFromPriceId, verifyStripeSignature } from "@/lib/stripe";
import { supabaseAdmin, updateUserPlan } from "@/lib/supabase-server";

type StripeEvent = {
  type: string;
  data: {
    object: Record<string, unknown>;
  };
};

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!verifyStripeSignature(payload, signature)) {
    return NextResponse.json({ error: "Signature Stripe invalide." }, { status: 400 });
  }

  const event = JSON.parse(payload) as StripeEvent;

  if (
    event.type === "checkout.session.completed" ||
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await syncSubscription(event.data.object);
  }

  return NextResponse.json({ received: true });
}

async function syncSubscription(object: Record<string, unknown>) {
  const metadata = (object.metadata || {}) as Record<string, string>;
  const userId = metadata.user_id;
  const customerId = String(object.customer || "");
  const subscriptionId = String(object.subscription || object.id || "");
  const status = String(object.status || "active");
  const currentPeriodEnd = object.current_period_end
    ? new Date(Number(object.current_period_end) * 1000).toISOString()
    : null;
  const items = object.items as { data?: Array<{ price?: { id?: string } }> } | undefined;
  const priceId =
    items?.data?.[0]?.price?.id ||
    String(object["display_items"] || "") ||
    "";
  const subscriptionEnded = ["canceled", "incomplete_expired", "unpaid"].includes(status);
  const plan = subscriptionEnded ? "free" : getPlanFromPriceId(priceId);
  const finalPlan = plan === "free" && !subscriptionEnded && metadata.plan ? metadata.plan : plan;

  if (!userId) return;

  await supabaseAdmin("/rest/v1/subscriptions?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      user_id: userId,
      stripe_customer_id: customerId || null,
      stripe_subscription_id: subscriptionId || null,
      stripe_price_id: priceId || null,
      plan: finalPlan,
      status,
      current_period_end: currentPeriodEnd,
      updated_at: new Date().toISOString()
    })
  });

  await updateUserPlan(userId, finalPlan as "free" | "starter" | "pro");
}
