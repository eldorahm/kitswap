/* ── FORUM PAGE — forum.js (Supabase connected) ──── */

const categories = ["All","General Discussion","Shirt Showcase","Buying Advice","Authentication Help","Trade Wanted","News & Releases"];

const catColors = {
  "General Discussion":  { bg:"#FDF6E3", color:"#B8960C" },
  "Shirt Showcase":      { bg:"#eff6ff", color:"#1d4ed8" },
  "Buying Advice":       { bg:"#fef9c3", color:"#854d0e" },
  "Authentication Help": { bg:"#fef2f2", color:"#b91c1c" },
  "Trade Wanted":        { bg:"#f5f3ff", color:"#6d28d9" },
  "News & Releases":     { bg:"#fff7ed", color:"#c2410c" },
};

const popularTagsList = ["90s","Premier League","La Liga","retro","swap","authenticate","Adidas","Nike","Umbro","collection","World Cup","guide"];

let allThreads     = [];
let activeCategory = "All";
let activeSortMode = "latest";
let searchQuery    = "";
let activeThreadId = null;
let currentUser    = null;
let currentProfile = null;

/* ── INIT ─────────────────────────────────────────── */

window.addEventListener('DOMContentLoaded', async () => {
  currentUser    = await getUser();
  currentProfile = currentUser ? await getProfile(currentUser.id) : null;

  renderCategoryBtns();
  renderSidebar();
  await loadThreads();
});

/* ── LOAD THREADS ────────────────────────────────── */

async function loadThreads() {
  document.getElementById('threadList').innerHTML =
    `<div style="padding:2rem;text-align:center;color:var(--color-grey);">Loading threads...</div>`;
  allThreads = await fetchThreads();
  renderThreadList();
}

/* ── CATEGORIES ──────────────────────────────────── */

function renderCategoryBtns() {
  document.getElementById('forumCats').innerHTML = categories.map(cat => `
    <button class="cat-btn ${cat === activeCategory ? 'active' : ''}"
            onclick="setCategory('${escAttr(cat)}', this)">${cat}</button>`).join('');
}

function setCategory(cat, btn) {
  activeCategory = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderThreadList();
}

/* ── THREAD LIST ─────────────────────────────────── */

function renderThreadList() {
  let list = allThreads.filter(t => {
    if (activeCategory !== "All" && t.category !== activeCategory) return false;
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery)) return false;
    return true;
  });

  if (activeSortMode === 'popular')    list = [...list].sort((a,b) => (b.views||0) - (a.views||0));
  if (activeSortMode === 'unanswered') list = [...list].sort((a,b) => (a.posts?.[0]?.count||0) - (b.posts?.[0]?.count||0));
  list.sort((a,b) => (b.pinned ? 1:0) - (a.pinned ? 1:0));

  document.getElementById('threadCount').textContent = `${list.length} thread${list.length !== 1 ? 's' : ''}`;
  document.getElementById('threadEmpty').style.display  = list.length ? 'none' : 'block';
  document.getElementById('threadList').innerHTML = list.map(threadCard).join('');
}

function threadCard(t) {
  const col      = catColors[t.category] || { bg:'#f1f5f9', color:'#64748b' };
  const author   = t.author?.username || 'Unknown';
  const init     = t.author?.avatar_letter || author[0]?.toUpperCase() || 'U';
  const color    = stringToColor(author);
  const replyCount = t.posts?.[0]?.count || 0;
  const date     = timeAgo(t.created_at);
  return `
    <div class="thread-card ${t.pinned ? 'pinned' : ''}" onclick="openThread(${t.id})">
      <div class="thread-left">
        <div class="thread-top">
          ${t.pinned ? '<span class="thread-pin-badge">📌 Pinned</span>' : ''}
          <span class="thread-cat-badge" style="background:${col.bg};color:${col.color}">${t.category}</span>
        </div>
        <div class="thread-title">${t.title}</div>
        <div class="thread-meta">
          <span class="thread-author">
            <span class="thread-author-dot" style="background:${color}">${init}</span>
            ${author}
          </span>
          <span>🕐 ${date}</span>
        </div>
      </div>
      <div class="thread-right">
        <div class="thread-stat">
          <span class="thread-stat-value">${replyCount}</span>
          <span class="thread-stat-label">Replies</span>
        </div>
        <div class="thread-stat">
          <span class="thread-stat-value">${t.views || 0}</span>
          <span class="thread-stat-label">Views</span>
        </div>
      </div>
    </div>`;
}

