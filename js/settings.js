/* ── SETTINGS PAGE — settings.js ────────────────── */

let currentUser    = null;
let currentProfile = null;

/* ── INIT ─────────────────────────────────────────── */

window.addEventListener('DOMContentLoaded', async () => {
  currentUser = await getUser();
  if (!currentUser) { window.location.href = 'login.html'; return; }
  currentProfile = await getProfile(currentUser.id);
  if (currentProfile) populateForm(currentProfile);

  // Bio character counter
  document.getElementById('settingBio')?.addEventListener('input', function() {
    document.getElementById('bioCount').textContent = this.value.length;
  });
});

/* ── POPULATE FORM ────────────────────────────────── */

function populateForm(p) {
  setVal('settingUsername',    p.username    || '');
  setVal('settingFullName',    p.full_name   || '');
  setVal('settingBio',         p.bio         || '');
  setVal('settingLocation',    p.location    || '');
  setVal('settingFavClubs',    (p.fav_clubs  || []).join(', '));
  setVal('settingEmail',       currentUser.email || '');

  const rt = document.getElementById('settingResponseTime');
  if (rt && p.response_time) rt.value = p.response_time;

  const bioEl = document.getElementById('settingBio');
  if (bioEl) document.getElementById('bioCount').textContent = bioEl.value.length;

  // Avatar
  const av = document.getElementById('avatarPreview');
  if (av) av.textContent = p.avatar_letter || p.username?.[0]?.toUpperCase() || 'U';
}

/* ── SECTION SWITCHING ───────────────────────────── */

function switchSection(name, btn) {
  document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.add('active');
  btn.classList.add('active');
}

/* ── SAVE PROFILE ────────────────────────────────── */

async function saveProfile() {
  const username    = getVal('settingUsername').trim();
  const full_name   = getVal('settingFullName').trim();
  const bio         = getVal('settingBio').trim();
  const location    = getVal('settingLocation').trim();
  const favClubsRaw = getVal('settingFavClubs');
  const fav_clubs   = favClubsRaw ? favClubsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
  const response_time = getVal('settingResponseTime');
  const avatar_letter = username?.[0]?.toUpperCase() || 'U';

  if (!username || username.length < 3) {
    showFeedback('profileFeedback', 'Username must be at least 3 characters.', true);
    return;
  }

  const { error } = await sb.from('profiles')
    .update({ username, full_name, bio, location, fav_clubs, response_time, avatar_letter })
    .eq('id', currentUser.id);

  if (error) {
    showFeedback('profileFeedback', error.message.includes('unique') ? '❌ Username already taken.' : '❌ Failed to save.', true);
  } else {
    document.getElementById('avatarPreview').textContent = avatar_letter;
    showFeedback('profileFeedback', '✅ Profile saved!');
  }
}

/* ── UPDATE EMAIL ────────────────────────────────── */

async function updateEmail() {
  const email = getVal('settingEmail').trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFeedback('emailFeedback', '❌ Please enter a valid email.', true); return;
  }
  const { error } = await sb.auth.updateUser({ email });
  if (error) showFeedback('emailFeedback', '❌ ' + error.message, true);
  else showFeedback('emailFeedback', '✅ Confirmation sent to your new email.');
}

/* ── UPDATE PASSWORD ─────────────────────────────── */

async function updatePassword() {
  const pw   = getVal('newPassword');
  const conf = getVal('confirmNewPassword');

  if (pw.length < 8) {
    showFeedback('passwordFeedback', '❌ Password must be at least 8 characters.', true); return;
  }
  if (pw !== conf) {
    showFeedback('passwordFeedback', '❌ Passwords do not match.', true); return;
  }

  const { error } = await sb.auth.updateUser({ password: pw });
  if (error) showFeedback('passwordFeedback', '❌ ' + error.message, true);
  else {
    showFeedback('passwordFeedback', '✅ Password updated!');
    document.getElementById('newPassword').value        = '';
    document.getElementById('confirmNewPassword').value = '';
    document.getElementById('settingsPwBar').style.width = '0%';
    document.getElementById('settingsPwLabel').textContent = '';
  }
}

/* ── PASSWORD STRENGTH ───────────────────────────── */

function checkPwStrength(pw) {
  const bar   = document.getElementById('settingsPwBar');
  const label = document.getElementById('settingsPwLabel');
  if (!bar) return;
  let score = 0;
  if (pw.length >= 8)           score++;
  if (/[A-Z]/.test(pw))        score++;
  if (/[0-9]/.test(pw))        score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { pct:'0%',   color:'#e2e8f0', text:''       },
    { pct:'25%',  color:'#ef4444', text:'Weak'   },
    { pct:'50%',  color:'#f97316', text:'Fair'   },
    { pct:'75%',  color:'#eab308', text:'Good'   },
    { pct:'100%', color:'#16a34a', text:'Strong' },
  ];
  const lvl = pw.length === 0 ? levels[0] : levels[score];
  bar.style.width      = lvl.pct;
  bar.style.background = lvl.color;
  label.textContent    = lvl.text;
  label.style.color    = lvl.color;
}

/* ── SAVE NOTIFICATIONS ──────────────────────────── */

function saveNotifications() {
  // In a full build these preferences would be stored in a
  // user_preferences table in Supabase.
  // For now we just show success feedback.
  showFeedback('notifFeedback', '✅ Notification preferences saved!');
}

/* ── LOG OUT ALL DEVICES ─────────────────────────── */

async function logOutAll() {
  await sb.auth.signOut({ scope: 'global' });
  window.location.href = 'login.html';
}

/* ── STRIPE CONNECT ──────────────────────────────── */

function connectStripe() {
  // Full Stripe Connect onboarding flow comes in the Stripe phase.
  alert('Stripe Connect coming next — this will redirect you to Stripe to set up your payout account.');
}

/* ── DELETE ACCOUNT ──────────────────────────────── */

function confirmDeleteAccount() {
  document.getElementById('deleteOverlay').classList.add('open');
  document.getElementById('deleteModal').classList.add('open');
  document.getElementById('deleteOverlay').style.display = 'block';
  document.getElementById('deleteModal').style.display   = 'block';
}

function closeDeleteModal() {
  document.getElementById('deleteOverlay').classList.remove('open');
  document.getElementById('deleteModal').classList.remove('open');
}

async function deleteAccount() {
  const input = document.getElementById('deleteConfirmInput').value.trim();
  if (input !== 'DELETE') {
    alert('Please type DELETE exactly to confirm.'); return;
  }
  // Delete profile row — auth user deletion requires a Supabase Edge Function
  // for full server-side deletion. For now we sign out and flag the account.
  await sb.from('profiles').update({ username: `deleted_${Date.now()}` }).eq('id', currentUser.id);
  await sb.auth.signOut();
  window.location.href = 'index.html';
}

/* ── TOGGLE PASSWORD VISIBILITY ──────────────────── */

function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const hidden    = input.type === 'password';
  input.type      = hidden ? 'text' : 'password';
  btn.textContent = hidden ? '🙈' : '👁';
}

/* ── FEEDBACK HELPER ─────────────────────────────── */

function showFeedback(id, msg, isError = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
  el.classList.toggle('error', isError);
  setTimeout(() => {
    el.classList.remove('visible', 'error');
  }, 3500);
}

/* ── VALUE HELPERS ───────────────────────────────── */

const getVal = id => document.getElementById(id)?.value || '';
const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };