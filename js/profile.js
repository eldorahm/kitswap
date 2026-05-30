/* ── PROFILE PAGE — profile.js (Supabase connected) ── */

const condLabels = {
  mint:'Mint', excellent:'Excellent',
  'very-good':'Very Good', good:'Good', fair:'Fair'
};

let isFollowing  = false;
let activeFilter = 'all';
let profileUser  = null;

/* ── INIT ─────────────────────────────────────────── */

window.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  // Support ?id=uuid or ?user=username
  const userId   = params.get('id');
  const username = params.get('user');

  showSkeleton();

  let profile = null;

  if (userId) {
    profile = await getProfile(userId);
  } else if (username) {
    // Fetch by username
    const { data } = await sb.from('profiles').select('*').eq('username', username).single();
    profile = data;
  } else {
    // Default: show logged-in user's own profile
    const user = await getUser();
    if (user) profile = await getProfile(user.id);
  }

  if (!profile) {
    document.getElementById('profileName').textContent = 'User not found';
    return;
  }

  profileUser = profile;
  renderProfile(profile);

  // Load listings and reviews in parallel
  const [listings, reviews] = await Promise.all([
    fetchUserListings(profile.id),
    fetchReviews(profile.id)
  ]);

  renderListings(listings);
  renderReviews(reviews, profile);

  // Check if viewing own profile
  const currentUser = await getUser();
  if (currentUser && currentUser.id === profile.id) renderOwnProfileActions();
});

/* ── SKELETON ────────────────────────────────────── */

function showSkeleton() {
  document.getElementById('profileName').textContent = 'Loading...';
  document.getElementById('profileAvatar').textContent = '...';
}

/* ── RENDER PROFILE HEADER ───────────────────────── */

function renderProfile(p) {
  document.title = `${p.username} — KitSwap`;

  document.getElementById('profileAvatar').textContent = p.avatar_letter || p.username[0].toUpperCase();
  document.getElementById('profileName').textContent   = p.username;

  if (p.verified) document.getElementById('verifiedBadge').style.display = 'inline-block';

  const joined = p.created_at
    ? new Date(p.created_at).toLocaleDateString('en-GB', { month:'long', year:'numeric' })
    : 'Recently';

  document.getElementById('profileMeta').innerHTML = `
    ${p.location ? `<span>📍 ${p.location}</span>` : ''}
    <span>📅 Member since ${joined}</span>
    <span>⚡ Responds ${p.response_time || 'Within 24 hrs'}</span>
  `;

  const rating = p.rating ? parseFloat(p.rating).toFixed(1) : null;
  document.getElementById('profileRatingRow').innerHTML = rating ? `
    <span class="stars">${starsHtml(parseFloat(rating))}</span>
    <span class="rating-value">${rating}</span>
    <span class="rating-count">(${p.total_reviews || 0} reviews)</span>
  ` : '<span class="rating-count">No reviews yet</span>';

  document.getElementById('profileTags').innerHTML =
    (p.tags || []).map(t => `<span class="profile-tag">${t}</span>`).join('');

  document.getElementById('profileActions').innerHTML = `
    <button class="btn btn-follow" id="followBtn" onclick="toggleFollow()">+ Follow</button>
    <button class="btn btn-message-seller" onclick="window.location.href='messages.html'">💬 Message</button>
  `;

  document.getElementById('profileStats').innerHTML = [
    { value: p.total_sales   || 0, label:'Sales'    },
    { value: p.total_swaps   || 0, label:'Swaps'    },
    { value: p.total_reviews || 0, label:'Reviews'  },
    { value: rating           || '—', label:'Rating' },
  ].map(s => `
    <div class="profile-stat">
      <span class="profile-stat-value">${s.value}</span>
      <span class="profile-stat-label">${s.label}</span>
    </div>`).join('');

  renderAbout(p);
}

/* ── OWN PROFILE ACTIONS ─────────────────────────── */

function renderOwnProfileActions() {
  document.getElementById('profileActions').innerHTML = `
    <a href="sell.html" class="btn btn-primary">+ List a Shirt</a>
    <a href="settings.html" class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,0.4);">⚙ Settings</a>
  `;
}

/* ── TAB SWITCHING ───────────────────────────────── */

