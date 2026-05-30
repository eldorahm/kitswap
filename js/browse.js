/* ── BROWSE PAGE — browse.js (Supabase connected) ── */

const PAGE_SIZE  = 12;
let allFetched   = [];
let filtered     = [];
let visibleCount = PAGE_SIZE;
let isLoading    = false;

const condLabels = {
  mint:'Mint', excellent:'Excellent',
  'very-good':'Very Good', good:'Good', fair:'Fair'
};

/* ── INIT ─────────────────────────────────────────── */

window.addEventListener('DOMContentLoaded', async () => {
  readURLParams();
  await loadListings();
});

/* ── READ URL PARAMS ─────────────────────────────── */

function readURLParams() {
  const params = new URLSearchParams(window.location.search);
  const q    = params.get('q');
  const cat  = params.get('cat');
  const type = params.get('type');
  if (q)    document.getElementById('browseSearch').value = q;
  if (cat)  { const cb = document.querySelector(`input[name="league"][value="${cat}"]`); if (cb) cb.checked = true; }
  if (type) { const cb = document.querySelector(`input[name="type"][value="${type}"]`);  if (cb) cb.checked = true; }
}

/* ── LOAD FROM SUPABASE ──────────────────────────── */

async function loadListings() {
  if (isLoading) return;
  isLoading = true;
  showSkeletons();

  try {
    // Fetch all active listings (up to 200) — then filter client-side
    // For very large catalogues this would switch to server-side filtering
    const data = await fetchListings({ limit: 200 });
    allFetched  = data;
    applyFilters();
  } catch (err) {
    console.error('Browse load error:', err);
    document.getElementById('resultsMeta').textContent = 'Failed to load listings.';
  } finally {
    isLoading = false;
  }
}

function showSkeletons() {
  const grid = document.getElementById('browseListings');
  grid.style.display = 'grid';
  grid.innerHTML = Array(8).fill(`
    <div class="listing-card" style="pointer-events:none;">
      <div class="listing-card-img" style="background:#e2e8f0;animation:pulse 1.5s infinite;"></div>
      <div class="listing-card-body">
        <div style="height:14px;background:#e2e8f0;border-radius:4px;margin-bottom:8px;animation:pulse 1.5s infinite;"></div>
        <div style="height:12px;background:#f1f5f9;border-radius:4px;width:60%;animation:pulse 1.5s infinite;"></div>
      </div>
    </div>`).join('');
}

/* ── FILTER + SORT ───────────────────────────────── */

function applyFilters() {
  visibleCount = PAGE_SIZE;

  const query      = document.getElementById('browseSearch').value.toLowerCase().trim();
  const sortVal    = document.getElementById('sortSelect').value;
  const priceMin   = parseFloat(document.getElementById('priceMin').value) || 0;
  const priceMax   = parseFloat(document.getElementById('priceMax').value) || Infinity;
  const checkedTypes      = getChecked('type');
  const checkedLeagues    = getChecked('league');
  const checkedSizes      = getChecked('size');
  const checkedConditions = getChecked('condition');

  filtered = allFetched.filter(l => {
    if (query && !l.title.toLowerCase().includes(query) &&
        !(l.club || '').toLowerCase().includes(query)) return false;
    if (checkedTypes.length   && !checkedTypes.includes(l.type))       return false;
    if (checkedLeagues.length && !checkedLeagues.some(lg =>
        (l.league || '').toLowerCase().includes(lg.replace('-',' ')))) return false;
    if (checkedSizes.length      && !checkedSizes.includes(l.size))          return false;
    if (checkedConditions.length && !checkedConditions.includes(l.condition)) return false;
    const p = l.price ?? 0;
    if (p < priceMin || p > priceMax) return false;
    return true;
  });

  // Sort
  const condOrder = { mint:5, excellent:4, 'very-good':3, good:2, fair:1 };
  filtered.sort((a, b) => {
    if (sortVal === 'price-asc')  return (a.price ?? 0) - (b.price ?? 0);
    if (sortVal === 'price-desc') return (b.price ?? 0) - (a.price ?? 0);
    if (sortVal === 'condition')  return (condOrder[b.condition]||0) - (condOrder[a.condition]||0);
    return new Date(b.created_at) - new Date(a.created_at);
  });

  renderResults();
  renderActiveTags({ query, checkedTypes, checkedLeagues, checkedSizes, checkedConditions, priceMin, priceMax });
}

/* ── RENDER ──────────────────────────────────────── */

function renderResults() {
  const grid     = document.getElementById('browseListings');
  const empty    = document.getElementById('emptyState');
  const meta     = document.getElementById('resultsMeta');
  const loadWrap = document.getElementById('loadMoreWrap');
  const slice    = filtered.slice(0, visibleCount);

  meta.textContent = filtered.length === 0
    ? 'No results'
    : `Showing ${Math.min(visibleCount, filtered.length)} of ${filtered.length} listing${filtered.length !== 1 ? 's' : ''}`;

  empty.style.display    = filtered.length === 0 ? 'block' : 'none';
  grid.style.display     = filtered.length === 0 ? 'none'  : 'grid';
  loadWrap.style.display = filtered.length > visibleCount ? 'block' : 'none';

  grid.innerHTML = slice.map(listingCard).join('');
}

function listingCard(l) {
  const priceStr = l.type === 'swap' ? 'Swap Only' : `£${l.price}`;
  const cond     = condLabels[l.condition] || l.condition;
  const imgHtml  = (l.images && l.images[0])
    ? `<img src="${l.images[0]}" alt="${l.title}" style="width:100%;height:100%;object-fit:cover;" />`
    : (l.emoji || '👕');
  return `
    <a href="listing.html?id=${l.id}" class="listing-card">
      <div class="listing-card-img">${imgHtml}</div>
      <div class="listing-card-body">
        <div class="listing-card-title">${l.title}</div>
        <div class="listing-card-meta">Size ${l.size} · ${cond}</div>
        <div class="listing-card-footer">
          <span class="listing-card-price">${priceStr}</span>
          <span class="listing-card-type ${l.type}">${l.type === 'swap' ? 'Swap' : 'Sale'}</span>
        </div>
      </div>
    </a>`;
}

/* ── LOAD MORE ───────────────────────────────────── */

function loadMore() {
  visibleCount += PAGE_SIZE;
  renderResults();
}

/* ── ACTIVE FILTER TAGS ──────────────────────────── */

function renderActiveTags({ query, checkedTypes, checkedLeagues, checkedSizes, checkedConditions, priceMin, priceMax }) {
  const wrap = document.getElementById('activeFilters');
  const tags = [];
  if (query) tags.push({ label:`"${query}"`, clear:() => { document.getElementById('browseSearch').value=''; applyFilters(); }});
  checkedTypes.forEach(v      => tags.push({ label: v==='sell'?'For Sale':v==='swap'?'Swap Only':'Sale or Swap', clear:()=>uncheckBox('type',v) }));
  checkedLeagues.forEach(v    => tags.push({ label: leagueLabel(v), clear:()=>uncheckBox('league',v) }));
  checkedSizes.forEach(v      => tags.push({ label:`Size ${v}`,     clear:()=>uncheckBox('size',v) }));
  checkedConditions.forEach(v => tags.push({ label: condLabel(v),   clear:()=>uncheckBox('condition',v) }));
  if (priceMin > 0)        tags.push({ label:`Min £${priceMin}`, clear:()=>{ document.getElementById('priceMin').value=''; applyFilters(); }});
  if (priceMax < Infinity) tags.push({ label:`Max £${priceMax}`, clear:()=>{ document.getElementById('priceMax').value=''; applyFilters(); }});
  wrap.innerHTML = tags.map((t,i) => `
    <span class="filter-tag">${t.label}
      <button onclick="removeTag(${i})">×</button>
    </span>`).join('');
  wrap._tagCallbacks = tags.map(t => t.clear);
}

function removeTag(i) {
  const w = document.getElementById('activeFilters');
  if (w._tagCallbacks?.[i]) w._tagCallbacks[i]();
}

/* ── CLEAR ALL ───────────────────────────────────── */

function clearFilters() {
  document.getElementById('browseSearch').value = '';
  document.getElementById('priceMin').value     = '';
  document.getElementById('priceMax').value     = '';
  document.querySelectorAll('.filter-sidebar input[type="checkbox"]').forEach(cb => cb.checked = false);
  applyFilters();
}

/* ── MOBILE SIDEBAR ──────────────────────────────── */

function toggleMobileFilters() {
  document.getElementById('filterSidebar').classList.toggle('open');
  document.getElementById('filterOverlay').classList.toggle('open');
}

document.getElementById('closeFilters')?.addEventListener('click', toggleMobileFilters);

/* ── HELPERS ─────────────────────────────────────── */

function getChecked(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(el => el.value);
}

function uncheckBox(name, value) {
  const cb = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (cb) { cb.checked = false; applyFilters(); }
}

function leagueLabel(v) {
  return { 'premier-league':'Premier League','la-liga':'La Liga','serie-a':'Serie A',
           'bundesliga':'Bundesliga','national':'National Teams','retro':'Retro & Vintage','other':'Other' }[v] || v;
}

function condLabel(v) {
  return { mint:'Mint', excellent:'Excellent','very-good':'Very Good', good:'Good', fair:'Fair' }[v] || v;
}