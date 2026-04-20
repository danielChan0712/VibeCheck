const express = require('express');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

const PORT = process.env.PORT || 3000;

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'Ssc2017044',
  database: 'vibecheck'
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
app.use(express.static(path.join(__dirname, 'public')));
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

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];
  if (!user) return res.status(400).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

  req.session.userId = user.id;
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
    if (!title || !req.file) {
      return res.status(400).json({ error: 'Title and video file required' });
    }

    await db.query(
      'INSERT INTO videos (user_id, title, caption, video_url) VALUES (?, ?, ?, ?)',
      [req.session.userId, title, caption || '', `/uploads/${req.file.filename}`]
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

  // Liked videos — uses COUNT subqueries, no ORDER BY created_at on likes table
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

  // Recent views — safe fallback if views_log doesn't exist
  let recentVideos = [];
  try {
    [recentVideos] = await db.query(
      `SELECT v.*, u.username,
        (SELECT COUNT(*) FROM likes WHERE video_id = v.id) AS likes,
        (SELECT COUNT(*) FROM comments WHERE video_id = v.id) AS comments
       FROM views_log vl
       JOIN videos v ON vl.video_id = v.id
       JOIN users u ON v.user_id = u.id
       WHERE vl.user_id = ?
       GROUP BY v.id
       ORDER BY MAX(vl.viewed_at) DESC
       LIMIT 5`,
      [userId]
    );
  } catch (err) {
    // views_log table doesn't exist yet — that's OK
  }

  res.json({
    user,
    liked: likedVideos,
    commented: commentedVideos,
    recent: recentVideos
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

// ============== FALLBACK ==============

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ VibeCheck running at http://localhost:${PORT}`);
});