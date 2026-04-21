const page = document.body.dataset.page;

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function queryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function getVideoUrl(video) {
  return video?.video_url || video?.videourl || video?.videoUrl || '';
}

function getThumbUrl(video) {
  const url = video?.thumbnail_url || video?.thumbnail;
  if (url && url.trim()) return url;
  return 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=900&q=80';
}

function getUserId(video) {
  return video?.user_id || video?.userid || video?.userId || '';
}

function getAvatarUrl(user) {
  return user?.avatar || '/default.png';
}

function getCreatedAt(item) {
  return item?.created_at || item?.createdat || item?.createdAt || '';
}

function getTitle(video) {
  return video?.title || 'Untitled video';
}

function cardTemplate(video) {
  return `
    <article class="video-card">
      <img class="video-thumb" src="${getThumbUrl(video)}" alt="${getTitle(video)}" loading="lazy">
      <div class="video-body">
        <div class="creator-chip">
          <img src="${getAvatarUrl(video)}" alt="${video.username || 'Creator'}">
          <div>
            <strong>${video.username || 'Unknown creator'}</strong>
            <div class="muted">${video.category || video.favorite_tag || 'Creator'}</div>
          </div>
        </div>

        <div>
          <h3>${getTitle(video)}</h3>
          <p class="muted">${video.caption || ''}</p>
        </div>

        <div class="meta-row">
          <span>${video.views || 0} views</span>
          <span>${video.likes || 0} likes · ${video.comments || 0} comments</span>
        </div>

        <div class="hero-actions">
          <a class="btn btn-primary" href="/video.html?id=${video.id}">Watch</a>
          <a class="btn btn-secondary" href="/profile.html?id=${getUserId(video)}">Profile</a>
        </div>
      </div>
    </article>
  `;
}

async function loadSession() {
  return api('/api/me').catch(() => ({ loggedIn: false }));
}

function wireSidebarLinks(session) {
  const myProfileLink = document.getElementById('myProfileLink');
  if (myProfileLink) {
    myProfileLink.href = session.loggedIn ? '/my-profile.html' : '/login.html';
  }

  const doLogout = async (e) => {
    if (e) e.preventDefault();
    await api('/api/logout', { method: 'POST' }).catch(() => null);
    window.location.href = '/login.html';
  };

  const logoutLink = document.getElementById('logoutLink');
  if (logoutLink) logoutLink.addEventListener('click', doLogout);

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
}

async function initLoginPage() {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const msg = document.getElementById('authMessage');
  const tabs = document.querySelectorAll('[data-auth-tab]');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      const isLogin = tab.dataset.authTab === 'login';
      loginForm.classList.toggle('hidden', !isLogin);
      signupForm.classList.toggle('hidden', isLogin);
      msg.textContent = '';
    });
  });

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = Object.fromEntries(new FormData(loginForm).entries());
    try {
      await api('/api/login', { method: 'POST', body: JSON.stringify(formData) });
      window.location.href = '/home.html';
    } catch (error) {
      msg.textContent = error.message;
    }
  });

  signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = Object.fromEntries(new FormData(signupForm).entries());
    try {
      await api('/api/signup', { method: 'POST', body: JSON.stringify(formData) });
      window.location.href = '/home.html';
    } catch (error) {
      msg.textContent = error.message;
    }
  });
}