/* ── SORT ─────────────────────────────────────────── */

function sortThreads(mode, btn) {
  activeSortMode = mode;
  document.querySelectorAll('.sort-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderThreadList();
}

/* ── SEARCH ───────────────────────────────────────── */

function filterThreads(q) {
  searchQuery = q.toLowerCase();
  renderThreadList();
}

/* ── OPEN THREAD ──────────────────────────────────── */

async function openThread(id) {
  activeThreadId = id;
  const t        = allThreads.find(x => x.id === id);
  if (!t) return;

  // Increment view count
  sb.from('forum_threads').update({ views: (t.views || 0) + 1 }).eq('id', id);
  t.views = (t.views || 0) + 1;

  const posts = await fetchThreadPosts(id);
  const col   = catColors[t.category] || { bg:'#f1f5f9', color:'#64748b' };
  const date  = new Date(t.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });

  const postsHtml = posts.map((p, i) => {
    const author = p.author?.username || 'Unknown';
    const init   = p.author?.avatar_letter || author[0]?.toUpperCase() || 'U';
    const color  = stringToColor(author);
    const pDate  = timeAgo(p.created_at);
    return `
      <div class="forum-post">
        <div class="post-avatar" style="background:${color}">${init}</div>
        <div class="post-body">
          <div class="post-header">
            <div>
              <span class="post-author">${author}</span>
              ${i === 0 ? '<span class="post-author-op">OP</span>' : ''}
            </div>
            <span class="post-date">${pDate}</span>
          </div>
          <div class="post-text">${formatPostText(escHtml(p.content))}</div>
          <div class="post-footer">
            <button class="post-action-btn" onclick="likePost(this)">👍 Like</button>
            <button class="post-action-btn" onclick="quotePost('${escAttr(author)}', '${escAttr(p.content.slice(0,80))}')">💬 Quote</button>
          </div>
        </div>
      </div>`;
  }).join('');

  document.getElementById('threadModalBody').innerHTML = `
    <div class="thread-modal-title-section">
      <div class="thread-modal-badges">
        ${t.pinned ? '<span class="thread-pin-badge">📌 Pinned</span>' : ''}
        <span class="thread-cat-badge" style="background:${col.bg};color:${col.color}">${t.category}</span>
      </div>
      <div class="thread-modal-title">${t.title}</div>
      <div class="thread-modal-meta">
        <span>By <strong>${t.author?.username || 'Unknown'}</strong></span>
        <span>🕐 ${date}</span>
        <span>💬 ${posts.length} replies</span>
        <span>👁 ${t.views} views</span>
      </div>
    </div>
    ${postsHtml}`;

  document.getElementById('threadOverlay').classList.add('open');
  document.getElementById('threadModal').classList.add('open');
  document.getElementById('threadModalBody').scrollTop = 0;
}

function closeThread() {
  document.getElementById('threadOverlay').classList.remove('open');
  document.getElementById('threadModal').classList.remove('open');
  activeThreadId = null;
}

/* ── POST ACTIONS ────────────────────────────────── */

function likePost(btn) {
  btn.classList.toggle('liked');
  btn.textContent = btn.classList.contains('liked') ? '❤️ Liked' : '👍 Like';
}

function quotePost(author, text) {
  document.getElementById('replyInput').value = `[Quoting ${author}]: "${text}..."\n\n`;
  focusReply();
}

