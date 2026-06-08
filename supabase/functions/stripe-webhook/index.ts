// ── KITSWAP STRIPE WEBHOOK ────────────────────────────

import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripeClient = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

async function markListingSold(listingId: string, sellerId: string) {
  await supabaseAdmin
    .from('listings')
    .update({ status: 'sold' })
    .eq('id', listingId);

  const res = await supabaseAdmin
    .from('profiles')
    .select('total_sales')
    .eq('id', sellerId)
    .single();

  const current = res.data && res.data.total_sales ? res.data.total_sales : 0;

  await supabaseAdmin
    .from('profiles')
    .update({ total_sales: current + 1 })
    .eq('id', sellerId);
}

Deno.serve(async (req: Request) => {
  const sig    = req.headers.get('stripe-signature') ?? '';
  const body   = await req.text();
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

  let event: Stripe.Event;

  try {
    event = await stripeClient.webhooks.constructEventAsync(body, sig, secret);
  } catch (e) {
    return new Response('Signature error', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session  = event.data.object as Stripe.Checkout.Session;
    const meta     = session.metadata;

    if (meta && meta.listing_id && meta.seller_id) {
      try {
        await markListingSold(meta.listing_id, meta.seller_id);
        console.log('Sold: ' + meta.listing_id);
      } catch (e) {
        return new Response('DB error', { status: 500 });
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
