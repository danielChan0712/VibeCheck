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

function getRelativeTime(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function recommendedCardTemplate(video) {
  return `
    <article class="video-card recommended-card">
      <img class="video-thumb" src="${getThumbUrl(video)}" alt="${getTitle(video)}" loading="lazy">
      <div class="video-body">
        <div class="creator-chip">
          <img src="${getAvatarUrl(video)}" alt="${video.username || 'Creator'}">
          <div>
            <strong>${video.username || 'Unknown creator'}</strong>
          </div>
        </div>
        <div>
          <h3>${getTitle(video)}</h3>
          <p class="muted">${video.caption ? video.caption.substring(0, 60) + (video.caption.length > 60 ? '...' : '') : ''}</p>
        </div>
        <div class="meta-row">
          <span>👁️ ${video.views || 0} views</span>
          <span>❤️ ${video.likes || 0} likes</span>
          <span>💬 ${video.comments || 0} comments</span>
          <span>📅 ${getCreatedAt(video) ? new Date(getCreatedAt(video)).toLocaleDateString() : ''}</span>
        </div>
        <div class="hero-actions">
          <a class="btn btn-primary" href="/video.html?id=${video.id}">Watch</a>
          <a class="btn btn-secondary" href="/profile.html?id=${getUserId(video)}">Profile</a>
        </div>
      </div>
    </article>
  `;
}

function userCardTemplate(user) {
  return `
    <div class="user-card">
      <img class="user-avatar" src="${getAvatarUrl(user)}" alt="${user.username}">
      <div class="user-info">
        <strong>${user.username}</strong>
        <p class="muted">${user.bio || 'No bio yet'}</p>
        <small class="muted">${user.followers || 0} followers</small>
      </div>
      <a class="btn btn-secondary" href="/profile.html?id=${user.id}">View Profile</a>
    </div>
  `;
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
          <span>👁️ ${video.views || 0} views</span>
          <span>❤️ ${video.likes || 0} likes</span>
          <span>💬 ${video.comments || 0} comments</span>
          <span>📅 ${getCreatedAt(video) ? new Date(getCreatedAt(video)).toLocaleDateString() : 'Unknown date'}</span>
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

// Global variables for filtering
let allVideos = [];
let currentFilters = {
  sortBy: 'views',
  sortOrder: 'desc',
  minViews: null,
  maxViews: null,
  minLikes: null,
  maxLikes: null,
  minComments: null,
  maxComments: null,
  startDate: null,
  endDate: null
};

async function initHomePage() {
  const recommendationGrid = document.getElementById('recommendationGrid');
  const recommendationMessage = document.getElementById('recommendationMessage');
  const welcomeText = document.getElementById('welcomeText');
  const resultCount = document.getElementById('resultCount');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const sortField = document.getElementById('sortField');
  const sortAscending = document.getElementById('sortAscending');
  const uploadForm = document.getElementById('uploadForm');
  const uploadMessage = document.getElementById('uploadMessage');

  const toggleFiltersBtn = document.getElementById('toggleFiltersBtn');
  const filterContent = document.getElementById('filterContent');
  const activeFiltersDiv = document.getElementById('activeFilters');
  const errorMessage = document.getElementById('filterErrorMessage');

  const session = await loadSession();
  wireSidebarLinks(session);

  if (welcomeText) {
    welcomeText.textContent = session.loggedIn
      ? `Signed in as ${session.user?.username || session.username || 'User'}.`
      : 'Browsing demo mode. Login to personalize recommendations and upload videos.';
  }

  function setError(message = '') {
    if (!errorMessage) return;
    errorMessage.textContent = message;
    errorMessage.classList.toggle('hidden', !message);
  }

  async function loadVideos() {
    try {
      allVideos = await api('/api/recommendations');
      applyFiltersAndRender();
    } catch (error) {
      if (recommendationMessage) recommendationMessage.textContent = error.message;
    }
  }

  function filterVideos(videos) {
    return videos.filter((video) => {
      const views = Number(video.views || 0);
      const likes = Number(video.likes || 0);
      const comments = Number(video.comments || 0);

      if (currentFilters.minViews !== null && views < currentFilters.minViews) return false;
      if (currentFilters.maxViews !== null && views > currentFilters.maxViews) return false;
      if (currentFilters.minLikes !== null && likes < currentFilters.minLikes) return false;
      if (currentFilters.maxLikes !== null && likes > currentFilters.maxLikes) return false;
      if (currentFilters.minComments !== null && comments < currentFilters.minComments) return false;
      if (currentFilters.maxComments !== null && comments > currentFilters.maxComments) return false;

      if (currentFilters.startDate || currentFilters.endDate) {
        const rawDate = video.created_at || video.createdAt || video.createdat;
        const videoDate = rawDate ? new Date(rawDate) : null;

        if (videoDate && currentFilters.startDate && videoDate < new Date(currentFilters.startDate)) return false;
        if (videoDate && currentFilters.endDate) {
          const end = new Date(currentFilters.endDate);
          end.setHours(23, 59, 59, 999);
          if (videoDate > end) return false;
        }
      }

      return true;
    });
  }

  function sortVideos(videos) {
    const sorted = [...videos];
    const sortBy = currentFilters.sortBy;
    const order = currentFilters.sortOrder;

    sorted.sort((a, b) => {
      let aVal = 0;
      let bVal = 0;

      if (sortBy === 'date') {
        aVal = new Date(a.created_at || a.createdAt || a.createdat || 0).getTime();
        bVal = new Date(b.created_at || b.createdAt || b.createdat || 0).getTime();
      } else {
        aVal = Number(a[sortBy] || 0);
        bVal = Number(b[sortBy] || 0);
      }

      return order === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return sorted;
  }

  function removeFilter(key) {
    currentFilters[key] = null;

    const inputMap = {
      minViews: 'minViews',
      maxViews: 'maxViews',
      minLikes: 'minLikes',
      maxLikes: 'maxLikes',
      minComments: 'minComments',
      maxComments: 'maxComments',
      startDate: 'startDate',
      endDate: 'endDate'
    };

    const inputId = inputMap[key];
    if (inputId) {
      const input = document.getElementById(inputId);
      if (input) input.value = '';
    }

    setError('');
    applyFiltersAndRender();
  }

  function updateActiveFiltersDisplay() {
    if (!activeFiltersDiv) return;

    const filters = [];

    if (currentFilters.minViews !== null) filters.push({ key: 'minViews', label: `Min views: ${currentFilters.minViews}` });
    if (currentFilters.maxViews !== null) filters.push({ key: 'maxViews', label: `Max views: ${currentFilters.maxViews}` });
    if (currentFilters.minLikes !== null) filters.push({ key: 'minLikes', label: `Min likes: ${currentFilters.minLikes}` });
    if (currentFilters.maxLikes !== null) filters.push({ key: 'maxLikes', label: `Max likes: ${currentFilters.maxLikes}` });
    if (currentFilters.minComments !== null) filters.push({ key: 'minComments', label: `Min comments: ${currentFilters.minComments}` });
    if (currentFilters.maxComments !== null) filters.push({ key: 'maxComments', label: `Max comments: ${currentFilters.maxComments}` });
    if (currentFilters.startDate) filters.push({ key: 'startDate', label: `From: ${currentFilters.startDate}` });
    if (currentFilters.endDate) filters.push({ key: 'endDate', label: `To: ${currentFilters.endDate}` });

    if (!filters.length) {
      activeFiltersDiv.innerHTML = '<span class="muted">No active filters</span>';
      return;
    }

    activeFiltersDiv.innerHTML = filters.map((filter) => `
      <span class="filter-tag">
        ${filter.label}
        <button type="button" class="filter-remove" data-remove-filter="${filter.key}" aria-label="Remove ${filter.label}">×</button>
      </span>
    `).join('');

    activeFiltersDiv.querySelectorAll('[data-remove-filter]').forEach((btn) => {
      btn.addEventListener('click', () => removeFilter(btn.dataset.removeFilter));
    });
  }

  function applyFiltersAndRender() {
    const filtered = filterVideos(allVideos);
    const sorted = sortVideos(filtered);

    if (recommendationGrid) {
      recommendationGrid.innerHTML = sorted.map(cardTemplate).join('');
    }

    if (sorted.length === 0) {
      if (recommendationMessage) recommendationMessage.textContent = 'No videos match your filters. Try adjusting the criteria.';
      if (resultCount) resultCount.textContent = '0 videos found';
    } else {
      if (recommendationMessage) recommendationMessage.textContent = '';
      if (resultCount) resultCount.textContent = `${sorted.length} video${sorted.length !== 1 ? 's' : ''} found`;
    }

    updateActiveFiltersDisplay();
  }

  function validateRange(minKey, maxKey, label) {
    const min = currentFilters[minKey];
    const max = currentFilters[maxKey];

    if (min !== null && min < 0) {
      setError(`${label} cannot be negative.`);
      return false;
    }

    if (max !== null && max < 0) {
      setError(`${label} cannot be negative.`);
      return false;
    }

    if (min !== null && max !== null && min > max) {
      setError(`${label} min value cannot be greater than max value.`);
      return false;
    }

    setError('');
    return true;
  }

  function setupNumericFilters() {
    const mappings = [
      { id: 'minViews', field: 'minViews', minKey: 'minViews', maxKey: 'maxViews', label: 'Views' },
      { id: 'maxViews', field: 'maxViews', minKey: 'minViews', maxKey: 'maxViews', label: 'Views' },
      { id: 'minLikes', field: 'minLikes', minKey: 'minLikes', maxKey: 'maxLikes', label: 'Likes' },
      { id: 'maxLikes', field: 'maxLikes', minKey: 'minLikes', maxKey: 'maxLikes', label: 'Likes' },
      { id: 'minComments', field: 'minComments', minKey: 'minComments', maxKey: 'maxComments', label: 'Comments' },
      { id: 'maxComments', field: 'maxComments', minKey: 'minComments', maxKey: 'maxComments', label: 'Comments' }
    ];

    mappings.forEach(({ id, field, minKey, maxKey, label }) => {
      const input = document.getElementById(id);
      if (!input) return;

      input.addEventListener('input', () => {
        const raw = input.value.trim();
        const value = raw === '' ? null : parseInt(raw, 10);

        currentFilters[field] = value;

        if (!validateRange(minKey, maxKey, label)) return;
        applyFiltersAndRender();
      });
    });
  }

  function resetFilters() {
    currentFilters = {
      sortBy: 'views',
      sortOrder: 'desc',
      minViews: null,
      maxViews: null,
      minLikes: null,
      maxLikes: null,
      minComments: null,
      maxComments: null,
      startDate: null,
      endDate: null
    };

    [
      'minViews', 'maxViews',
      'minLikes', 'maxLikes',
      'minComments', 'maxComments',
      'startDate', 'endDate',
      'modalStartDate', 'modalEndDate'
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    if (sortField) sortField.value = 'views';
    if (sortAscending) sortAscending.checked = false;

    setError('');
    applyFiltersAndRender();
  }

  function setupDatePresets() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    document.querySelectorAll('.date-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        let startDate = null;
        let endDate = null;

        switch (preset) {
          case 'today':
            startDate = todayStr;
            endDate = todayStr;
            break;
          case 'week': {
            const weekAgo = new Date(today);
            weekAgo.setDate(today.getDate() - 7);
            startDate = weekAgo.toISOString().split('T')[0];
            endDate = todayStr;
            break;
          }
          case 'month': {
            const monthAgo = new Date(today);
            monthAgo.setMonth(today.getMonth() - 1);
            startDate = monthAgo.toISOString().split('T')[0];
            endDate = todayStr;
            break;
          }
          case 'year': {
            const yearAgo = new Date(today);
            yearAgo.setFullYear(today.getFullYear() - 1);
            startDate = yearAgo.toISOString().split('T')[0];
            endDate = todayStr;
            break;
          }
          case 'custom':
            openDateModal();
            return;
        }

        currentFilters.startDate = startDate;
        currentFilters.endDate = endDate;

        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        if (startDateInput) startDateInput.value = startDate || '';
        if (endDateInput) endDateInput.value = endDate || '';

        applyFiltersAndRender();
      });
    });
  }

  const dateModal = document.getElementById('dateModal');

  function openDateModal() {
    if (dateModal) {
      dateModal.classList.remove('hidden');
      dateModal.style.display = 'flex';
    }
  }

  function closeDateModal() {
    if (dateModal) {
      dateModal.classList.add('hidden');
      dateModal.style.display = 'none';
    }
  }

  const closeModalBtn = document.querySelector('.close-modal');
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeDateModal);

  const cancelDateBtn = document.getElementById('cancelDateBtn');
  if (cancelDateBtn) cancelDateBtn.addEventListener('click', closeDateModal);

  const confirmDateBtn = document.getElementById('confirmDateBtn');
  if (confirmDateBtn) {
    confirmDateBtn.addEventListener('click', () => {
      const startDate = document.getElementById('modalStartDate')?.value || '';
      const endDate = document.getElementById('modalEndDate')?.value || '';

      currentFilters.startDate = startDate || null;
      currentFilters.endDate = endDate || null;

      const startDateInput = document.getElementById('startDate');
      const endDateInput = document.getElementById('endDate');
      if (startDateInput) startDateInput.value = startDate;
      if (endDateInput) endDateInput.value = endDate;

      applyFiltersAndRender();
      closeDateModal();
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === dateModal) closeDateModal();
  });

  const applyDateBtn = document.getElementById('applyDateBtn');
  if (applyDateBtn) {
    applyDateBtn.addEventListener('click', () => {
      const startDate = document.getElementById('startDate')?.value || '';
      const endDate = document.getElementById('endDate')?.value || '';

      currentFilters.startDate = startDate || null;
      currentFilters.endDate = endDate || null;
      applyFiltersAndRender();
    });
  }

  if (sortField) {
    sortField.addEventListener('change', () => {
      currentFilters.sortBy = sortField.value;
      applyFiltersAndRender();
    });
  }

  if (sortAscending) {
    sortAscending.addEventListener('change', () => {
      currentFilters.sortOrder = sortAscending.checked ? 'asc' : 'desc';
      applyFiltersAndRender();
    });
  }

  if (toggleFiltersBtn && filterContent) {
    toggleFiltersBtn.addEventListener('click', () => {
      filterContent.classList.toggle('hidden');
      const isHidden = filterContent.classList.contains('hidden');
      toggleFiltersBtn.textContent = isHidden ? '▼ Show Filters' : '▼ Hide Filters';
    });
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', resetFilters);
  }

  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
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
        if (uploadMessage) uploadMessage.textContent = 'Upload successful. Reloading recommendations...';
        setTimeout(() => window.location.reload(), 700);
      } catch (error) {
        if (uploadMessage) uploadMessage.textContent = error.message;
      }
    });
  }

  setupNumericFilters();
  setupDatePresets();
  await loadVideos();
}