async function initHomePage() {
  const recommendationGrid = document.getElementById('recommendationGrid');
  const recommendationMessage = document.getElementById('recommendationMessage');
  const recommendationSort = document.getElementById('sortField');
  const sortAscending = document.getElementById('sortAscending');
  const resultCount = document.getElementById('resultCount');
  const welcomeText = document.getElementById('welcomeText');
  const uploadForm = document.getElementById('uploadForm');
  const uploadMessage = document.getElementById('uploadMessage');
  const toggleFiltersBtn = document.getElementById('toggleFiltersBtn');
  const filterContent = document.getElementById('filterContent');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const customDateRange = document.getElementById('customDateRange');
  const applyDateBtn = document.getElementById('applyDateBtn');

  const session = await loadSession();
  wireSidebarLinks(session);

  welcomeText.textContent = session.loggedIn
    ? `Signed in as ${session.user?.username || session.username}. Favorite tag: ${session.user?.favorite_tag || 'Not set'}.`
    : 'Browsing demo mode. Login to personalize recommendations and upload videos.';

  let recommendations = [];

  function parseNumberInput(id) {
    const value = document.getElementById(id)?.value?.trim();
    return value ? Number(value) : null;
  }

  function parseDateInput(id) {
    const value = document.getElementById(id)?.value;
    return value ? new Date(value) : null;
  }

  function withinRange(value, min, max) {
    if (min !== null && value < min) return false;
    if (max !== null && value > max) return false;
    return true;
  }

  function filterVideos(videos) {
    const minViews = parseNumberInput('minViews');
    const maxViews = parseNumberInput('maxViews');
    const minLikes = parseNumberInput('minLikes');
    const maxLikes = parseNumberInput('maxLikes');
    const minComments = parseNumberInput('minComments');
    const maxComments = parseNumberInput('maxComments');
    const startDate = parseDateInput('startDate');
    const endDate = parseDateInput('endDate');

    return videos.filter((video) => {
      const views = Number(video.views || 0);
      const likes = Number(video.likes || 0);
      const comments = Number(video.comments || 0);
      if (!withinRange(views, minViews, maxViews)) return false;
      if (!withinRange(likes, minLikes, maxLikes)) return false;
      if (!withinRange(comments, minComments, maxComments)) return false;

      if (startDate || endDate) {
        const createdAt = getCreatedAt(video);
        if (!createdAt) return false;
        const videoDate = new Date(createdAt);
        if (startDate && videoDate < startDate) return false;
        if (endDate) {
          const endOfDay = new Date(endDate);
          endOfDay.setHours(23, 59, 59, 999);
          if (videoDate > endOfDay) return false;
        }
      }
      return true;
    });
  }

  function sortVideos(videos, sortBy, ascending) {
    return [...videos].sort((a, b) => {
      let aValue = 0;
      let bValue = 0;

      if (sortBy === 'date') {
        aValue = new Date(getCreatedAt(a) || 0).getTime();
        bValue = new Date(getCreatedAt(b) || 0).getTime();
      } else {
        aValue = Number(a?.[sortBy] || 0);
        bValue = Number(b?.[sortBy] || 0);
      }

      return ascending ? aValue - bValue : bValue - aValue;
    });
  }

  function renderRecommendations() {
    if (!recommendations.length) {
      recommendationGrid.innerHTML = '';
      recommendationMessage.textContent = 'No recommendations yet.';
      if (resultCount) resultCount.textContent = '0 videos found';
      return;
    }

    const filtered = filterVideos(recommendations);
    const sortBy = recommendationSort?.value || 'views';
    const ascending = Boolean(sortAscending?.checked);
    const sorted = sortVideos(filtered, sortBy, ascending);
    recommendationGrid.innerHTML = sorted.map(cardTemplate).join('');
    recommendationMessage.textContent = sorted.length ? '' : 'No videos match your filters.';
    if (resultCount) {
      resultCount.textContent = `${sorted.length} video${sorted.length === 1 ? '' : 's'} found`;
    }
  }

  try {
    recommendations = await api('/api/recommendations');
    renderRecommendations();
  } catch (error) {
    recommendationMessage.textContent = error.message;
  }

  recommendationSort?.addEventListener('change', renderRecommendations);
  sortAscending?.addEventListener('change', renderRecommendations);

  ['minViews', 'maxViews', 'minLikes', 'maxLikes', 'minComments', 'maxComments', 'startDate', 'endDate']
    .forEach((id) => document.getElementById(id)?.addEventListener('input', renderRecommendations));

  document.querySelectorAll('.date-preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      const startDateInput = document.getElementById('startDate');
      const endDateInput = document.getElementById('endDate');
      const today = new Date();
      const format = (d) => d.toISOString().split('T')[0];

      document.querySelectorAll('.date-preset-btn').forEach((el) => el.classList.remove('active'));
      btn.classList.add('active');

      if (preset === 'custom') {
        customDateRange?.classList.remove('hidden');
        return;
      }

      customDateRange?.classList.add('hidden');

      let start = new Date(today);
      let end = new Date(today);
      if (preset === 'week') start.setDate(today.getDate() - 7);
      if (preset === 'month') start.setMonth(today.getMonth() - 1);
      if (preset === 'year') start.setFullYear(today.getFullYear() - 1);

      if (startDateInput) startDateInput.value = format(start);
      if (endDateInput) endDateInput.value = format(end);
      renderRecommendations();
    });
  });

  applyDateBtn?.addEventListener('click', renderRecommendations);

  toggleFiltersBtn?.addEventListener('click', () => {
    const hidden = filterContent?.classList.toggle('hidden');
    toggleFiltersBtn.textContent = hidden ? '▼ Show Filters' : '▲ Hide Filters';
  });

  resetFiltersBtn?.addEventListener('click', () => {
    ['minViews', 'maxViews', 'minLikes', 'maxLikes', 'minComments', 'maxComments', 'startDate', 'endDate']
      .forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
    customDateRange?.classList.add('hidden');
    document.querySelectorAll('.date-preset-btn').forEach((el) => el.classList.remove('active'));
    if (recommendationSort) recommendationSort.value = 'views';
    if (sortAscending) sortAscending.checked = false;
    renderRecommendations();
  });

  uploadForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData(uploadForm);
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Upload failed');
      uploadMessage.textContent = 'Upload successful. Reloading recommendations...';
      setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      uploadMessage.textContent = error.message;
    }
  });
}