/* ── REPLY ────────────────────────────────────────── */

function focusReply() {
  document.getElementById('replyInput').focus();
  document.getElementById('threadReplyBox').scrollIntoView({ behavior:'smooth' });
}

async function submitReply() {
  if (!currentUser) { alert('Please log in to post a reply.'); window.location.href = 'login.html'; return; }
  const ta   = document.getElementById('replyInput');
  const text = ta.value.trim();
  if (!text || !activeThreadId) return;

  const { error } = await createPost(activeThreadId, text);
  if (error) { alert('Failed to post reply. Please try again.'); return; }

  ta.value = '';
  ta.style.height = 'auto';
  await openThread(activeThreadId); // Refresh thread
  await loadThreads();              // Refresh reply count
}

function formatText(type) {
  const ta    = document.getElementById('replyInput');
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  const sel   = ta.value.substring(start, end);
  const wrap  = type === 'bold' ? `**${sel||'bold text'}**`
              : type === 'italic' ? `_${sel||'italic text'}_`
              : `> ${sel||'quoted text'}`;
  ta.value = ta.value.substring(0, start) + wrap + ta.value.substring(end);
  ta.focus();
}

/* ── NEW THREAD ───────────────────────────────────── */

function openNewThread() {
  if (!currentUser) { window.location.href = 'login.html'; return; }
  document.getElementById('newThreadOverlay').style.display = 'block';
  document.getElementById('newThreadModal').style.display   = 'block';
  document.getElementById('newThreadOverlay').classList.add('open');
  document.getElementById('newThreadModal').classList.add('open');
}

function closeNewThread() {
  document.getElementById('newThreadOverlay').classList.remove('open');
  document.getElementById('newThreadModal').classList.remove('open');
  setTimeout(() => {
    document.getElementById('newThreadOverlay').style.display = 'none';
    document.getElementById('newThreadModal').style.display   = 'none';
  }, 200);
}

async function submitNewThread() {
  const title = document.getElementById('newThreadTitle').value.trim();
  const body  = document.getElementById('newThreadBody').value.trim();
  const cat   = document.getElementById('newThreadCat').value;
  if (!title || !body) { alert('Please fill in both the title and your post.'); return; }

  const { data, error } = await createThread(cat, title, body);
  if (error) { alert('Failed to create thread. Please try again.'); return; }

  closeNewThread();
  await loadThreads();
  if (data) openThread(data.id);
}

/* ── SIDEBAR ──────────────────────────────────────── */

function renderSidebar() {
  // Online members — static for now (real presence requires Supabase Realtime presence)
  document.getElementById('onlineMembers').innerHTML = [
    { name:'RetroKitKing', count:'Active now' },
    { name:'BlueMoonFan',  count:'Active now' },
    { name:'KitObsessed',  count:'5m ago'     },
  ].map(m => `
    <div class="online-member">
      <div class="online-dot"></div>
      <div>
        <div class="online-member-name">${m.name}</div>
        <div class="online-member-count">${m.count}</div>
      </div>
    </div>`).join('');

  document.getElementById('popularTags').innerHTML = popularTagsList.map(t => `
    <span class="popular-tag" onclick="filterByTag('${t}')">#${t}</span>`).join('');
}

function filterByTag(tag) {
  document.getElementById('forumSearch').value = tag;
  filterThreads(tag);
}

/* ── HELPERS ──────────────────────────────────────── */

function formatPostText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\n/g, '<br>');
}

function autoResizeForum(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)     return 'Just now';
  if (diff < 3600)   return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff/3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day:'numeric', month:'short' });
}

function stringToColor(str) {
  const colors = ['#6366f1','#ef4444','#f59e0b','#10b981','#0ea5e9','#8b5cf6','#ec4899','#14b8a6'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function escAttr(str) {
  return String(str).replace(/'/g,"\\'").replace(/"/g,'&quot;');
}