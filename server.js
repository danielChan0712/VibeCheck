const express = require('express');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

const PORT = process.env.PORT || 3000;

require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let db;
(async () => {
  db = await mysql.createPool(dbConfig);
})();

const app = express();

app.use(session({
  secret: 'supersecret',
  resave: false,
  saveUninitialized: false
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + file.originalname.replace(/\s+/g, '');
    cb(null, unique);
  }
});
const upload = multer({ storage });

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Login required' });
  }
  next();
}

// ============== AUTH ==============

app.get('/api/me', async (req, res) => {
  if (!req.session.userId) {
    return res.json({ loggedIn: false });
  }

  const [rows] = await db.query(
    'SELECT id, username, email, bio, avatar FROM users WHERE id = ?',
    [req.session.userId]
  );
  const user = rows[0];

  res.json({
    loggedIn: true,
    userId: user.id,
    user
  });
});

app.post('/api/signup', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields required' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hash]
    );

    req.session.userId = result.insertId;
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Signup failed' });
  }
});

// FIXED: Login endpoint with history recording
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];
  if (!user) return res.status(400).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

  req.session.userId = user.id;
  
  // Update last_login
  await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
  
  // Record login history
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  try {
    await db.query(
      'INSERT INTO login_history (user_id, ip_address, user_agent) VALUES (?, ?, ?)',
      [user.id, ip, userAgent.substring(0, 255)]
    );
    console.log('Login recorded for user:', user.username);
  } catch (err) {
    console.log('Failed to record login history:', err.message);
  }
  
  res.json({ success: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// ============== RECOMMENDATIONS ==============

app.get('/api/recommendations', async (req, res) => {
  const [videos] = await db.query(`
    SELECT v.*, u.username, u.avatar,
      (SELECT COUNT(*) FROM likes WHERE video_id = v.id) AS likes,
      (SELECT COUNT(*) FROM comments WHERE video_id = v.id) AS comments
    FROM videos v
    JOIN users u ON v.user_id = u.id
    ORDER BY v.created_at DESC
    LIMIT 40
  `);

  res.json(videos);
});

// ============== UPLOAD ==============

app.post('/api/upload', requireAuth, upload.single('videoFile'), async (req, res) => {
  try {
    const { title, caption } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'Video file required' });
    }

    await db.query(
      'INSERT INTO videos (user_id, title, caption, video_url) VALUES (?, ?, ?, ?)',
      [req.session.userId, title || '', caption || '', `/uploads/${req.file.filename}`]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Upload failed' });
  }
});

// ============== PUBLIC PROFILE ==============

app.get('/api/users/:id', async (req, res) => {
  const profileId = req.params.id;
  const viewerId = req.session.userId || null;

  const [rows] = await db.query(
    `SELECT u.*,
      (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS followers,
      (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) AS following
     FROM users u
     WHERE u.id = ?`,
    [profileId]
  );
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });

  let isFollowing = false;
  if (viewerId) {
    const [f] = await db.query(
      'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
      [viewerId, profileId]
    );
    isFollowing = !!f[0];
  }

  const [videos] = await db.query(
    `SELECT v.*, u.username,
      (SELECT COUNT(*) FROM likes WHERE video_id = v.id) AS likes,
      (SELECT COUNT(*) FROM comments WHERE video_id = v.id) AS comments
     FROM videos v
     JOIN users u ON v.user_id = u.id
     WHERE v.user_id = ?
     ORDER BY v.created_at DESC`,
    [profileId]
  );

  res.json({
    user: { ...user, is_following: isFollowing },
    videos
  });
});

app.post('/api/users/:id/follow', requireAuth, async (req, res) => {
  const targetId = req.params.id;
  const userId = req.session.userId;

  const [rows] = await db.query(
    'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
    [userId, targetId]
  );

  if (rows[0]) {
    await db.query(
      'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
      [userId, targetId]
    );
    return res.json({ following: false });
  } else {
    await db.query(
      'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)',
      [userId, targetId]
    );
    return res.json({ following: true });
  }
});

