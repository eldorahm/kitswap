// ── KITSWAP STRIPE CHECKOUT — Edge Function ──────────

import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
});

const PLATFORM_FEE = 0.05;

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Parse request
    const body      = await req.json();
    const listingId = body.listing_id;
    if (!listingId) throw new Error('listing_id is required');

    // 2. Authenticate buyer
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) throw new Error('Not authenticated');

    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const userRes = await sb.auth.getUser();
    if (userRes.error || !userRes.data.user) throw new Error('Invalid session');
    const user = userRes.data.user;

    // 3. Fetch listing
    const listingRes = await sb
      .from('listings')
      .select('*, profiles(id, username)')
      .eq('id', listingId)
      .eq('status', 'active')
      .single();

    if (listingRes.error || !listingRes.data) throw new Error('Listing not found or no longer active');
    const listing = listingRes.data;

    if (!listing.price)                throw new Error('This listing has no price set');
    if (listing.seller_id === user.id) throw new Error('You cannot buy your own listing');

    // 4. Calculate amounts
    const totalPence       = Math.round(listing.price * 100);
    const platformFeePence = Math.round(totalPence * PLATFORM_FEE);

    // 5. Get seller Stripe account if connected
    const sellerRes = await sb
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', listing.seller_id)
      .single();

    const stripeAccountId = sellerRes.data ? sellerRes.data.stripe_account_id : null;

    // 6. Build session params
    const origin      = req.headers.get('origin') ?? '';
    const images      = listing.images && listing.images.length > 0 ? [listing.images[0]] : [];
    const sellerName  = listing.profiles ? listing.profiles.username : 'seller';

    const sessionData = {
      mode:                 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency:     'gbp',
            unit_amount:  totalPence,
            product_data: {
              name:        listing.title,
              description: 'Size ' + listing.size + ' · ' + listing.condition + ' · Sold by ' + sellerName,
              images:      images,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        listing_id: String(listingId),
        buyer_id:   user.id,
        seller_id:  listing.seller_id,
      },
      success_url: origin + '/success.html?listing_id=' + listingId + '&session_id={CHECKOUT_SESSION_ID}',
      cancel_url:  origin + '/listing.html?id=' + listingId,
    };

    // Add payment split if seller has Stripe Connect
    if (stripeAccountId) {
      sessionData.payment_intent_data = {
        application_fee_amount: platformFeePence,
        transfer_data: { destination: stripeAccountId },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionData);

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders) }
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Checkout error:', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders) }
    );
  }
});