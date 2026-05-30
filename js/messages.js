/* ── MESSAGES PAGE — messages.js (Supabase connected) ── */

let conversations    = [];
let activeConvId     = null;
let activeChannel    = null;
let currentUser      = null;
let currentProfile   = null;
let inboxFilter      = 'all';
let searchQuery      = '';

const quickReplies = [
  'Is this still available?',
  'Would you accept a lower offer?',
  'How quickly can you ship?',
  'Can I see more photos?',
];

/* ── INIT ─────────────────────────────────────────── */

window.addEventListener('DOMContentLoaded', async () => {
  currentUser = await getUser();
  if (!currentUser) { window.location.href = 'login.html'; return; }
  currentProfile = await getProfile(currentUser.id);

  await loadConversations();
  renderQuickReplies();
});

/* ── LOAD CONVERSATIONS ──────────────────────────── */

async function loadConversations() {
  conversations = await fetchConversations();
  updateUnreadTotal();
  renderConversationList();
}

/* ── UNREAD COUNT ────────────────────────────────── */

function updateUnreadTotal() {
  // For now unread count is placeholder — full unread tracking
  // requires a messages_read table (future enhancement)
  const el = document.getElementById('inboxUnreadTotal');
  el.style.display = 'none';
}

/* ── RENDER CONVERSATION LIST ────────────────────── */

function renderConversationList() {
  const list  = document.getElementById('conversationList');
  let   shown = conversations.filter(c => {
    if (inboxFilter === 'buying'  && c.buyer_id  !== currentUser.id) return false;
    if (inboxFilter === 'selling' && c.seller_id !== currentUser.id) return false;
    const other = getOtherUser(c);
    if (searchQuery && !other?.username?.toLowerCase().includes(searchQuery) &&
        !(c.listing?.title || '').toLowerCase().includes(searchQuery)) return false;
    return true;
  });

  if (!shown.length) {
    list.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--color-grey);font-size:0.875rem;">
      ${conversations.length ? 'No conversations match your filter.' : 'No conversations yet. Message a seller to get started!'}
    </div>`;
    return;
  }

  list.innerHTML = shown.map(c => {
    const other = getOtherUser(c);
    const l     = c.listing;
    const name  = other?.username || 'Unknown';
    const init  = other?.avatar_letter || name[0]?.toUpperCase() || 'U';
    const color = stringToColor(name);
    const date  = new Date(c.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' });
    return `
      <div class="conversation-item ${activeConvId === c.id ? 'active' : ''}"
           onclick="openConversation(${c.id})">
        <div class="conv-avatar" style="background:${color}">${init}</div>
        <div class="conv-body">
          <div class="conv-top">
            <span class="conv-name">${name}</span>
            <span class="conv-time">${date}</span>
          </div>
          ${l ? `<div class="conv-listing">${l.emoji || '👕'} ${l.title}</div>` : ''}
          <div class="conv-preview">Tap to view messages</div>
        </div>
      </div>`;
  }).join('');
}

/* ── OPEN CONVERSATION ───────────────────────────── */

async function openConversation(id) {
  activeConvId = id;
  const conv   = conversations.find(c => c.id === id);
  if (!conv) return;

  const other = getOtherUser(conv);
  const name  = other?.username || 'Unknown';
  const init  = other?.avatar_letter || name[0]?.toUpperCase() || 'U';
  const color = stringToColor(name);
  const l     = conv.listing;

  // Update sidebar highlight
  renderConversationList();

  // Show chat panel
  document.getElementById('chatEmpty').style.display  = 'none';
  document.getElementById('chatActive').style.display = 'flex';
  document.getElementById('chatWindow').classList.add('mobile-open');
  document.getElementById('inboxSidebar').classList.add('mobile-hidden');

  // Header
  document.getElementById('chatHeaderUser').innerHTML = `
    <div class="chat-header-avatar" style="background:${color}">${init}</div>
    <div>
      <div class="chat-header-name">${name}</div>
      <div class="chat-header-status">Active member</div>
    </div>`;

  // Listing ref
  document.getElementById('chatListingRef').innerHTML = l ? `
    <div class="listing-ref-emoji">${l.emoji || '👕'}</div>
    <div class="listing-ref-info">
      <div class="listing-ref-title">${l.title}</div>
      <div class="listing-ref-price">${l.type === 'swap' ? 'Swap Only' : l.price ? `£${l.price}` : ''}</div>
    </div>
    <a href="listing.html?id=${l.id}" class="listing-ref-link">View →</a>` : '';

  // Load messages
  await loadMessages(id);

  // Subscribe to real-time new messages
  if (activeChannel) await activeChannel.unsubscribe();
  activeChannel = await subscribeToMessages(id, payload => {
    appendMessage(payload.new, false);
  });
}

/* ── LOAD MESSAGES ───────────────────────────────── */

async function loadMessages(convId) {
  const msgs      = await fetchMessages(convId);
  const container = document.getElementById('chatMessages');
  container.innerHTML = '';

  if (!msgs.length) {
    container.innerHTML = `<div class="system-message">Start the conversation!</div>`;
    return;
  }

  let lastDate = null;
  msgs.forEach(m => {
    const date = new Date(m.created_at).toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' });
    if (date !== lastDate) {
      const sep = document.createElement('div');
      sep.className   = 'date-separator';
      sep.textContent = date;
      container.appendChild(sep);
      lastDate = date;
    }
    appendMessage(m, true);
  });
}

/* ── APPEND A MESSAGE BUBBLE ─────────────────────── */

function appendMessage(m, skipScroll = false) {
  const container = document.getElementById('chatMessages');
  const isSent    = m.sender_id === currentUser.id;
  const time      = new Date(m.created_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
  const conv      = conversations.find(c => c.id === activeConvId);
  const other     = conv ? getOtherUser(conv) : null;
  const init      = other?.avatar_letter || '?';
  const color     = stringToColor(other?.username || '');

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="message-row ${isSent ? 'sent' : 'received'}">
      ${!isSent ? `<div class="msg-avatar" style="background:${color}">${init}</div>` : ''}
      <div class="message-bubble">${escHtml(m.content)}</div>
    </div>
    <div class="message-time">${time}</div>`;
  container.appendChild(wrap);

  if (!skipScroll) container.scrollTop = container.scrollHeight;
  else setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
}

/* ── SEND MESSAGE ────────────────────────────────── */

async function sendMessage() {
  const input   = document.getElementById('chatInput');
  const content = input.value.trim();
  if (!content || !activeConvId) return;

  input.value        = '';
  input.style.height = 'auto';

  const { error } = await sbSendMessage(activeConvId, content);
  if (error) { console.error('Send error:', error); return; }

  // Optimistically show the message immediately
  appendMessage({
    sender_id:  currentUser.id,
    content,
    created_at: new Date().toISOString()
  });
}

// Alias to avoid naming conflict with the global sendMessage helper
const sbSendMessage = window.sendMessage
  ? (convId, content) => window.sendMessage(convId, content)
  : sendMessage;

// Override: use the Supabase helper from supabase.js
async function sendMessage() {
  const input   = document.getElementById('chatInput');
  const content = input.value.trim();
  if (!content || !activeConvId) return;
  input.value = '';
  input.style.height = 'auto';
  const { error } = await sbSend(activeConvId, content);
  if (error) console.error('Send failed:', error);
  else appendMessage({ sender_id: currentUser.id, content, created_at: new Date().toISOString() });
}

const sbSend = (convId, content) =>
  sb.from('messages')
    .insert({ conversation_id: convId, sender_id: currentUser.id, content })
    .select().single();

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

/* ── QUICK REPLIES ───────────────────────────────── */

function renderQuickReplies() {
  document.getElementById('quickReplies').innerHTML =
    quickReplies.map(r => `
      <button class="quick-reply-btn" onclick="useQuickReply('${escAttr(r)}')">${r}</button>
    `).join('');
}

function useQuickReply(text) {
  document.getElementById('chatInput').value = text;
  document.getElementById('chatInput').focus();
}

/* ── INBOX TABS ──────────────────────────────────── */

function switchInboxTab(filter, btn) {
  inboxFilter = filter;
  document.querySelectorAll('.inbox-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderConversationList();
}

/* ── SEARCH ──────────────────────────────────────── */

function filterConversations(q) {
  searchQuery = q.toLowerCase();
  renderConversationList();
}

/* ── MOBILE BACK ─────────────────────────────────── */

function showInbox() {
  if (activeChannel) activeChannel.unsubscribe();
  document.getElementById('chatWindow').classList.remove('mobile-open');
  document.getElementById('inboxSidebar').classList.remove('mobile-hidden');
  document.getElementById('chatActive').style.display = 'none';
  document.getElementById('chatEmpty').style.display  = 'flex';
  activeConvId = null;
}

/* ── TEXTAREA AUTO RESIZE ────────────────────────── */

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

/* ── HEADER ACTIONS ──────────────────────────────── */

function viewSellerProfile() {
  const conv  = conversations.find(c => c.id === activeConvId);
  const other = conv ? getOtherUser(conv) : null;
  if (other) window.location.href = `profile.html?id=${other.id}`;
}

function reportUser() {
  alert('Report submitted. Our team will review this conversation within 24 hours.');
}

/* ── HELPERS ─────────────────────────────────────── */

function getOtherUser(conv) {
  if (!currentUser) return null;
  return currentUser.id === conv.buyer_id ? conv.seller : conv.buyer;
}

function stringToColor(str) {
  const colors = ['#6366f1','#ef4444','#f59e0b','#10b981','#0ea5e9','#8b5cf6','#ec4899','#14b8a6'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function escAttr(str) {
  return str.replace(/'/g,"\\'");
}