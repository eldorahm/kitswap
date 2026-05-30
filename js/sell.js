/* ── SELL PAGE — sell.js (Supabase connected) ────── */

let currentStep    = 1;
let uploadedPhotos = [];   // { url, file, publicUrl? }
const KITSWAP_FEE  = 0.05;

/* ── STEP NAVIGATION ─────────────────────────────── */

function goStep(n) {
  if (n > currentStep && !validateStep(currentStep)) return;
  document.getElementById(`step${currentStep}`).classList.remove('active');
  document.getElementById(`pill${currentStep}`).classList.remove('active');
  document.getElementById(`pill${currentStep}`).classList.add('done');
  currentStep = n;
  document.getElementById(`step${n}`).classList.add('active');
  for (let i = 1; i <= 4; i++) {
    const pill = document.getElementById(`pill${i}`);
    pill.classList.remove('active','done');
    if (i < n)       pill.classList.add('done');
    else if (i === n) pill.classList.add('active');
  }
  if (n === 4) buildFullPreview();
  window.scrollTo({ top:0, behavior:'smooth' });
}

/* ── VALIDATION ──────────────────────────────────── */

function validateStep(step) {
  let ok = true;
  if (step === 1) {
    const checks = [
      ['listingTitle', 'titleError', 'Please enter a listing title.'],
      ['club',         'clubError',  'Please enter the club name.'],
      ['description',  'descError',  'Please add a description.'],
    ];
    checks.forEach(([id, errId, msg]) => {
      if (!val(id)) { setErr(errId, msg); ok = false; }
      else           clearErr(errId);
    });
    if (!val('season') || !val('league') || !val('size') || !val('condition')) ok = false;
  }
  if (step === 2) {
    const type = getType();
    if ((type === 'sell' || type === 'both') && !(parseFloat(val('price')) >= 1)) {
      setErr('priceError', 'Please enter a valid price.'); ok = false;
    } else clearErr('priceError');
    if ((type === 'swap' || type === 'both') && !val('swapFor')) {
      setErr('swapError', "Please describe what you're looking to swap for."); ok = false;
    } else clearErr('swapError');
  }
  return ok;
}

const val      = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
const setErr   = (id, msg) => { const el = document.getElementById(id); if (el) el.textContent = msg; };
const clearErr = id => setErr(id, '');
const getType  = () => (document.querySelector('input[name="listingType"]:checked')?.value || 'sell');

/* ── LIVE PREVIEW ────────────────────────────────── */

function updatePreview() {
  const condMap  = { mint:'Mint', excellent:'Excellent', 'very-good':'Very Good', good:'Good', fair:'Fair' };
  const title    = val('listingTitle') || 'Your listing title';
  const size     = val('size');
  const cond     = val('condition');
  const price    = val('price');
  const type     = getType();

  document.getElementById('previewTitle').textContent = title;
  document.getElementById('previewMeta').textContent  =
    [size ? `Size ${size}` : '', condMap[cond] || ''].filter(Boolean).join(' · ') || 'Size · Condition';

  const priceEl   = document.getElementById('previewPrice');
  priceEl.textContent = type === 'swap' ? 'Swap Only' : price ? `£${parseFloat(price).toFixed(2)}` : '£—';

  const typeEl    = document.getElementById('previewType');
  typeEl.textContent  = type === 'swap' ? 'Swap' : type === 'both' ? 'Sale/Swap' : 'Sale';
  typeEl.className    = `listing-card-type ${type}`;

  if (uploadedPhotos.length > 0) {
    const imgEl = document.getElementById('previewImg');
    imgEl.innerHTML = `<img src="${uploadedPhotos[0].url}" alt="Preview"
      style="width:100%;height:100%;object-fit:cover;" />`;
  }

  const titleInput = document.getElementById('listingTitle');
  if (titleInput) document.getElementById('titleCount').textContent = titleInput.value.length;
  updateFees();
}