function switchTab(name, btn) {
  document.querySelectorAll('.profile-tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
  btn.classList.add('active');
}

/* ── LISTINGS ─────────────────────────────────────── */

function renderListings(listings) {
  document.getElementById('listingsCount').textContent = listings.length;
  filterListings('all', listings);
}

function filterListings(filter, listings) {
  activeFilter = filter;
  const source = listings || [];
  const show   = filter === 'all' ? source : source.filter(l => l.type === filter);
  const grid   = document.getElementById('profileListings');
  const empty  = document.getElementById('listingsEmpty');

  if (!show.length) {
    grid.style.display  = 'none';
    empty.style.display = 'block';
    return;
  }

  grid.style.display  = 'grid';
  empty.style.display = 'none';

  grid.innerHTML = show.map(l => {
    const price   = l.type === 'swap' ? 'Swap Only' : `£${l.price}`;
    const cond    = condLabels[l.condition] || l.condition;
    const imgHtml = l.images?.[0]
      ? `<img src="${l.images[0]}" alt="${l.title}" style="width:100%;height:100%;object-fit:cover;" />`
      : (l.emoji || '👕');
    return `
      <a href="listing.html?id=${l.id}" class="listing-card">
        <div class="listing-card-img">${imgHtml}</div>
        <div class="listing-card-body">
          <div class="listing-card-title">${l.title}</div>
          <div class="listing-card-meta">Size ${l.size} · ${cond}</div>
          <div class="listing-card-footer">
            <span class="listing-card-price">${price}</span>
            <span class="listing-card-type ${l.type}">${l.type === 'swap' ? 'Swap' : 'Sale'}</span>
          </div>
        </div>
      </a>`;
  }).join('');
}

// Wire up the filter dropdown on the page
document.getElementById('listingsFilter')?.addEventListener('change', function() {
  if (profileUser) fetchUserListings(profileUser.id).then(l => filterListings(this.value, l));
});

/* ── REVIEWS ──────────────────────────────────────── */

function renderReviews(reviews, profile) {
  document.getElementById('reviewsCount').textContent = reviews.length;
  const total = reviews.length;
  const avg   = total
    ? (reviews.reduce((s, r) => s + r.rating, 0) / total).toFixed(1)
    : null;

  // Rating breakdown
  const breakdown = { 5:0, 4:0, 3:0, 2:0, 1:0 };
  reviews.forEach(r => { if (breakdown[r.rating] !== undefined) breakdown[r.rating]++; });

  const bars = [5,4,3,2,1].map(n => {
    const count = breakdown[n];
    const pct   = total ? Math.round((count/total)*100) : 0;
    return `
      <div class="review-bar-row">
        <span class="review-bar-label">${n}★</span>
        <div class="review-bar-track">
          <div class="review-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="review-bar-count">${count}</span>
      </div>`;
  }).join('');

  document.getElementById('reviewsSummary').innerHTML = `
    <div class="review-score-big">
      <div class="score">${avg || '—'}</div>
      <span class="stars">${avg ? starsHtml(parseFloat(avg)) : '☆☆☆☆☆'}</span>
      <div class="total">${total} review${total !== 1 ? 's' : ''}</div>
    </div>
    <div class="review-bars">${bars}</div>`;

  const empty = document.getElementById('reviewsEmpty');
  const list  = document.getElementById('reviewsList');

  if (!reviews.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  list.innerHTML = reviews.map(r => {
    const date     = new Date(r.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
    const initial  = r.reviewer?.avatar_letter || r.reviewer?.username?.[0]?.toUpperCase() || 'U';
    return `
      <div class="review-card">
        <div class="review-card-header">
          <div class="reviewer-info">
            <div class="reviewer-avatar">${initial}</div>
            <div>
              <div class="reviewer-name">${r.reviewer?.username || 'Anonymous'}</div>
              <div class="reviewer-date">${date}</div>
            </div>
          </div>
          <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
        </div>
        <div class="review-text">${r.comment || ''}</div>
      </div>`;
  }).join('');
}

/* ── ABOUT ───────────────────────────────────────── */

function renderAbout(p) {
  const joined = p.created_at
    ? new Date(p.created_at).toLocaleDateString('en-GB', { month:'long', year:'numeric' })
    : 'Recently';
  document.getElementById('aboutGrid').innerHTML = `
    ${p.bio ? `
    <div class="about-card" style="grid-column:1/-1;">
      <h3>About</h3>
      <p>${p.bio}</p>
    </div>` : ''}
    <div class="about-card">
      <h3>Details</h3>
      <div class="about-list">
        ${p.location ? `<div class="about-list-item"><span>📍</span><span>${p.location}</span></div>` : ''}
        <div class="about-list-item"><span>📅</span><span>Member since ${joined}</span></div>
        <div class="about-list-item"><span>💳</span><span>${p.total_sales || 0} completed sales</span></div>
        <div class="about-list-item"><span>🔄</span><span>${p.total_swaps || 0} completed swaps</span></div>
        <div class="about-list-item"><span>⚡</span><span>Avg. response: ${p.response_time || 'Within 24 hrs'}</span></div>
      </div>
    </div>
    ${(p.fav_clubs?.length) ? `
    <div class="about-card">
      <h3>Favourite Clubs</h3>
      <div class="fav-clubs">
        ${p.fav_clubs.map(c => `<span class="fav-club-tag">⚽ ${c}</span>`).join('')}
      </div>
    </div>` : ''}
  `;
}

/* ── FOLLOW ───────────────────────────────────────── */

function toggleFollow() {
  isFollowing = !isFollowing;
  const btn = document.getElementById('followBtn');
  btn.textContent = isFollowing ? '✓ Following' : '+ Follow';
  btn.classList.toggle('following', isFollowing);
}

/* ── HELPERS ─────────────────────────────────────── */

function starsHtml(rating) {
  const full  = Math.floor(rating);
  const half  = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}