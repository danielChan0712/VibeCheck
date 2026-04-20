const API = {
  async request(url, options = {}) {
    const res = await fetch(url, {
      credentials: 'include',
      ...options
    });

    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : await res.text();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
  get(url) {
    return this.request(url);
  },
  post(url, data, isForm = false) {
    return this.request(url, {
      method: 'POST',
      headers: isForm ? undefined : { 'Content-Type': 'application/json' },
      body: isForm ? data : JSON.stringify(data)
    });
  }
};

async function checkAuth() {
  const result = await API.get('/api/me');
  if (!result.loggedIn && !window.location.pathname.includes('login')) {
    window.location.href = '/login.html';
  }
  return result;
}

function showMessage(message, type = 'error') {
  const box = document.getElementById('message');
  if (box) box.innerHTML = `<div class="${type}">${message}</div>`;
}

async function login(email, password) {
  try {
    const result = await API.post('/api/login', { email, password });
    if (result.success) window.location.href = '/home.html';
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

async function signup(username, email, password) {
  try {
    const result = await API.post('/api/signup', { username, email, password });
    if (result.success) window.location.href = '/home.html';
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

async function logout() {
  await API.post('/api/logout', {});
  window.location.href = '/login.html';
}

function demoLogin(email) {
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  if (emailInput) emailInput.value = email;
  if (passwordInput) passwordInput.value = 'password123';
}

function showSignup() {
  const container = document.querySelector('.auth-container');
  if (!container) return;
  container.innerHTML = `
    <h1>🎬 VibeCheck</h1>
    <h2>Sign Up</h2>
    <form id="signupForm">
      <input type="text" id="username" placeholder="Username" required>
      <input type="email" id="email" placeholder="Email" required>
      <input type="password" id="password" placeholder="Password" required>
      <button type="submit">Create Account</button>
    </form>
    <p>Already have an account? <a href="#" id="goLogin">Login</a></p>
    <div id="message"></div>
  `;

  document.getElementById('goLogin').addEventListener('click', e => {
    e.preventDefault();
    window.location.reload();
  });

  document.getElementById('signupForm').addEventListener('submit', async e => {
    e.preventDefault();
    await signup(
      document.getElementById('username').value.trim(),
      document.getElementById('email').value.trim(),
      document.getElementById('password').value
    );
  });
}

function renderUploadBox() {
  return `
    <div class="upload-box">
      <h3>Upload video</h3>
      <form id="uploadForm" class="upload-form">
        <input type="file" id="videoFile" name="video" accept="video/*" required>
        <input type="text" id="videoCaption" name="caption" placeholder="Caption with hashtags, e.g. #music #live" required>
        <input type="text" id="videoCategory" name="category" placeholder="Optional category, e.g. music">
        <button type="submit">Upload</button>
      </form>
      <div id="uploadMessage"></div>
    </div>
  `;
}

function bindUploadForm() {
  const form = document.getElementById('uploadForm');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const file = document.getElementById('videoFile').files[0];
    const caption = document.getElementById('videoCaption').value.trim();
    const category = document.getElementById('videoCategory').value.trim();
    const box = document.getElementById('uploadMessage');

    if (!file) {
      if (box) box.innerHTML = '<div class="error">Please choose a video file.</div>';
      return;
    }

    try {
      const formData = new FormData();
      formData.append('video', file);
      formData.append('caption', caption);
      formData.append('category', category);
      const result = await API.post('/api/upload', formData, true);
      if (box) box.innerHTML = `<div class="success">Upload successful. Category: ${result.category}</div>`;
      form.reset();
      await loadFeed();
      await loadRecommendations();
      await loadProfile();
    } catch (err) {
      if (box) box.innerHTML = `<div class="error">${err.message}</div>`;
    }
  });
}

function renderVideos(videos, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = videos.map(v => `
    <div class="video-card" onclick="location.href='video.html?id=${v.id}'">
      <video src="videos/${v.video_url}" muted></video>
      <div class="video-card-info">
        <div class="video-card-header">
          <span class="video-card-username">${v.username}</span>
          <span class="badge">${v.category || 'general'}</span>
        </div>
        <div class="video-card-caption">${v.caption || ''}</div>
        <div class="video-card-stats">
          <span>❤️ ${v.likes || 0}</span>
          <span>💬 ${v.comments || 0}</span>
          <span>👁️ ${v.views || 0}</span>
        </div>
      </div>
    </div>
  `).join('');
}

async function loadFeed() {
  try {
    await checkAuth();
    const videos = await API.get('/api/feed');
    renderVideos(videos, 'videoFeed');
  } catch (err) {
    console.error(err);
  }
}

async function loadRecommendations() {
  const container = document.getElementById('recommendedFeed');
  if (!container) return;
  try {
    const data = await API.get('/api/recommendations');
    const heading = document.getElementById('recommendationTitle');
    if (heading) heading.textContent = `Recommended for you · ${data.favoriteTag}`;
    renderVideos(data.videos, 'recommendedFeed');
  } catch (err) {
    container.innerHTML = `<div class="error">${err.message}</div>`;
  }
}

let currentVideoId = null;

async function loadVideo(id) {
  if (!id) return (window.location.href = '/home.html');
  try {
    await checkAuth();
    currentVideoId = id;
    const data = await API.get(`/api/videos/${id}`);
    const video = data.video;
    const comments = data.comments || [];

    const player = document.getElementById('videoPlayer');
    if (player) player.src = `videos/${video.video_url}`;

    const info = document.getElementById('videoInfo');
    if (info) {
      info.innerHTML = `
        <div style="display:flex; align-items:center; gap:15px; margin-bottom:10px;">
          <div>
            <div style="font-weight:bold; font-size:18px;">${video.username}</div>
            <div style="color:#666;">${video.bio || ''}</div>
            <div style="color:#999; margin-top:4px;">Category: ${video.category || 'general'}</div>
          </div>
        </div>
        <div style="margin:10px 0;">${video.caption || ''}</div>
        <div style="color:#666;">${video.views || 0} views</div>
      `;
    }

    const actions = document.getElementById('videoActions');
    if (actions) {
      actions.innerHTML = `
        <button class="like-btn ${video.liked ? 'liked' : ''}" onclick="toggleLike(${id})">${video.liked ? 'Unlike' : 'Like'} (${video.likes || 0})</button>
        <button class="follow-btn ${video.following ? 'following' : ''}" onclick="toggleFollow(${video.user_id})">${video.following ? 'Following' : 'Follow'}</button>
      `;
    }

    const commentsSection = document.getElementById('commentsSection');
    if (commentsSection) {
      commentsSection.innerHTML = `
        <h3>Comments (${comments.length})</h3>
        <form class="comment-form" onsubmit="addComment(event, ${id})">
          <input type="text" id="commentInput" placeholder="Add a comment..." required>
          <button type="submit">Post</button>
        </form>
        <div class="comments-list">
          ${comments.map(c => `
            <div class="comment">
              <div class="comment-user">${c.username}</div>
              <div class="comment-text">${c.text}</div>
              <div class="comment-time">${new Date(c.created_at).toLocaleString()}</div>
            </div>
          `).join('') || '<p style="color:#999;">No comments yet</p>'}
        </div>
      `;
    }
  } catch (err) {
    console.error(err);
  }
}

async function toggleLike(videoId) {
  await API.post(`/api/videos/${videoId}/like`, {});
  await loadVideo(videoId);
}

async function toggleFollow(userId) {
  await API.post(`/api/users/${userId}/follow`, {});
  await loadVideo(currentVideoId);
}

async function addComment(e, videoId) {
  e.preventDefault();
  const input = document.getElementById('commentInput');
  const text = input.value.trim();
  if (!text) return;
  await API.post(`/api/videos/${videoId}/comments`, { text });
  input.value = '';
  await loadVideo(videoId);
}

async function loadProfile() {
  const profileInfo = document.getElementById('profileInfo');
  const userVideos = document.getElementById('userVideos');
  if (!profileInfo || !userVideos) return;
  try {
    const result = await API.get('/api/me');
    if (!result.loggedIn) return (window.location.href = '/login.html');
    const params = new URLSearchParams(window.location.search);
    const profileId = params.get('id') || result.userId;
    const data = await API.get(`/api/users/${profileId}`);
    const user = data.user;
    const videos = data.videos || [];

    profileInfo.innerHTML = `
      <div class="profile-avatar"></div>
      <div class="profile-details">
        <h2>${user.username}</h2>
        <div class="profile-bio">${user.bio || 'No bio yet'}</div>
        <div class="profile-stats">
          <div class="stat"><div class="stat-number">${videos.length}</div><div class="stat-label">Videos</div></div>
          <div class="stat"><div class="stat-number">${user.followers || 0}</div><div class="stat-label">Followers</div></div>
          <div class="stat"><div class="stat-number">${user.following || 0}</div><div class="stat-label">Following</div></div>
        </div>
        <div class="badge">Favorite tag: ${user.favorite_tag || 'trending'}</div>
      </div>
    `;

    userVideos.innerHTML = videos.map(v => `
      <div class="grid-video" onclick="location.href='video.html?id=${v.id}'">
        <video src="videos/${v.video_url}"></video>
        <div class="grid-video-views">${v.views || 0} views · ${v.category || 'general'}</div>
      </div>
    `).join('') || '<div class="upload-box">No uploaded videos yet.</div>';
  } catch (err) {
    console.error(err);
    profileInfo.innerHTML = '<div class="error">Failed to load profile.</div>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', e => { e.preventDefault(); logout(); });

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      await login(document.getElementById('email').value.trim(), document.getElementById('password').value);
    });
  }

  const uploadMount = document.getElementById('uploadMount');
  if (uploadMount) {
    uploadMount.innerHTML = renderUploadBox();
    bindUploadForm();
  }
});
