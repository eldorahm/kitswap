/* ── LISTING PAGE — listing.js (Supabase connected) ── */

const condLabels = {
  mint:'Mint / Unworn', excellent:'Excellent',
  'very-good':'Very Good', good:'Good', fair:'Fair'
};

let currentListing = null;

/* ── INIT ─────────────────────────────────────────── */

window.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');

  if (!id) { showError('No listing ID provided.'); return; }

  showSkeleton();

  const listing = await fetchListing(id);
  if (!listing)  { showError('Listing not found.'); return; }

  currentListing = listing;
  renderListing(listing);
  loadRelated(listing);
});

/* ── SKELETON LOADER ─────────────────────────────── */

function showSkeleton() {
  document.getElementById('listingTitle').textContent = 'Loading...';
  document.getElementById('galleryMain').innerHTML =
    `<div style="width:100%;height:100%;background:#e2e8f0;animation:pulse 1.5s infinite;border-radius:var(--radius);"></div>`;
}

function showError(msg) {
  document.getElementById('listingTitle').textContent = msg;
  document.getElementById('listingPage').style.opacity = '0.5';
}

/* ── RENDER LISTING ──────────────────────────────── */

function renderListing(l) {
  document.title = `${l.title} — KitSwap`;
  document.getElementById('breadcrumbTitle').textContent = l.title;

  renderGallery(l);
  renderBadges(l);
  document.getElementById('listingTitle').textContent = l.title;
  renderPrice(l);
  renderSpecs(l);
  document.getElementById('listingDesc').textContent = l.description || 'No description provided.';
  renderActions(l);
  renderSeller(l.profiles);
}

/* ── GALLERY ─────────────────────────────────────── */

function renderGallery(l) {
  const main   = document.getElementById('galleryMain');
  const thumbs = document.getElementById('galleryThumbs');
  const images = l.images?.length ? l.images : null;

  if (images) {
    main.innerHTML = `<img src="${images[0]}" alt="${l.title}"
      style="width:100%;height:100%;object-fit:cover;" />`;
    thumbs.innerHTML = images.map((img, i) => `
      <div class="gallery-thumb ${i === 0 ? 'active' : ''}"
           onclick="switchImage(this, '${img}', false)">
        <img src="${img}" alt="Photo ${i+1}" />
      </div>`).join('');
  } else {
    main.textContent = l.emoji || '👕';
    thumbs.innerHTML = '';
  }
}