// ============== MY PROFILE DASHBOARD ==============

app.get('/api/me/profile', requireAuth, async (req, res) => {
  const userId = req.session.userId;

  const [users] = await db.query(
    `SELECT u.*,
      (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS followers,
      (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) AS following
     FROM users u
     WHERE u.id = ?`,
    [userId]
  );
  const user = users[0];

  // Get following list
  const [following] = await db.query(
    `SELECT u.id, u.username, u.bio, u.avatar,
      (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS followers
    FROM follows f
    JOIN users u ON f.following_id = u.id
    WHERE f.follower_id = ?
    ORDER BY u.username ASC`,
    [userId]
  );

  // Liked videos
  const [likedVideos] = await db.query(
    `SELECT v.*, u.username,
      (SELECT COUNT(*) FROM likes WHERE video_id = v.id) AS likes,
      (SELECT COUNT(*) FROM comments WHERE video_id = v.id) AS comments
     FROM likes l
     JOIN videos v ON l.video_id = v.id
     JOIN users u ON v.user_id = u.id
     WHERE l.user_id = ?
     ORDER BY v.id DESC
     LIMIT 50`,
    [userId]
  );

  // Commented videos
  const [commentedVideos] = await db.query(
    `SELECT v.*, u.username,
      (SELECT COUNT(*) FROM likes WHERE video_id = v.id) AS likes,
      (SELECT COUNT(*) FROM comments WHERE video_id = v.id) AS comments
     FROM comments c
     JOIN videos v ON c.video_id = v.id
     JOIN users u ON v.user_id = u.id
     WHERE c.user_id = ?
     GROUP BY v.id
     ORDER BY MAX(c.created_at) DESC
     LIMIT 50`,
    [userId]
  );

  res.json({
    user,
    following: following,
    liked: likedVideos,
    commented: commentedVideos
  });
});

// ============== VIDEO PAGE ==============

app.get('/api/videos/:id', async (req, res) => {
  const videoId = req.params.id;
  const viewerId = req.session.userId || null;

  await db.query('UPDATE videos SET views = views + 1 WHERE id = ?', [videoId]);

  if (viewerId) {
    try {
      await db.query(
        'INSERT INTO views_log (user_id, video_id) VALUES (?, ?)',
        [viewerId, videoId]
      );
    } catch (err) {
      // views_log doesn't exist — ignore
    }
  }

  const [rows] = await db.query(
    `SELECT v.*, u.username,
      (SELECT COUNT(*) FROM likes WHERE video_id = v.id) AS likes,
      (SELECT COUNT(*) FROM comments WHERE video_id = v.id) AS comments,
      u.bio AS creatorBio
     FROM videos v
     JOIN users u ON v.user_id = u.id
     WHERE v.id = ?`,
    [videoId]
  );
  const video = rows[0];
  if (!video) return res.status(404).json({ error: 'Video not found' });

  let liked = false;
  if (viewerId) {
    const [likeRows] = await db.query(
      'SELECT 1 FROM likes WHERE user_id = ? AND video_id = ?',
      [viewerId, videoId]
    );
    liked = !!likeRows[0];
  }

  const [comments] = await db.query(
    `SELECT c.*, u.username
     FROM comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.video_id = ?
     ORDER BY c.created_at DESC`,
    [videoId]
  );

  res.json({
    video: { ...video, liked },
    creatorBio: video.creatorBio,
    comments
  });
});

app.post('/api/videos/:id/like', requireAuth, async (req, res) => {
  const videoId = req.params.id;
  const userId = req.session.userId;

  const [rows] = await db.query(
    'SELECT 1 FROM likes WHERE user_id = ? AND video_id = ?',
    [userId, videoId]
  );

  if (rows[0]) {
    await db.query(
      'DELETE FROM likes WHERE user_id = ? AND video_id = ?',
      [userId, videoId]
    );
  } else {
    await db.query(
      'INSERT INTO likes (user_id, video_id) VALUES (?, ?)',
      [userId, videoId]
    );
  }

  res.json({ success: true });
});