async function initMyProfilePage() {
  const header = document.getElementById('myProfileHeader');
  const likedGrid = document.getElementById('myLikedGrid');
  const likedMessage = document.getElementById('myLikedMessage');
  const commentedGrid = document.getElementById('myCommentedGrid');
  const commentedMessage = document.getElementById('myCommentedMessage');
  const recentGrid = document.getElementById('myRecentGrid');
  const recentMessage = document.getElementById('myRecentMessage');

  const session = await loadSession();
  if (!session.loggedIn) {
    window.location.href = '/login.html';
    return;
  }

  wireSidebarLinks(session);

  try {
    const data = await api('/api/me/profile');

    const user = data.user;
    header.innerHTML = `
      <div class="profile-top">
        <img class="avatar-lg" src="${getAvatarUrl(user)}" alt="${user.username}">
        <div>
          <p class="eyebrow">My profile</p>
          <h1>${user.username}</h1>
          <p class="muted">${user.bio || 'No bio yet.'}</p>
          <div class="stat-row">
            <span>${user.followers || 0} followers</span>
            <span>${user.following || 0} following</span>
          </div>
        </div>
      </div>
    `;

    const liked = data.liked || [];
    likedGrid.innerHTML = liked.map(cardTemplate).join('');
    likedMessage.textContent = liked.length ? '' : 'You have not liked any videos yet.';

    const commented = data.commented || [];
    commentedGrid.innerHTML = commented.map(cardTemplate).join('');
    commentedMessage.textContent = commented.length ? '' : 'You have not commented on any videos yet.';

    const recent = data.recent || [];
    recentGrid.innerHTML = recent.map(cardTemplate).join('');
    recentMessage.textContent = recent.length ? '' : 'No recent views recorded yet.';
  } catch (error) {
    likedMessage.textContent = error.message;
    commentedMessage.textContent = error.message;
    recentMessage.textContent = error.message;
  }
}

