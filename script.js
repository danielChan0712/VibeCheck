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
  return video?.thumbnail_url || video?.thumbnail || '/default-thumbnail.jpg';
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

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = Object.fromEntries(new FormData(loginForm).entries());
    try {
      await api('/api/login', { method: 'POST', body: JSON.stringify(formData) });
      window.location.href = '/home.html';
    } catch (error) {
      msg.textContent = error.message;
    }
  });

  signupForm.addEventListener('submit', async (e) => {
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
  const trendingGrid = document.getElementById('trendingGrid');
  const recommendationMessage = document.getElementById('recommendationMessage');
  const welcomeText = document.getElementById('welcomeText');
  const uploadForm = document.getElementById('uploadForm');
  const uploadMessage = document.getElementById('uploadMessage');
  const logoutBtn = document.getElementById('logoutBtn');

  const session = await loadSession();
  welcomeText.textContent = session.loggedIn
    ? `Signed in as ${session.user?.username || session.username}. Favorite tag: ${session.user?.favorite_tag || 'Not set'}.`
    : 'Browsing demo mode. Login to personalize recommendations and upload videos.';

  try {
    const recs = await api('/api/recommendations');
    recommendationGrid.innerHTML = recs.map(cardTemplate).join('');
    if (!recs.length) recommendationMessage.textContent = 'No recommendations yet.';
  } catch (error) {
    recommendationMessage.textContent = error.message;
  }

  try {
    const trending = await api('/api/trending');
    trendingGrid.innerHTML = trending.map(cardTemplate).join('');
  } catch (error) {
    trendingGrid.innerHTML = `<p class="status-text">${error.message}</p>`;
  }

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

  logoutBtn?.addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' }).catch(() => null);
    window.location.href = '/login.html';
  });
}

async function initProfilePage() {
  const profileId = queryParam('id') || '1';
  const header = document.getElementById('profileHeader');
  const grid = document.getElementById('profileVideoGrid');
  const message = document.getElementById('profileMessage');

  try {
    const data = await api(`/api/users/${profileId}`);
    const user = data.user;
    header.innerHTML = `
      <div class="profile-top">
        <img class="avatar-lg" src="${getAvatarUrl(user)}" alt="${user.username}">
        <div>
          <p class="eyebrow">Artist profile</p>
          <h1>${user.username}</h1>
          <p class="muted">${user.bio || 'No bio yet.'}</p>
          <div class="stat-row">
            <span>${user.followers || 0} followers</span>
            <span>${user.following || 0} following</span>
            <span>Favorite tag: ${user.favorite_tag || 'Not set'}</span>
          </div>
        </div>
        <button class="btn btn-primary" id="followBtn">${user.is_following || user.isfollowing ? 'Following' : 'Follow'}</button>
      </div>
    `;

    grid.innerHTML = (data.videos || []).map(cardTemplate).join('');
    if (!data.videos?.length) message.textContent = 'This creator has not uploaded any videos yet.';

    document.getElementById('followBtn')?.addEventListener('click', async () => {
      try {
        const result = await api(`/api/users/${profileId}/follow`, { method: 'POST' });
        document.getElementById('followBtn').textContent = result.following ? 'Following' : 'Follow';
      } catch (error) {
        message.textContent = error.message;
      }
    });
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

if (page === 'login') initLoginPage();
if (page === 'home') initHomePage();
if (page === 'profile') initProfilePage();
if (page === 'video') initVideoPage();