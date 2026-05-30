/* ── AUTH.JS — Real Supabase authentication ──────── */

/* ── PASSWORD VISIBILITY TOGGLE ──────────────────── */

function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const hidden = input.type === 'password';
  input.type   = hidden ? 'text' : 'password';
  btn.textContent = hidden ? '🙈' : '👁';
}

/* ── PASSWORD STRENGTH ───────────────────────────── */

function checkPasswordStrength(pw) {
  const bar   = document.getElementById('pwStrengthBar');
  const label = document.getElementById('pwStrengthLabel');
  if (!bar || !label) return;
  let score = 0;
  if (pw.length >= 8)           score++;
  if (/[A-Z]/.test(pw))        score++;
  if (/[0-9]/.test(pw))        score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { pct:'0%',   color:'#e2e8f0', text:'' },
    { pct:'25%',  color:'#ef4444', text:'Weak' },
    { pct:'50%',  color:'#f97316', text:'Fair' },
    { pct:'75%',  color:'#eab308', text:'Good' },
    { pct:'100%', color:'#16a34a', text:'Strong' },
  ];
  const lvl = pw.length === 0 ? levels[0] : levels[score];
  bar.style.width      = lvl.pct;
  bar.style.background = lvl.color;
  label.textContent    = lvl.text;
  label.style.color    = lvl.color;
}

/* ── USERNAME CHECK ──────────────────────────────── */

const takenUsernames = ['admin','kitswap','support','mod','moderator'];

function checkUsername(val) {
  const hint  = document.getElementById('usernameHint');
  const error = document.getElementById('usernameError');
  if (!hint || !error) return;
  hint.textContent  = '';
  error.textContent = '';
  if (val.length < 3) { error.textContent = 'At least 3 characters required.'; return; }
  if (!/^[a-zA-Z0-9_]+$/.test(val)) { error.textContent = 'Letters, numbers and underscores only.'; return; }
  if (takenUsernames.includes(val.toLowerCase())) { error.textContent = 'Username already taken.'; return; }
  hint.textContent = '✓ Username available!';
}

/* ── HELPERS ─────────────────────────────────────── */

function setErr(id, msg)  { const el = document.getElementById(id); if (el) el.textContent = msg; }
function clearErr(id)     { setErr(id, ''); }
function markField(id, ok) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('success', ok);
  el.classList.toggle('error', !ok);
}
function showAuthError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
}
function hideAuthError(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('visible');
}
function setLoading(btnId, loading, label) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.textContent = loading ? 'Please wait...' : label;
  btn.classList.toggle('loading', loading);
}

/* ── LOGIN ───────────────────────────────────────── */

async function handleLogin(e) {
  e.preventDefault();
  let valid = true;
  hideAuthError('authError');
  clearErr('emailError');
  clearErr('passwordError');

  const email = document.getElementById('loginEmail').value.trim();
  const pw    = document.getElementById('loginPassword').value;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setErr('emailError', 'Please enter a valid email address.');
    markField('loginEmail', false);
    valid = false;
  } else { markField('loginEmail', true); }

  if (!pw || pw.length < 6) {
    setErr('passwordError', 'Please enter your password (min 6 characters).');
    markField('loginPassword', false);
    valid = false;
  } else { markField('loginPassword', true); }

  if (!valid) return;

  setLoading('loginBtn', true, 'Log In');

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });

  setLoading('loginBtn', false, 'Log In');

  if (error) {
    showAuthError('authError', '❌ ' + (error.message || 'Login failed. Please check your credentials.'));
    return;
  }

  // Success — redirect to homepage
  window.location.href = 'index.html';
}

/* ── REGISTER ────────────────────────────────────── */

async function handleRegister(e) {
  e.preventDefault();
  let valid = true;
  hideAuthError('registerError');

  const firstName = document.getElementById('firstName').value.trim();
  const lastName  = document.getElementById('lastName').value.trim();
  const username  = document.getElementById('username').value.trim();
  const email     = document.getElementById('regEmail').value.trim();
  const pw        = document.getElementById('regPassword').value;
  const pwConf    = document.getElementById('confirmPassword').value;
  const agreed    = document.getElementById('agreeTerms').checked;

  if (!firstName) { setErr('firstNameError', 'Please enter your first name.'); valid = false; }
  else clearErr('firstNameError');

  if (username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) {
    setErr('usernameError', 'Username must be 3+ characters, letters/numbers/underscores only.');
    valid = false;
  } else if (takenUsernames.includes(username.toLowerCase())) {
    setErr('usernameError', 'This username is taken.'); valid = false;
  } else clearErr('usernameError');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setErr('regEmailError', 'Please enter a valid email address.'); valid = false;
  } else clearErr('regEmailError');

  if (pw.length < 8) {
    setErr('regPasswordError', 'Password must be at least 8 characters.'); valid = false;
  } else clearErr('regPasswordError');

  if (pw !== pwConf) {
    setErr('confirmPasswordError', 'Passwords do not match.'); valid = false;
  } else clearErr('confirmPasswordError');

  if (!agreed) {
    setErr('termsError', 'You must agree to the Terms of Service.'); valid = false;
  } else clearErr('termsError');

  if (!valid) return;

  setLoading('registerBtn', true, 'Create Free Account');

  // Sign up with Supabase — passes username and full_name as metadata
  // The database trigger will auto-create the profile row
  const { data, error } = await sb.auth.signUp({
    email,
    password: pw,
    options: {
      data: {
        username,
        full_name: `${firstName} ${lastName}`.trim(),
      }
    }
  });

  setLoading('registerBtn', false, 'Create Free Account');

  if (error) {
    showAuthError('registerError', '❌ ' + (error.message || 'Registration failed. Please try again.'));
    return;
  }

  // Supabase sends a confirmation email by default.
  // For now, redirect immediately (you can enable email confirmation in Supabase Auth settings)
  window.location.href = 'index.html';
}

/* ── SOCIAL LOGIN ────────────────────────────────── */

async function socialLogin(provider) {
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin + '/index.html' }
  });
  if (error) alert('Social login error: ' + error.message);
}