function updateDesc() {
  const ta = document.getElementById('description');
  if (ta) document.getElementById('descCount').textContent = ta.value.length;
}

/* ── FEE CALCULATOR ──────────────────────────────── */

function updateFees() {
  const price = parseFloat(val('price')) || 0;
  const fee   = price * KITSWAP_FEE;
  const fmt   = n => `£${n.toFixed(2)}`;
  document.getElementById('feeAsk').textContent = fmt(price);
  document.getElementById('feeCut').textContent = `−${fmt(fee)}`;
  document.getElementById('feeNet').textContent = fmt(price - fee);
}

document.getElementById('price')?.addEventListener('input', updateFees);

/* ── LISTING TYPE SWITCH ─────────────────────────── */

function switchListingType(type) {
  document.getElementById('priceFields').style.display = (type === 'sell' || type === 'both') ? 'block' : 'none';
  document.getElementById('swapFields').style.display  = (type === 'swap' || type === 'both') ? 'block' : 'none';
  updatePreview();
}

/* ── TOGGLE LABELS ───────────────────────────────── */

document.getElementById('signed')?.addEventListener('change', function () {
  document.getElementById('signedLabel').textContent = this.checked ? 'Yes — signed!' : 'No';
});

document.getElementById('acceptOffers')?.addEventListener('change', function () {
  document.getElementById('offersLabel').textContent = this.checked
    ? 'Yes — buyers can make offers' : 'No — fixed price only';
});

/* ── PHOTO UPLOAD ────────────────────────────────── */

function handleFileInput(e) { addPhotos([...e.target.files]); e.target.value = ''; }

function handleDragOver(e)  { e.preventDefault(); document.getElementById('uploadArea').classList.add('drag-over'); }
function handleDragLeave()  { document.getElementById('uploadArea').classList.remove('drag-over'); }
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('uploadArea').classList.remove('drag-over');
  addPhotos([...e.dataTransfer.files].filter(f => f.type.startsWith('image/')));
}

function addPhotos(files) {
  files.slice(0, 8 - uploadedPhotos.length).forEach(file => {
    if (file.size > 5 * 1024 * 1024) { alert(`${file.name} exceeds 5MB limit.`); return; }
    uploadedPhotos.push({ url: URL.createObjectURL(file), file });
  });
  renderPhotoGrid();
  updatePreview();
}

function removePhoto(i) {
  URL.revokeObjectURL(uploadedPhotos[i].url);
  uploadedPhotos.splice(i, 1);
  renderPhotoGrid();
  updatePreview();
}

function renderPhotoGrid() {
  document.getElementById('photoGrid').innerHTML = uploadedPhotos.map((p, i) => `
    <div class="photo-item ${i === 0 ? 'main-photo' : ''}">
      <img src="${p.url}" alt="Photo ${i+1}" />
      ${i === 0 ? '<span class="photo-main-badge">Main</span>' : ''}
      <button class="photo-remove" onclick="removePhoto(${i})">×</button>
    </div>`).join('');
}

/* ── FULL PREVIEW (step 4) ───────────────────────── */