async function initMyProfilePage() {
  const header = document.getElementById('myProfileHeader');
  const likedGrid = document.getElementById('myLikedGrid');
  const likedMessage = document.getElementById('myLikedMessage');
  const commentedGrid = document.getElementById('myCommentedGrid');
  const commentedMessage = document.getElementById('myCommentedMessage');
  const followingGrid = document.getElementById('followingGrid');
  const followingMessage = document.getElementById('followingMessage');
  const uploadForm = document.getElementById('uploadForm');
  const uploadMessage = document.getElementById('uploadMessage');

  const session = await loadSession();
  if (!session.loggedIn) {
    window.location.href = '/login.html';
    return;
  }

  wireSidebarLinks(session);

  async function loadProfileData() {
    try {
      const data = await api('/api/me/profile');

      const user = data.user;
      header.innerHTML = `
        <div class="profile-top">
          <img class="avatar-lg" src="${getAvatarUrl(user)}" alt="${user.username}">
          <div>
            <p class="eyebrow">My profile</p>
            <h1>${user.username}</h1>
            <p class="muted" id="profileBio">${user.bio || 'No bio yet.'}</p>
            <div class="stat-row">
              <span>${user.followers || 0} followers</span>
              <span>${user.following || 0} following</span>
            </div>
          </div>
        </div>
      `;

      // Display following list
      const following = data.following || [];
      if (followingGrid) {
        if (following.length === 0) {
          followingGrid.innerHTML = '';
          followingMessage.textContent = 'You are not following anyone yet.';
        } else {
          followingGrid.innerHTML = following.map(userCardTemplate).join('');
          followingMessage.textContent = '';
        }
      }

      const liked = data.liked || [];
      likedGrid.innerHTML = liked.map(cardTemplate).join('');
      likedMessage.textContent = liked.length ? '' : 'You have not liked any videos yet.';

      const commented = data.commented || [];
      commentedGrid.innerHTML = commented.map(cardTemplate).join('');
      commentedMessage.textContent = commented.length ? '' : 'You have not commented on any videos yet.';
    } catch (error) {
      likedMessage.textContent = error.message;
      commentedMessage.textContent = error.message;
      if (followingMessage) followingMessage.textContent = error.message;
    }
  }

  await loadProfileData();

  // Upload form handling
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
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
        if (uploadMessage) uploadMessage.textContent = 'Upload successful!';
        setTimeout(() => window.location.reload(), 1500);
      } catch (error) {
        if (uploadMessage) uploadMessage.textContent = error.message;
      }
    });
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
          </div>
        </div>
        ${
          isOwnProfile
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
  const recommendedGrid = document.getElementById('recommendedGrid');
  const recommendedMessage = document.getElementById('recommendedMessage');

  const session = await loadSession();
  wireSidebarLinks(session);

  async function loadRecommended() {
    if (!recommendedGrid) return;
    
    try {
      const recommended = await api(`/api/videos/${videoId}/recommended`);
      
      if (recommended.length === 0) {
        recommendedGrid.innerHTML = '';
        recommendedMessage.textContent = 'No recommendations available.';
      } else {
        recommendedGrid.innerHTML = recommended.map(recommendedCardTemplate).join('');
        recommendedMessage.textContent = '';
      }
    } catch (error) {
      recommendedMessage.textContent = error.message;
    }
  }

  async function loadVideo() {
    const data = await api(`/api/videos/${videoId}`);
    const video = data.video;

    playerWrap.innerHTML = `
      <video controls poster="${getThumbUrl(video)}" autoplay>
        <source src="${getVideoUrl(video)}" type="video/mp4">
        Your browser does not support the video tag.
      </video>
    `;

    const uploadDate = getCreatedAt(video);
    const formattedDate = uploadDate ? new Date(uploadDate).toLocaleString() : 'Unknown date';

    meta.innerHTML = `
      <p class="eyebrow">Video</p>
      <h1>${getTitle(video)}</h1>
      <p class="muted">${video.caption || ''}</p>
      <div class="video-actions">
        <button class="btn btn-primary" id="likeBtn">${video.liked ? 'Unlike' : 'Like'} · ${video.likes || 0}</button>
        <a class="btn btn-secondary" href="/profile.html?id=${getUserId(video)}">Open ${video.username || 'creator'}'s profile</a>
      </div>
      <p class="muted">
        By ${video.username || 'Unknown creator'} · 
        ${video.views || 0} views · 
        ${video.comments || 0} comments · 
        📅 Uploaded ${formattedDate}
      </p>
      <p class="muted">${data.creatorBio || video.bio || ''}</p>
    `;

    const comments = data.comments || [];
    commentList.innerHTML = comments.map((comment) => `
      <div class="comment-item">
        <strong>${comment.username || 'User'}</strong>
        <p>${comment.text || ''}</p>
        <small class="muted">${getRelativeTime(getCreatedAt(comment))}</small>
      </div>
    `).join('');

    document.getElementById('likeBtn')?.addEventListener('click', async () => {
      try {
        await api(`/api/videos/${videoId}/like`, { method: 'POST' });
        await loadVideo();
        await loadRecommended();
      } catch (error) {
        commentMessage.textContent = error.message;
      }
    });
  }

  try {
    await loadVideo();
    await loadRecommended();
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
      await loadRecommended();
      commentMessage.textContent = 'Comment posted.';
    } catch (error) {
      commentMessage.textContent = error.message;
    }
  });
}

