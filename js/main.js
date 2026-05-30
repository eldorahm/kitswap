/* ── MAIN.JS — runs on every page ────────────────── */

/* ── MOBILE NAV TOGGLE ───────────────────────────── */

const navToggle = document.getElementById('navToggle');
const navLinks  = document.querySelector('.nav-links');
const navAuth   = document.querySelector('.nav-auth');

if (navToggle) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    navAuth.classList.toggle('open');
  });
}

/* ── HERO SEARCH ─────────────────────────────────── */

function handleSearch() {
  const query = document.getElementById('heroSearch')?.value.trim();
  if (query) window.location.href = `browse.html?q=${encodeURIComponent(query)}`;
}

document.getElementById('heroSearch')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleSearch();
});

/* ── NAV AUTH STATE ──────────────────────────────── */
// Shows username + account links when logged in,
// Log In / Sign Up buttons when logged out.

async function initNav() {
  // Only runs if supabase.js is loaded (not on 404 pages etc.)
  if (typeof sb === 'undefined') return;
  const user = await getUser();
  const authDiv = document.querySelector('.nav-auth');
  if (!authDiv) return;

  if (user) {
    const profile = await getProfile(user.id);
    const username = profile?.username ?? 'Account';
    const initial  = username[0].toUpperCase();
    authDiv.innerHTML = `
      <a href="sell.html"              class="btn btn-outline">+ Sell</a>
      <a href="messages.html"          class="btn btn-outline">💬</a>
      <a href="profile.html?id=${user.id}" class="btn btn-primary">${initial} ${username}</a>
      <button class="btn btn-outline"  onclick="signOut()">Log Out</button>
    `;
  }
  // If not logged in, existing Log In / Sign Up buttons stay as-is
}

/* ── HOMEPAGE LISTING CARDS ──────────────────────── */

const condLabels = {
  mint:'Mint', excellent:'Excellent',
  'very-good':'Very Good', good:'Good', fair:'Fair'
};

function renderListingCard(l) {
  const price = l.type === 'swap' ? 'Swap Only' : `£${l.price}`;
  const cond  = condLabels[l.condition] || l.condition;
  const img   = l.images?.[0]
    ? `<img src="${l.images[0]}" alt="${l.title}" style="width:100%;height:100%;object-fit:cover;" />`
    : (l.emoji || '👕');
  return `
    <a href="listing.html?id=${l.id}" class="listing-card">
      <div class="listing-card-img">${img}</div>
      <div class="listing-card-body">
        <div class="listing-card-title">${l.title}</div>
        <div class="listing-card-meta">Size ${l.size} · ${cond}</div>
        <div class="listing-card-footer">
          <span class="listing-card-price">${price}</span>
          <span class="listing-card-type ${l.type}">${l.type === 'swap' ? 'Swap' : 'Sale'}</span>
        </div>
      </div>
    </a>`;
}

async function loadFeaturedListings() {
  const grid = document.getElementById('featuredListings');
  if (!grid) return;

  // Show skeleton placeholders while loading
  grid.innerHTML = Array(8).fill(`
    <div class="listing-card" style="pointer-events:none;">
      <div class="listing-card-img" style="background:#e2e8f0;animation:pulse 1.5s infinite;"></div>
      <div class="listing-card-body">
        <div style="height:14px;background:#e2e8f0;border-radius:4px;margin-bottom:8px;animation:pulse 1.5s infinite;"></div>
        <div style="height:12px;background:#f1f5f9;border-radius:4px;width:60%;animation:pulse 1.5s infinite;"></div>
      </div>
    </div>`).join('');

  try {
    const listings = await fetchListings({ limit: 8 });
    if (listings.length === 0) {
      grid.innerHTML = `<p style="color:var(--color-grey);grid-column:1/-1;text-align:center;padding:2rem;">No listings yet — be the first to sell a shirt!</p>`;
      return;
    }
    grid.innerHTML = listings.map(renderListingCard).join('');
  } catch (err) {
    console.error('Failed to load listings:', err);
    grid.innerHTML = `<p style="color:var(--color-grey);grid-column:1/-1;text-align:center;padding:2rem;">Could not load listings right now.</p>`;
  }
}

/* ── PULSE ANIMATION (skeleton loader) ───────────── */

const pulseStyle = document.createElement('style');
pulseStyle.textContent = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.5; }
  }`;
document.head.appendChild(pulseStyle);

/* ── INIT ─────────────────────────────────────────── */

window.addEventListener('DOMContentLoaded', () => {
  initNav();
  loadFeaturedListings();
});