async function initProfilePage() {
  const profileId = queryParam('id') || '1';
  const header = document.getElementById('profileHeader');
  const grid = document.getElementById('profileVideoGrid');
  const message = document.getElementById('profileMessage');

  const session = await loadSession();
  wireSidebarLinks(session);

  try {
    const data = await api(`/api/users/${profileId}`);
    const user = data.user;
    const isOwnProfile = String(session.userId || '') === String(user.id || '');

    header.innerHTML = `
      <div class="profile-top">
        <img class="avatar-lg" src="${getAvatarUrl(user)}" alt="${user.username}">
        <div>
          <p class="eyebrow">${isOwnProfile ? 'My profile' : 'Artist profile'}</p>
          <h1>${user.username}</h1>
          <p class="muted">${user.bio || 'No bio yet.'}</p>
          <div class="stat-row">
            <span>${user.followers || 0} followers</span>
            <span>${user.following || 0} following</span>
            <span>Favorite tag: ${user.favorite_tag || 'Not set'}</span>
          </div>
        </div>
        ${isOwnProfile
        ? ''
        : `<button class="btn btn-primary" id="followBtn">${user.is_following || user.isfollowing ? 'Following' : 'Follow'}</button>`
      }
      </div>
    `;

    grid.innerHTML = (data.videos || []).map(cardTemplate).join('');
    if (!data.videos?.length) {
      message.textContent = isOwnProfile
        ? 'You have not uploaded any videos yet.'
        : 'This creator has not uploaded any videos yet.';
    }

    if (!isOwnProfile) {
      document.getElementById('followBtn')?.addEventListener('click', async () => {
        try {
          const result = await api(`/api/users/${profileId}/follow`, { method: 'POST' });
          document.getElementById('followBtn').textContent = result.following ? 'Following' : 'Follow';
        } catch (error) {
          message.textContent = error.message;
        }
      });
    }
  } catch (error) {
    message.textContent = error.message;
  }
}

async function initVideoPage() {
  const videoId = queryParam('id') || '1';
  const playerWrap = document.getElementById('videoPlayerWrap');
  const meta = document.getElementById('videoMeta');
  const commentList = document.getElementById('commentList');
  const commentForm = document.getElementById('commentForm');
  const commentMessage = document.getElementById('commentMessage');

  const session = await loadSession();
  wireSidebarLinks(session);

  async function loadVideo() {
    const data = await api(`/api/videos/${videoId}`);
    const video = data.video;

    playerWrap.innerHTML = `
      <video controls poster="${getThumbUrl(video)}">
        <source src="${getVideoUrl(video)}" type="video/mp4">
        Your browser does not support the video tag.
      </video>
    `;

    meta.innerHTML = `
      <p class="eyebrow">Video page</p>
      <h1>${getTitle(video)}</h1>
      <p class="muted">${video.caption || ''}</p>
      <div class="video-actions">
        <button class="btn btn-primary" id="likeBtn">${video.liked ? 'Unlike' : 'Like'} · ${video.likes || 0}</button>
        <a class="btn btn-secondary" href="/profile.html?id=${getUserId(video)}">Open ${video.username || 'creator'}'s profile</a>
      </div>
      <p class="muted">By ${video.username || 'Unknown creator'} · ${video.views || 0} views · ${video.comments || 0} comments</p>
      <p class="muted">${data.creatorBio || video.bio || ''}</p>
    `;

    const comments = data.comments || [];
    commentList.innerHTML = comments.map((comment) => `
      <div class="comment-item">
        <strong>${comment.username || 'User'}</strong>
        <p>${comment.text || ''}</p>
        <small class="muted">${getCreatedAt(comment) ? new Date(getCreatedAt(comment)).toLocaleString() : ''}</small>
      </div>
    `).join('');

    document.getElementById('likeBtn')?.addEventListener('click', async () => {
      try {
        await api(`/api/videos/${videoId}/like`, { method: 'POST' });
        await loadVideo();
      } catch (error) {
        commentMessage.textContent = error.message;
      }
    });
  }

  try {
    await loadVideo();
  } catch (error) {
    meta.innerHTML = `<p class="status-text">${error.message}</p>`;
  }

  commentForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(commentForm).entries());
      await api(`/api/videos/${videoId}/comments`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      commentForm.reset();
      await loadVideo();
      commentMessage.textContent = 'Comment posted.';
    } catch (error) {
      commentMessage.textContent = error.message;
    }
  });
}

// Added a utility function to apply animations dynamically
function applyAnimation(element, animationName) {
  element.classList.add(animationName);
  element.addEventListener('animationend', () => {
    element.classList.remove(animationName);
  });
}

// Apply click animation to all interactive button styles.
document.querySelectorAll('.btn, .sort-btn, .order-btn, .date-preset-btn').forEach((button) => {
  button.addEventListener('click', () => {
    applyAnimation(button, 'btn-click-animation');
  });
});

// Page router
if (page === 'login') initLoginPage();
if (page === 'home') initHomePage();
if (page === 'my-profile') initMyProfilePage();
if (page === 'profile') initProfilePage();
if (page === 'video') initVideoPage();