function switchImage(el, src, isEmoji) {
  const main = document.getElementById('galleryMain');
  main.innerHTML = isEmoji
    ? src
    : `<img src="${src}" alt="Shirt" style="width:100%;height:100%;object-fit:cover;" />`;
  document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

/* ── BADGES ──────────────────────────────────────── */

function renderBadges(l) {
  const typeLabel = { sell:'For Sale', swap:'Swap Only', both:'Sale or Swap' }[l.type];
  document.getElementById('listingBadges').innerHTML = `
    <span class="badge badge-${l.type}">${typeLabel}</span>
    <span class="badge badge-league">${l.league || ''}</span>
    <span class="badge badge-condition-${l.condition}">${condLabels[l.condition] || l.condition}</span>
    ${l.signed ? '<span class="badge" style="background:#fef9c3;color:#854d0e;">✍️ Signed</span>' : ''}
  `;
}

/* ── PRICE ───────────────────────────────────────── */

function renderPrice(l) {
  const el = document.getElementById('listingPrice');
  el.innerHTML = l.type === 'swap'
    ? `Swap Only <small>— no cash price</small>`
    : `£${parseFloat(l.price).toFixed(2)} <small>+ postage</small>`;
}

/* ── SPECS ───────────────────────────────────────── */

function renderSpecs(l) {
  const specs = [
    { label:'Club',      value: l.club      || '—' },
    { label:'Season',    value: l.season    || '—' },
    { label:'Size',      value: l.size      || '—' },
    { label:'Brand',     value: l.brand     || '—' },
    { label:'Condition', value: condLabels[l.condition] || l.condition },
    { label:'Player',    value: l.player    || 'No name/number' },
  ];
  document.getElementById('listingSpecs').innerHTML =
    specs.map(s => `
      <div class="spec-item">
        <span class="spec-label">${s.label}</span>
        <span class="spec-value">${s.value}</span>
      </div>`).join('');
}

/* ── ACTION BUTTONS ──────────────────────────────── */

function renderActions(l) {
  let html = '';
  if (l.type === 'sell' || l.type === 'both')
    html += `<button class="btn btn-buy"   onclick="openModal('buy')">💳 Buy Now — £${parseFloat(l.price).toFixed(2)}</button>
             <button class="btn btn-offer" onclick="openModal('offer')">🤝 Make an Offer</button>`;
  if (l.type === 'swap' || l.type === 'both')
    html += `<button class="btn btn-swap"  onclick="openModal('swap')">🔄 Propose a Swap</button>`;
  html += `<button class="btn btn-message" onclick="openModal('message')">💬 Message Seller</button>`;
  document.getElementById('listingActions').innerHTML = html;
}

/* ── SELLER CARD ─────────────────────────────────── */

function renderSeller(p) {
  if (!p) return;
  const joined = p.created_at
    ? new Date(p.created_at).toLocaleDateString('en-GB', { month:'long', year:'numeric' })
    : 'Recently';
  document.getElementById('sellerCard').innerHTML = `
    <div class="seller-info">
      <div class="seller-avatar">${p.avatar_letter || p.username?.[0]?.toUpperCase() || 'U'}</div>
      <div>
        <div class="seller-name">${p.username}</div>
        <div class="seller-meta">Member since ${joined} · ${p.total_sales || 0} sales</div>
        <div class="seller-rating">★ ${p.rating ? parseFloat(p.rating).toFixed(1) : 'New'}
          <span>/ 5.0</span>
        </div>
      </div>
    </div>
    <a href="profile.html?id=${p.id}" class="btn btn-outline">View Profile</a>
  `;
}

/* ── RELATED LISTINGS ────────────────────────────── */

async function loadRelated(l) {
  const grid = document.getElementById('relatedListings');
  if (!grid) return;

  // Fetch listings from same league, exclude current
  const data = await fetchListings({ league: l.league, limit: 5 });
  const others = data.filter(x => x.id !== l.id).slice(0, 4);

  if (!others.length) {
    document.querySelector('.related-section').style.display = 'none';
    return;
  }

  grid.innerHTML = others.map(r => {
    const price   = r.type === 'swap' ? 'Swap Only' : `£${r.price}`;
    const cond    = condLabels[r.condition] || r.condition;
    const imgHtml = r.images?.[0]
      ? `<img src="${r.images[0]}" alt="${r.title}" style="width:100%;height:100%;object-fit:cover;" />`
      : (r.emoji || '👕');
    return `
      <a href="listing.html?id=${r.id}" class="listing-card">
        <div class="listing-card-img">${imgHtml}</div>
        <div class="listing-card-body">
          <div class="listing-card-title">${r.title}</div>
          <div class="listing-card-meta">Size ${r.size} · ${cond}</div>
          <div class="listing-card-footer">
            <span class="listing-card-price">${price}</span>
            <span class="listing-card-type ${r.type}">${r.type === 'swap' ? 'Swap' : 'Sale'}</span>
          </div>
        </div>
      </a>`;
  }).join('');
}

/* ── MODAL ───────────────────────────────────────── */

const modalContents = {
  buy:     { title:'Complete Your Purchase',  body:'You\'re about to buy this shirt. Confirm and you\'ll be taken to secure checkout.',
             form:`<input type="text" placeholder="Your delivery address" />
                   <input type="text" placeholder="Postcode" />
                   <button class="btn btn-primary" onclick="submitAction('buy')">Proceed to Payment</button>` },
  offer:   { title:'Make an Offer',           body:'Send the seller a price offer. They can accept, decline or counter.',
             form:`<input type="number" placeholder="Your offer (£)" min="1" />
                   <textarea rows="3" placeholder="Optional message..."></textarea>
                   <button class="btn btn-primary" onclick="submitAction('offer')">Send Offer</button>` },
  swap:    { title:'Propose a Swap',          body:'Describe what you\'d like to offer in exchange.',
             form:`<input type="text" placeholder="Your shirt (e.g. Liverpool Home 2005/06, Size M)" />
                   <textarea rows="3" placeholder="Condition and details..."></textarea>
                   <button class="btn btn-swap" onclick="submitAction('swap')">Send Swap Proposal</button>` },
  message: { title:'Message the Seller',      body:'Have a question? Send the seller a direct message.',
             form:`<textarea rows="4" placeholder="Type your message..."></textarea>
                   <button class="btn btn-message" onclick="submitAction('message')">Send Message</button>` }
};

function openModal(type) {
  const c = modalContents[type];
  document.getElementById('modalContent').innerHTML = `
    <h2>${c.title}</h2><p>${c.body}</p>
    <div class="modal-form">${c.form}</div>`;
  document.getElementById('actionModal').classList.add('open');
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('actionModal').classList.remove('open');
  document.getElementById('modalOverlay').classList.remove('open');
}

async function submitAction(type) {
  const user = await getUser();
  if (!user) {
    closeModal();
    window.location.href = 'login.html';
    return;
  }
  const msgs = {
    buy:     'Redirecting to payment... (Stripe integration coming next!)',
    offer:   'Offer sent! The seller will be notified.',
    swap:    'Swap proposal sent! The seller will review your offer.',
    message: 'Message sent! You\'ll be notified when they reply.'
  };
  document.getElementById('modalContent').innerHTML = `
    <div style="text-align:center;padding:1.5rem 0;">
      <div style="font-size:3rem;margin-bottom:1rem;">✅</div>
      <h2>Done!</h2>
      <p style="margin-top:0.5rem;color:var(--color-grey);">${msgs[type]}</p>
      <button class="btn btn-primary" style="margin-top:1.5rem;width:100%;" onclick="closeModal()">Close</button>
    </div>`;
}