function buildFullPreview() {
  const type     = getType();
  const price    = parseFloat(val('price'));
  const condMap  = { mint:'Mint / Unworn', excellent:'Excellent', 'very-good':'Very Good', good:'Good', fair:'Fair' };
  const typeMap  = { sell:'For Sale', swap:'Swap Only', both:'Sale or Swap' };
  const imgHtml  = uploadedPhotos.length > 0
    ? `<img src="${uploadedPhotos[0].url}" alt="Shirt" />`
    : '👕';
  const priceHtml = type === 'swap' ? 'Swap Only'
    : price ? `£${price.toFixed(2)} <small>+ postage</small>` : '£— (not set)';
  const specs = [
    { label:'Club',      value: val('club')      || '—' },
    { label:'Season',    value: val('season')    || '—' },
    { label:'Brand',     value: val('brand')     || '—' },
    { label:'Size',      value: val('size')      || '—' },
    { label:'Condition', value: condMap[val('condition')] || '—' },
    { label:'Player',    value: val('player')    || 'No name/number' },
  ];
  document.getElementById('fullPreview').innerHTML = `
    <div class="full-preview-img">${imgHtml}</div>
    <div class="full-preview-body">
      <div class="full-preview-badges">
        <span class="badge badge-${type}">${typeMap[type]}</span>
        <span class="badge badge-league">${val('league') || 'League'}</span>
        <span class="badge badge-condition-${val('condition')}">${condMap[val('condition')] || 'Condition'}</span>
      </div>
      <div class="full-preview-title">${val('listingTitle') || 'No title entered'}</div>
      <div class="full-preview-price">${priceHtml}</div>
      <div class="full-preview-specs">
        ${specs.map(s => `
          <div class="spec-item">
            <span class="spec-label">${s.label}</span>
            <span class="spec-value">${s.value}</span>
          </div>`).join('')}
      </div>
      <div class="full-preview-desc">${val('description') || 'No description entered.'}</div>
    </div>`;
}

/* ── PUBLISH ─────────────────────────────────────── */

async function publishListing() {
  const publishBtn = document.querySelector('.btn-publish');
  publishBtn.textContent   = '⏳ Publishing...';
  publishBtn.disabled      = true;

  try {
    // 1. Check user is logged in
    const user = await getUser();
    if (!user) {
      alert('You must be logged in to publish a listing.');
      window.location.href = 'login.html';
      return;
    }

    // 2. Build listing data object
    const type  = getType();
    const price = parseFloat(val('price')) || null;
    const listingData = {
      title:       val('listingTitle'),
      description: val('description'),
      club:        val('club'),
      league:      val('league'),
      season:      val('season'),
      brand:       val('brand'),
      size:        val('size'),
      condition:   val('condition'),
      player:      val('player'),
      signed:      document.getElementById('signed')?.checked || false,
      type,
      price:       (type === 'sell' || type === 'both') ? price : null,
      swap_for:    (type === 'swap' || type === 'both') ? val('swapFor') : null,
      shipping:    val('shippingCost'),
      ships_from:  val('shipsFrom'),
      emoji:       '👕',
      images:      [],
    };

    // 3. Create listing first (we need the ID for photo paths)
    const { data: listing, error: listingErr } = await createListing(listingData);
    if (listingErr) throw listingErr;

    // 4. Upload photos to Supabase Storage
    if (uploadedPhotos.length > 0) {
      const uploadedUrls = [];
      for (const photo of uploadedPhotos) {
        const url = await uploadListingPhoto(photo.file, listing.id);
        if (url) uploadedUrls.push(url);
      }
      // 5. Update listing with photo URLs
      if (uploadedUrls.length > 0) {
        await sb.from('listings')
          .update({ images: uploadedUrls })
          .eq('id', listing.id);
      }
    }

    // 6. Show success
    document.getElementById('successOverlay').classList.add('open');
    document.getElementById('successModal').classList.add('open');

    // Update success modal link to real listing
    document.querySelector('#successModal a').href = `listing.html?id=${listing.id}`;

  } catch (err) {
    console.error('Publish error:', err);
    alert('Something went wrong publishing your listing. Please try again.');
  } finally {
    publishBtn.textContent = '🚀 Publish Listing';
    publishBtn.disabled    = false;
  }
}

function resetForm() {
  document.getElementById('successOverlay').classList.remove('open');
  document.getElementById('successModal').classList.remove('open');
  uploadedPhotos = [];
  renderPhotoGrid();
  document.getElementById('step4').classList.remove('active');
  goStep(1);
}

/* ── INIT ─────────────────────────────────────────── */

window.addEventListener('DOMContentLoaded', () => {
  updatePreview();
  updateFees();
});