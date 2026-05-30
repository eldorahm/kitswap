/* ── SUPABASE CLIENT SETUP ───────────────────────── */
// Replace the two values below with your own from:
// Supabase Dashboard → Project Settings → API

const SUPABASE_URL  = 'https://odsvdxnymqkyezudosve.supabase.co';  // ← replace
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kc3ZkeG55bXFreWV6dWRvc3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTA3NjEsImV4cCI6MjA5NTUyNjc2MX0.9Z2xL8DWw6KlE1n5r5341pJqA3XnrS8uzmwtb7cLIBw';                // ← replace

// Load Supabase from CDN (add this script tag to every HTML page — see note below)
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

/* ── AUTH HELPERS ────────────────────────────────── */

async function getSession() {
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

async function getUser() {
  const session = await getSession();
  return session?.user ?? null;
}

async function getProfile(userId) {
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) console.error('getProfile error:', error);
  return data;
}

async function signOut() {
  await sb.auth.signOut();
  window.location.href = 'index.html';
}

/* ── LISTINGS HELPERS ────────────────────────────── */

async function fetchListings({ limit = 20, offset = 0, search = '', league = '', size = '', condition = '', type = '', priceMin = 0, priceMax = 999999, sort = 'newest' } = {}) {
  let query = sb
    .from('listings')
    .select(`*, profiles(username, avatar_letter, rating)`)
    .eq('status', 'active')
    .range(offset, offset + limit - 1);

  if (search)    query = query.ilike('title', `%${search}%`);
  if (league)    query = query.eq('league', league);
  if (size)      query = query.eq('size', size);
  if (condition) query = query.eq('condition', condition);
  if (type)      query = query.eq('type', type);
  if (priceMin)  query = query.gte('price', priceMin);
  if (priceMax < 999999) query = query.lte('price', priceMax);

  if (sort === 'price-asc')  query = query.order('price', { ascending: true });
  else if (sort === 'price-desc') query = query.order('price', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) console.error('fetchListings error:', error);
  return data ?? [];
}

async function fetchListing(id) {
  const { data, error } = await sb
    .from('listings')
    .select(`*, profiles(id, username, avatar_letter, rating, total_sales, total_reviews, location, created_at)`)
    .eq('id', id)
    .single();
  if (error) console.error('fetchListing error:', error);
  return data;
}

async function createListing(listingData) {
  const user = await getUser();
  if (!user) return { error: 'Not logged in' };
  const { data, error } = await sb
    .from('listings')
    .insert({ ...listingData, seller_id: user.id })
    .select()
    .single();
  if (error) console.error('createListing error:', error);
  return { data, error };
}

async function fetchUserListings(userId) {
  const { data, error } = await sb
    .from('listings')
    .select('*')
    .eq('seller_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) console.error('fetchUserListings error:', error);
  return data ?? [];
}

/* ── MESSAGES HELPERS ────────────────────────────── */

async function fetchConversations() {
  const user = await getUser();
  if (!user) return [];
  const { data, error } = await sb
    .from('conversations')
    .select(`
      *,
      listing:listings(id, title, price, type, emoji),
      buyer:profiles!conversations_buyer_id_fkey(id, username, avatar_letter),
      seller:profiles!conversations_seller_id_fkey(id, username, avatar_letter)
    `)
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order('created_at', { ascending: false });
  if (error) console.error('fetchConversations error:', error);
  return data ?? [];
}

async function fetchMessages(conversationId) {
  const { data, error } = await sb
    .from('messages')
    .select(`*, sender:profiles(username, avatar_letter)`)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) console.error('fetchMessages error:', error);
  return data ?? [];
}

async function sendMessage(conversationId, content) {
  const user = await getUser();
  if (!user) return { error: 'Not logged in' };
  const { data, error } = await sb
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: user.id, content })
    .select()
    .single();
  if (error) console.error('sendMessage error:', error);
  return { data, error };
}

async function subscribeToMessages(conversationId, callback) {
  return sb
    .channel(`messages:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, callback)
    .subscribe();
}

/* ── FORUM HELPERS ───────────────────────────────── */

async function fetchThreads({ category = '', search = '', sort = 'latest' } = {}) {
  let query = sb
    .from('forum_threads')
    .select(`*, author:profiles(username, avatar_letter), posts:forum_posts(count)`);
  if (category) query = query.eq('category', category);
  if (search)   query = query.ilike('title', `%${search}%`);
  if (sort === 'popular') query = query.order('views', { ascending: false });
  else query = query.order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) console.error('fetchThreads error:', error);
  return data ?? [];
}

async function fetchThreadPosts(threadId) {
  const { data, error } = await sb
    .from('forum_posts')
    .select(`*, author:profiles(username, avatar_letter)`)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  if (error) console.error('fetchThreadPosts error:', error);
  return data ?? [];
}

async function createThread(category, title, body) {
  const user = await getUser();
  if (!user) return { error: 'Not logged in' };
  const { data: thread, error: tErr } = await sb
    .from('forum_threads')
    .insert({ author_id: user.id, category, title })
    .select().single();
  if (tErr) return { error: tErr };
  const { error: pErr } = await sb
    .from('forum_posts')
    .insert({ thread_id: thread.id, author_id: user.id, content: body });
  return { data: thread, error: pErr };
}

async function createPost(threadId, content) {
  const user = await getUser();
  if (!user) return { error: 'Not logged in' };
  const { data, error } = await sb
    .from('forum_posts')
    .insert({ thread_id: threadId, author_id: user.id, content })
    .select().single();
  if (error) console.error('createPost error:', error);
  return { data, error };
}

/* ── REVIEWS HELPERS ─────────────────────────────── */

async function fetchReviews(userId) {
  const { data, error } = await sb
    .from('reviews')
    .select(`*, reviewer:profiles!reviews_reviewer_id_fkey(username, avatar_letter)`)
    .eq('reviewed_id', userId)
    .order('created_at', { ascending: false });
  if (error) console.error('fetchReviews error:', error);
  return data ?? [];
}

/* ── STORAGE HELPERS (photo uploads) ─────────────── */

async function uploadListingPhoto(file, listingId) {
  const ext  = file.name.split('.').pop();
  const path = `listings/${listingId}/${Date.now()}.${ext}`;
  const { data, error } = await sb.storage
    .from('listing-images')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) { console.error('Upload error:', error); return null; }
  const { data: urlData } = sb.storage.from('listing-images').getPublicUrl(path);
  return urlData.publicUrl;
}

/* ── NAV STATE: show username if logged in ────────── */

async function updateNavForAuth() {
  const user = await getUser();
  const authDiv = document.querySelector('.nav-auth');
  if (!authDiv) return;
  if (user) {
    const profile = await getProfile(user.id);
    const username = profile?.username ?? 'Account';
    authDiv.innerHTML = `
      <a href="sell.html" class="btn btn-outline">+ Sell</a>
      <a href="messages.html" class="btn btn-outline">💬</a>
      <a href="profile.html?id=${user.id}" class="btn btn-primary">${username[0].toUpperCase()} ${username}</a>
      <button class="btn btn-outline" onclick="signOut()">Log Out</button>
    `;
  }
}