app.post('/api/videos/:id/comments', requireAuth, async (req, res) => {
  const videoId = req.params.id;
  const userId = req.session.userId;
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Comment text required' });
  }

  await db.query(
    'INSERT INTO comments (user_id, video_id, text) VALUES (?, ?, ?)',
    [userId, videoId, text.trim()]
  );

  res.json({ success: true });
});

// ============== UPDATE BIO ==============

app.put('/api/me/bio', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { bio } = req.body;

  if (bio === undefined) {
    return res.status(400).json({ error: 'Bio content is required' });
  }

  try {
    await db.query(
      'UPDATE users SET bio = ? WHERE id = ?',
      [bio.substring(0, 200), userId]
    );
    
    res.json({ success: true, bio: bio.substring(0, 200) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update bio' });
  }
});

// ============== RECOMMENDED VIDEOS ==============

app.get('/api/videos/:id/recommended', async (req, res) => {
  const videoId = req.params.id;
  
  try {
    const [recommended] = await db.query(
      `SELECT v.*, u.username, u.avatar,
        (SELECT COUNT(*) FROM likes WHERE video_id = v.id) AS likes,
        (SELECT COUNT(*) FROM comments WHERE video_id = v.id) AS comments,
        (v.views + 
         (SELECT COUNT(*) FROM likes WHERE video_id = v.id) * 10 + 
         (SELECT COUNT(*) FROM comments WHERE video_id = v.id) * 5) AS engagement_score
      FROM videos v
      JOIN users u ON v.user_id = u.id
      WHERE v.id != ?
      ORDER BY engagement_score DESC
      LIMIT 6`,
      [videoId]
    );
    
    res.json(recommended);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

// ============== GET FOLLOWING LIST ==============

app.get('/api/me/following', requireAuth, async (req, res) => {
  const userId = req.session.userId;

  try {
    const [following] = await db.query(
      `SELECT u.id, u.username, u.bio, u.avatar,
        (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS followers
       FROM follows f
       JOIN users u ON f.following_id = u.id
       WHERE f.follower_id = ?
       ORDER BY u.username ASC`,
      [userId]
    );
    
    res.json({ following });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch following list' });
  }
});

// ============== SETTINGS ==============

// Change username
app.put('/api/me/username', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { newUsername, password } = req.body;

  if (!newUsername || !password) {
    return res.status(400).json({ error: 'All fields required' });
  }

  if (newUsername.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }

  try {
    const [users] = await db.query('SELECT password FROM users WHERE id = ?', [userId]);
    const valid = await bcrypt.compare(password, users[0].password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const [existing] = await db.query('SELECT id FROM users WHERE username = ? AND id != ?', [newUsername, userId]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    await db.query('UPDATE users SET username = ? WHERE id = ?', [newUsername, userId]);
    res.json({ success: true, username: newUsername });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update username' });
  }
});

// Change password
app.put('/api/me/password', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'All fields required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const [users] = await db.query('SELECT password FROM users WHERE id = ?', [userId]);
    const valid = await bcrypt.compare(currentPassword, users[0].password);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hash, userId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Get login history
app.get('/api/me/login-history', requireAuth, async (req, res) => {
  const userId = req.session.userId;

  try {
    const [history] = await db.query(
      `SELECT id, login_time, ip_address, user_agent
       FROM login_history
       WHERE user_id = ?
       ORDER BY login_time DESC
       LIMIT 20`,
      [userId]
    );
    res.json({ history });
  } catch (err) {
    console.error('Login history error:', err.message);
    res.json({ history: [] });
  }
});

// ============== FALLBACK ==============

app.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/home.html');
  }
  return res.redirect('/login.html');
});

app.get('*', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/home.html');
  }
  return res.redirect('/login.html');
});

app.listen(PORT, () => {
  console.log(`✅ VibeCheck running at http://localhost:${PORT}`);
});