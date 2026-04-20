const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const mysql = require('mysql2');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { spawn } = require('child_process');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
}).promise();

const uploadDir = path.join(__dirname, 'public', 'videos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`)
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'vibecheck-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' }
}));

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Login required' });
  next();
}

function parseTags(text = '') {
  const matches = text.match(/#(\w+)/g) || [];
  return matches.map(tag => tag.slice(1).toLowerCase());
}

app.post('/api/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ success: false, error: 'All fields are required' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword]);
    req.session.userId = result.insertId;
    req.session.username = username;
    res.json({ success: true, user: { id: result.insertId, username } });
  } catch (err) {
    res.status(400).json({ success: false, error: 'Username or email exists' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!users.length) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const user = users[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ success: true, user: { id: user.id, username: user.username } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/me', async (req, res) => {
  if (!req.session.userId) return res.json({ loggedIn: false });
  const [users] = await db.query('SELECT id, username, bio, avatar, favorite_tag FROM users WHERE id = ?', [req.session.userId]);
  res.json({ loggedIn: true, userId: req.session.userId, username: req.session.username, profile: users[0] || null });
});

app.get('/api/feed', async (req, res) => {
  try {
    const userId = req.session.userId || 1;
    const [videos] = await db.query(
      `SELECT v.id, v.caption, v.video_url, v.category, v.views, v.created_at,
              u.id AS user_id, u.username, u.avatar,
              (SELECT COUNT(*) FROM likes WHERE video_id = v.id) AS likes,
              (SELECT COUNT(*) FROM comments WHERE video_id = v.id) AS comments,
              (SELECT COUNT(*) FROM likes WHERE video_id = v.id AND user_id = ?) AS liked
       FROM videos v
       JOIN users u ON v.user_id = u.id
       ORDER BY v.created_at DESC
       LIMIT 20`,
      [userId]
    );
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load feed' });
  }
});

app.get('/api/recommendations', requireLogin, async (req, res) => {
  try {
    const userId = req.session.userId;
    const [rows] = await db.query('SELECT favorite_tag FROM users WHERE id = ?', [userId]);
    const favoriteTag = rows[0]?.favorite_tag || 'trending';
    const [videos] = await db.query(
      `SELECT v.id, v.caption, v.video_url, v.category, v.views, v.created_at,
              u.id AS user_id, u.username,
              (SELECT COUNT(*) FROM likes WHERE video_id = v.id) AS likes,
              (SELECT COUNT(*) FROM comments WHERE video_id = v.id) AS comments,
              CASE
                WHEN v.category = ? THEN 3
                WHEN v.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?) THEN 2
                ELSE 1
              END AS score
       FROM videos v
       JOIN users u ON v.user_id = u.id
       WHERE v.user_id <> ?
       ORDER BY score DESC, likes DESC, v.views DESC, v.created_at DESC
       LIMIT 12`,
      [favoriteTag, userId, userId]
    );
    res.json({ favoriteTag, videos });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load recommendations' });
  }
});

app.post('/api/upload', requireLogin, upload.single('video'), async (req, res) => {
  try {
    const userId = req.session.userId;
    const caption = (req.body.caption || '').trim();
    const explicitCategory = (req.body.category || '').trim().toLowerCase();
    if (!req.file) return res.status(400).json({ error: 'Video file is required' });

    const tags = parseTags(caption);
    const category = explicitCategory || tags[0] || 'general';
    const filename = req.file.filename;

    const [result] = await db.query('INSERT INTO videos (user_id, caption, video_url, category) VALUES (?, ?, ?, ?)', [userId, caption, filename, category]);
    if (category !== 'general') await db.query('UPDATE users SET favorite_tag = ? WHERE id = ?', [category, userId]);
    res.json({ success: true, videoId: result.insertId, filename, category });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/api/videos/:id', async (req, res) => {
  try {
    const videoId = req.params.id;
    const userId = req.session.userId || 1;
    await db.query('UPDATE videos SET views = views + 1 WHERE id = ?', [videoId]);
    const [videos] = await db.query(
      `SELECT v.*, u.username, u.bio, u.avatar,
              (SELECT COUNT(*) FROM likes WHERE video_id = v.id) AS likes,
              (SELECT COUNT(*) FROM likes WHERE video_id = v.id AND user_id = ?) AS liked,
              (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = v.user_id) AS following
       FROM videos v
       JOIN users u ON v.user_id = u.id
       WHERE v.id = ?`,
      [userId, userId, videoId]
    );
    if (!videos.length) return res.status(404).json({ error: 'Video not found' });

    const [comments] = await db.query(
      `SELECT c.*, u.username, u.avatar
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.video_id = ?
       ORDER BY c.created_at DESC`,
      [videoId]
    );
    res.json({ video: videos[0], comments });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load video' });
  }
});

app.post('/api/videos/:id/like', requireLogin, async (req, res) => {
  try {
    const videoId = req.params.id;
    const userId = req.session.userId;
    try {
      await db.query('INSERT INTO likes (user_id, video_id) VALUES (?, ?)', [userId, videoId]);
      res.json({ liked: true });
    } catch (err) {
      await db.query('DELETE FROM likes WHERE user_id = ? AND video_id = ?', [userId, videoId]);
      res.json({ liked: false });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

app.post('/api/videos/:id/comments', requireLogin, async (req, res) => {
  try {
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Comment text is required' });
    const [result] = await db.query('INSERT INTO comments (user_id, video_id, text) VALUES (?, ?, ?)', [req.session.userId, req.params.id, text]);
    res.json({ success: true, commentId: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const profileId = req.params.id;
    const currentUserId = req.session.userId || 1;
    const [users] = await db.query(
      `SELECT u.*, 
              (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followers,
              (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following,
              (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = ?) AS is_following
       FROM users u
       WHERE u.id = ?`,
      [profileId, profileId, currentUserId, profileId, profileId]
    );
    if (!users.length) return res.status(404).json({ error: 'User not found' });
    const [videos] = await db.query(
      `SELECT v.*, 
              (SELECT COUNT(*) FROM likes WHERE video_id = v.id) AS likes,
              (SELECT COUNT(*) FROM comments WHERE video_id = v.id) AS comments
       FROM videos v
       WHERE v.user_id = ?
       ORDER BY v.created_at DESC`,
      [profileId]
    );
    res.json({ user: users[0], videos });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

app.post('/api/users/:id/follow', requireLogin, async (req, res) => {
  try {
    const followingId = req.params.id;
    const followerId = req.session.userId;
    if (String(followingId) === String(followerId)) return res.status(400).json({ error: 'Cannot follow yourself' });
    try {
      await db.query('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [followerId, followingId]);
      res.json({ following: true });
    } catch (err) {
      await db.query('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [followerId, followingId]);
      res.json({ following: false });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle follow' });
  }
});

app.get('/api/trending', (req, res) => {
  const python = spawn('python', ['python/trending.py']);
  let data = '';
  python.stdout.on('data', chunk => { data += chunk; });
  python.stderr.on('data', err => { console.error('Python error:', err.toString()); });
  python.on('close', async code => {
    try {
      if (code !== 0 || !data.trim()) {
        const [videos] = await db.query(
          `SELECT v.*, u.username,
                  (SELECT COUNT(*) FROM likes WHERE video_id = v.id) AS likes
           FROM videos v
           JOIN users u ON v.user_id = u.id
           WHERE v.created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
           ORDER BY likes DESC, v.views DESC
           LIMIT 10`
        );
        return res.json(videos);
      }
      return res.json(JSON.parse(data));
    } catch (err) {
      return res.status(500).json({ error: 'Failed to load trending data' });
    }
  });
});

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`✅ VibeCheck running at http://localhost:${PORT}`));