async function initSettingsPage() {
  const session = await loadSession();
  if (!session.loggedIn) {
    window.location.href = '/login.html';
    return;
  }

  wireSidebarLinks(session);

  const userData = await api('/api/me');
  const user = userData.user;

  const currentUsername = document.getElementById('currentUsername');
  const currentBio = document.getElementById('currentBio');
  const bioInput = document.getElementById('newBio');
  const bioCount = document.getElementById('bioCount');

  if (currentUsername) currentUsername.value = user.username;
  if (currentBio) currentBio.value = user.bio || '';
  if (bioInput) {
    bioInput.value = user.bio || '';
    if (bioCount) bioCount.textContent = (user.bio || '').length;
    
    bioInput.addEventListener('input', () => {
      bioCount.textContent = bioInput.value.length;
    });
  }

  // Change Username
  const usernameForm = document.getElementById('changeUsernameForm');
  const usernameMessage = document.getElementById('usernameMessage');
  
  usernameForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newUsername = document.getElementById('newUsername').value;
    const password = document.getElementById('usernamePassword').value;

    if (!newUsername || !password) {
      usernameMessage.textContent = 'All fields required';
      usernameMessage.style.color = 'red';
      return;
    }

    if (newUsername.length < 3) {
      usernameMessage.textContent = 'Username must be at least 3 characters';
      usernameMessage.style.color = 'red';
      return;
    }

    try {
      const result = await api('/api/me/username', {
        method: 'PUT',
        body: JSON.stringify({ newUsername, password })
      });
      
      if (result.success) {
        usernameMessage.textContent = 'Username updated successfully!';
        usernameMessage.style.color = 'green';
        currentUsername.value = newUsername;
        document.getElementById('newUsername').value = '';
        document.getElementById('usernamePassword').value = '';
        setTimeout(() => usernameMessage.textContent = '', 3000);
      }
    } catch (error) {
      usernameMessage.textContent = error.message;
      usernameMessage.style.color = 'red';
    }
  });

  // Change Password
  const passwordForm = document.getElementById('changePasswordForm');
  const passwordMessage = document.getElementById('passwordMessage');

  passwordForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      passwordMessage.textContent = 'All fields required';
      passwordMessage.style.color = 'red';
      return;
    }

    if (newPassword.length < 6) {
      passwordMessage.textContent = 'Password must be at least 6 characters';
      passwordMessage.style.color = 'red';
      return;
    }

    if (newPassword !== confirmPassword) {
      passwordMessage.textContent = 'New passwords do not match';
      passwordMessage.style.color = 'red';
      return;
    }

    try {
      const result = await api('/api/me/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      
      if (result.success) {
        passwordMessage.textContent = 'Password updated successfully! Please login again.';
        passwordMessage.style.color = 'green';
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        
        setTimeout(() => {
          window.location.href = '/login.html';
        }, 2000);
      }
    } catch (error) {
      passwordMessage.textContent = error.message;
      passwordMessage.style.color = 'red';
    }
  });

  // Change Bio
  const bioForm = document.getElementById('changeBioForm');
  const bioMessage = document.getElementById('bioMessage');

  bioForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newBio = document.getElementById('newBio').value;

    try {
      const result = await api('/api/me/bio', {
        method: 'PUT',
        body: JSON.stringify({ bio: newBio })
      });
      
      if (result.success) {
        bioMessage.textContent = 'Bio updated successfully!';
        bioMessage.style.color = 'green';
        if (currentBio) currentBio.value = newBio || 'No bio yet.';
        setTimeout(() => bioMessage.textContent = '', 3000);
      }
    } catch (error) {
      bioMessage.textContent = error.message;
      bioMessage.style.color = 'red';
    }
  });

  // Load Login History
  const historyList = document.getElementById('loginHistoryList');
  
  try {
    const historyData = await api('/api/me/login-history');
    const history = historyData.history || [];
    
    if (history.length === 0) {
      historyList.innerHTML = '<p class="status-text">No login history available.</p>';
    } else {
      historyList.innerHTML = history.map(entry => `
        <div class="history-item">
          <div class="history-time">
            <strong>${new Date(entry.login_time).toLocaleString()}</strong>
          </div>
          <div class="history-details">
            <span>IP: ${entry.ip_address || 'Unknown'}</span>
            <span class="muted">${entry.user_agent ? entry.user_agent.substring(0, 50) + '...' : 'Unknown device'}</span>
          </div>
        </div>
      `).join('');
    }
  } catch (error) {
    historyList.innerHTML = `<p class="status-text">${error.message}</p>`;
  }
}

// Page router
if (page === 'login') initLoginPage();
if (page === 'home') initHomePage();
if (page === 'my-profile') initMyProfilePage();
if (page === 'profile') initProfilePage();
if (page === 'video') initVideoPage();
if (page === 'settings') initSettingsPage();