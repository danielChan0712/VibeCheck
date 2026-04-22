// =============================================================================
// VibeCheck - Main Server
// =============================================================================
// This file handles all backend API routes, database connections, session
// management, and file uploads for the VibeCheck video platform.
// =============================================================================

const express = require('express');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

require('dotenv').config();

// =============================================================================
// Configuration
// =============================================================================

const PORT = process.env.PORT || 3000;

// Database connection pool configuration
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

// =============================================================================
// Database Initialization & Migrations
// =============================================================================
// Connects to the database and ensures all required tables/columns exist.
// These migrations handle environments that were initialized before recent
// feature additions (e.g., views_log, login_history, is_private).
(async () => {
  try {
    db = await mysql.createPool(dbConfig);

    // Create views_log table if it doesn't exist (for tracking video views)
    await db.query(`
      CREATE TABLE IF NOT EXISTS views_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        video_id INT NOT NULL,
        viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        INDEX (user_id, viewed_at)
      )
    `);

    // Create login_history table if it doesn't exist (for security tracking)
    await db.query(`
      CREATE TABLE IF NOT EXISTS login_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45) NULL,
        user_agent TEXT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX (user_id, login_time)
      )
    `);

    // Add is_private column to videos table if it doesn't exist
    // Note: Uses information_schema check for MySQL/MariaDB compatibility
    const [cols] = await db.query(`
      SELECT 1 AS ok FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'videos' AND COLUMN_NAME = 'is_private'
      LIMIT 1
    `);
    if (!cols.length) {
      await db.query('ALTER TABLE videos ADD COLUMN is_private TINYINT(1) NOT NULL DEFAULT 0');
    }

    console.log('✅ Database initialized and migrations applied');
  } catch (err) {
    console.error('❌ Database migration failed:', err.message);
  }
})();

const app = express();

// =============================================================================
// Middleware
// =============================================================================

// Session management for user authentication
app.use(session({
  secret: 'supersecret',
  resave: false,
  saveUninitialized: false
}));

// Parse JSON request bodies
app.use(express.json());

// Serve static files from public/ directory (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Serve uploaded video files from uploads/ directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure multer for handling video file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + file.originalname.replace(/\s+/g, '');
    cb(null, unique);
  }
});
const upload = multer({ storage });

// Authentication middleware - requires user to be logged in
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Login required' });
  }
  next();
}

// Helper: Fetch comments for a video with author usernames
async function getVideoComments(connection, videoId) {
  const [comments] = await connection.query(`
    SELECT c.*, u.username
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.video_id = ?
    ORDER BY c.created_at DESC
  `, [videoId]);
  return comments;
}

// Helper: Build engagement score query for recommendations
function engagementScoreQuery() {
  return `
    (v.views +
     (SELECT COUNT(*) FROM likes WHERE video_id = v.id) * 10 +
     (SELECT COUNT(*) FROM comments WHERE video_id = v.id) * 5) AS engagement_score
  `;
}

// Helper: Check if current user has liked a video
async function getUserLikeStatus(connection, userId, videoId) {
  const [rows] = await connection.query(
    'SELECT 1 FROM likes WHERE user_id = ? AND video_id = ?',
    [userId, videoId]
  );
  return !!rows[0];
}

// Helper: Get user's following count
async function getFollowingCount(connection, userId) {
  const [[result]] = await connection.query(
    'SELECT COUNT(*) AS count FROM follows WHERE follower_id = ?',
    [userId]
  );
  return result.count;
}

// Helper: Get user's followers count
async function getFollowersCount(connection, userId) {
  const [[result]] = await connection.query(
    'SELECT COUNT(*) AS count FROM follows WHERE following_id = ?',
    [userId]
  );
  return result.count;
}

// =============================================================================
// Authentication Routes
// =============================================================================

// GET /api/me - Get current logged-in user's basic info
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

// POST /api/signup - Register a new user account
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

// POST /api/login - Authenticate user and record login history
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];
  if (!user) return res.status(400).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

  req.session.userId = user.id;

  // Update last_login timestamp
  await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

  // Record login history with IP and user agent
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

// POST /api/logout - End the user's session
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// =============================================================================
// Public Video Routes
// =============================================================================

// GET /api/videos/:id - Get video details, comments, and like status
app.get('/api/videos/:id', async (req, res) => {
  const videoId = req.params.id;
  const viewerId = req.session.userId || null;

  // Increment view count
  await db.query('UPDATE videos SET views = views + 1 WHERE id = ?', [videoId]);

  // Log view if user is logged in
  if (viewerId) {
    try {
      await db.query(
        'INSERT INTO views_log (user_id, video_id) VALUES (?, ?)',
        [viewerId, videoId]
      );
    } catch (err) {
      console.error('Failed to record view log:', err.message);
    }
  }

  // Fetch video with stats and creator info
  const [rows] = await db.query(`
    SELECT v.*, u.username,
      (SELECT COUNT(*) FROM likes WHERE video_id = v.id) AS likes,
      (SELECT COUNT(*) FROM comments WHERE video_id = v.id) AS comments,
      u.bio AS creatorBio
    FROM videos v
    JOIN users u ON v.user_id = u.id
    WHERE v.id = ?
  `, [videoId]);
  const video = rows[0];

  if (!video) return res.status(404).json({ error: 'Video not found' });
  if (video.is_private && String(video.user_id) !== String(viewerId || '')) {
    return res.status(403).json({ error: 'This video is private' });
  }

  // Check if viewer has liked the video
  let liked = false;
  if (viewerId) {
    liked = await getUserLikeStatus(db, viewerId, videoId);
  }

  const comments = await getVideoComments(db, videoId);

  res.json({
    video: { ...video, liked },
    creatorBio: video.creatorBio,
    comments
  });
});

// POST /api/videos/:id/like - Toggle like on a video
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

// POST /api/videos/:id/comments - Add a comment to a video
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

// GET /api/videos/:id/recommended - Get recommended videos based on viewer preferences
// Uses a scoring system based on tags from liked/commented videos
app.get('/api/videos/:id/recommended', async (req, res) => {
  const videoId = req.params.id;
  const viewerId = req.session.userId || null;

  try {
    let recommended = [];

    if (viewerId) {
      // Gather tags from videos the user has liked or commented on
      const [signals] = await db.query(`
        SELECT COALESCE(v.caption, '') AS caption, COALESCE(v.title, '') AS title
        FROM likes l
        JOIN videos v ON l.video_id = v.id
        WHERE l.user_id = ?
        UNION ALL
        SELECT COALESCE(v.caption, '') AS caption, COALESCE(v.title, '') AS title
        FROM comments c
        JOIN videos v ON c.video_id = v.id
        WHERE c.user_id = ?
      `, [viewerId, viewerId]);

      // Count hashtag frequency across all signals
      const tagCount = {};
      signals.forEach((row) => {
        const text = `${row.title} ${row.caption}`.toLowerCase();
        const tags = text.match(/#[a-z0-9_]+/g) || [];
        tags.forEach((tag) => { tagCount[tag] = (tagCount[tag] || 0) + 1; });
      });

      // Get top 3 most frequent tags
      const topTags = Object.entries(tagCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tag]) => tag);

      // If we have tags, find videos matching them, ranked by engagement
      if (topTags.length) {
        const tagClause = topTags.map(() => '(LOWER(v.caption) LIKE ? OR LOWER(v.title) LIKE ?)').join(' OR ');
        const tagParams = topTags.flatMap((tag) => [`%${tag}%`, `%${tag}%`]);

        const [themeBased] = await db.query(`
          SELECT v.*, u.username, u.avatar,
            (SELECT COUNT(*) FROM likes WHERE video_id = v.id) AS likes,
            (SELECT COUNT(*) FROM comments WHERE video_id = v.id) AS comments,
            ${engagementScoreQuery()}
          FROM videos v
          JOIN users u ON v.user_id = u.id
          WHERE v.id != ? AND v.is_private = 0 AND (${tagClause})
          ORDER BY engagement_score DESC
          LIMIT 6
        `, [videoId, ...tagParams]);
        recommended = themeBased;
      }
    }

    // Fallback: recommend top-engagement public videos if no personalized results
    if (!recommended.length) {
      const [fallback] = await db.query(`
        SELECT v.*, u.username, u.avatar,
          (SELECT COUNT(*) FROM likes WHERE video_id = v.id) AS likes,
          (SELECT COUNT(*) FROM comments WHERE video_id = v.id) AS comments,
          ${engagementScoreQuery()}
        FROM videos v
        JOIN users u ON v.user_id = u.id
        WHERE v.id != ? AND v.is_private = 0
        ORDER BY engagement_score DESC
        LIMIT 6
      `, [videoId]);
      recommended = fallback;
    }

    res.json(recommended);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

// GET /api/recommendations - Get all videos for the recommendations feed
app.get('/api/recommendations', async (req, res) => {
  const viewerId = req.session.userId || null;

  const [videos] = await db.query(`
    SELECT v.*, u.username, u.avatar,
      (SELECT COUNT(*) FROM likes WHERE video_id = v.id) AS likes,
      (SELECT COUNT(*) FROM comments WHERE video_id = v.id) AS comments
    FROM videos v
    JOIN users u ON v.user_id = u.id
    WHERE v.is_private = 0 OR v.user_id = ?
    ORDER BY v.created_at DESC
        LIMIT 40
  `, [viewerId || -1]);

  res.json(videos);
});

// =============================================================================
// Video Upload
// =============================================================================

// POST /api/upload - Upload a new video (requires auth)
app.post('/api/upload', requireAuth, upload.single('videoFile'), async (req, res) => {
  try {
    const { title, caption, category } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'Video file required' });
    }

    await db.query(
      'INSERT INTO videos (user_id, title, caption, video_url) VALUES (?, ?, ?, ?)',
      [
        req.session.userId,
        title || '',
        [caption, category ? `#${String(category).toLowerCase()}` : ''].filter(Boolean).join(' ').trim(),
        `/uploads/${req.file.filename}`
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Upload failed' });
  }
});

// POST /api/videos/:id/privacy - Toggle video privacy (public/private)
app.put('/api/videos/:id/privacy', requireAuth, async (req, res) => {
  const videoId = req.params.id;
  const userId = req.session.userId;
  const raw = req.body?.isPrivate;
  const isPrivate = raw === true || raw === 1 || raw === '1' ? 1 : 0;

  try {
    const [rows] = await db.query(
      'SELECT id FROM videos WHERE id = ? AND user_id = ?',
      [videoId, userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Video not found' });

    await db.query('UPDATE videos SET is_private = ? WHERE id = ?', [isPrivate, videoId]);
    res.json({ success: true, is_private: isPrivate });
  } catch (err) {
    console.error('Privacy update failed:', err);
    res.status(500).json({ error: err.message || 'Failed to update privacy' });
  }
});

// DELETE /api/videos/:id - Delete a video and its related data
app.delete('/api/videos/:id', requireAuth, async (req, res) => {
  const videoId = req.params.id;
  const userId = req.session.userId;
  let conn;

  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    // Verify ownership
    const [rows] = await conn.query(
      'SELECT id FROM videos WHERE id = ? AND user_id = ?',
      [videoId, userId]
    );
    if (!rows[0]) {
      await conn.rollback();
      return res.status(404).json({ error: 'Video not found' });
    }

    // Remove dependent rows first (for legacy DBs without ON DELETE CASCADE)
    await conn.query('DELETE FROM views_log WHERE video_id = ?', [videoId]);
    await conn.query('DELETE FROM likes WHERE video_id = ?', [videoId]);
    await conn.query('DELETE FROM comments WHERE video_id = ?', [videoId]);
    const [delResult] = await conn.query(
      'DELETE FROM videos WHERE id = ? AND user_id = ?',
      [videoId, userId]
    );

    await conn.commit();

    const affected = delResult.affectedRows ?? 0;
    if (!affected) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({ success: true });
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_) { /* ignore rollback errors */ }
    }
    console.error('Video delete failed:', err);
    res.status(500).json({ error: err.message || 'Failed to delete video' });
  } finally {
    if (conn) conn.release();
  }
});

// =============================================================================
// User Profile Routes (Public & Own)
// =============================================================================

// GET /api/users/:id - Get public profile info and videos
app.get('/api/users/:id', async (req, res) => {
  const profileId = req.params.id;
  const viewerId = req.session.userId || null;

  // Fetch user with follower/following counts
  const [rows] = await db.query(`
    SELECT u.*,
      (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS followers,
      (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) AS following
    FROM users u
    WHERE u.id = ?
  `, [profileId]);

  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Check follow status if viewer is logged in
  let isFollowing = false;
  if (viewerId) {
    const [f] = await db.query(
      'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
      [viewerId, profileId]
    );
    isFollowing = !!f[0];
  }

  // Fetch user's videos (private videos only visible to owner)
  const [videos] = await db.query(`
    SELECT v.*, u.username,
      (SELECT COUNT(*) FROM likes WHERE video_id = v.id) AS likes,
      (SELECT COUNT(*) FROM comments WHERE video_id = v.id) AS comments
    FROM videos v
    JOIN users u ON v.user_id = u.id
    WHERE v.user_id = ? AND (v.is_private = 0 OR ? = ?)
    ORDER BY v.created_at DESC
  `, [profileId, viewerId || -1, Number(profileId)]);

  res.json({
    user: { ...user, is_following: isFollowing },
    videos
  });
});

// POST /api/users/:id/follow - Toggle follow/unfollow a user
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

// =============================================================================
// My Profile Dashboard (Owner-only)
// =============================================================================

// GET /api/me/profile - Get the logged-in user's full profile dashboard
// Includes: user stats, following list, liked videos, commented videos,
// uploaded videos, and recently viewed videos.
app.get('/api/me/profile', requireAuth, async (req, res) => {
  const userId = req.session.userId;

  // Fetch user with follower/following counts
  const [users] = await db.query(`
    SELECT u.*,
      (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS followers,
      (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) AS following
    FROM users u
    WHERE u.id = ?
  `, [userId]);
  const user = users[0];

  // Get list of users that this user follows
  const [following] = await db.query(`
    SELECT u.id, u.username, u.bio, u.avatar,
      (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS followers
    FROM follows f
    JOIN users u ON f.following_id = u.id
    WHERE f.follower_id = ?
    ORDER BY u.username ASC
  `, [userId]);

  // Get videos the user has liked
  const [likedVideos] = await db.query(`
    SELECT v.*, u.username,
      (SELECT COUNT(*) FROM likes WHERE video_id = v.id) AS likes,
      (SELECT COUNT(*) FROM comments WHERE video_id = v.id) AS comments
    FROM likes l
    JOIN videos v ON l.video_id = v.id
    JOIN users u ON v.user_id = u.id
    WHERE l.user_id = ?
    ORDER BY v.id DESC
    LIMIT 50
  `, [userId]);

  // Get videos the user has commented on
  const [commentedVideos] = await db.query(`
    SELECT v.*, u.username,
      (SELECT COUNT(*) FROM likes WHERE video_id = v.id) AS likes,
      (SELECT COUNT(*) FROM comments WHERE video_id = v.id) AS comments
    FROM comments c
    JOIN videos v ON c.video_id = v.id
    JOIN users u ON v.user_id = u.id
    WHERE c.user_id = ?
    GROUP BY v.id
    ORDER BY MAX(c.created_at) DESC
    LIMIT 50
  `, [userId]);

  // Get videos the user has uploaded
  let uploadedVideos = [];
  try {
    const [uploadedRows] = await db.query(`
      SELECT v.*, u.username, u.avatar,
        (SELECT COUNT(*) FROM likes WHERE video_id = v.id) AS likes,
        (SELECT COUNT(*) FROM comments WHERE video_id = v.id) AS comments
      FROM videos v
      JOIN users u ON v.user_id = u.id
      WHERE v.user_id = ?
      ORDER BY v.created_at DESC
      LIMIT 50
    `, [userId]);
    uploadedVideos = uploadedRows;
  } catch (err) {
    console.error('Uploaded videos query failed:', err.message);
  }

  // Get recently viewed videos from view history
  let recentVideos = [];
  try {
    const [recentRows] = await db.query(`
      SELECT v.*, u.username, u.avatar,
        (SELECT COUNT(*) FROM likes WHERE video_id = v.id) AS likes,
        (SELECT COUNT(*) FROM comments WHERE video_id = v.id) AS comments,
        MAX(vl.viewed_at) AS last_viewed_at
      FROM views_log vl
      JOIN videos v ON vl.video_id = v.id
      JOIN users u ON v.user_id = u.id
      WHERE vl.user_id = ?
      GROUP BY v.id
      ORDER BY last_viewed_at DESC
      LIMIT 20
    `, [userId]);
    recentVideos = recentRows;
  } catch (err) {
    console.error('Recent videos query failed:', err.message);
  }

  res.json({
    user,
    following,
    liked: likedVideos,
    commented: commentedVideos,
    uploaded: uploadedVideos,
    recent: recentVideos
  });
});

// PUT /api/me/bio - Update the user's bio
app.put('/api/me/bio', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { bio } = req.body;

  if (bio === undefined) {
    return res.status(400).json({ error: 'Bio content is required' });
  }

  try {
    const truncatedBio = bio.substring(0, 200);
    await db.query('UPDATE users SET bio = ? WHERE id = ?', [truncatedBio, userId]);
    res.json({ success: true, bio: truncatedBio });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update bio' });
  }
});

// =============================================================================
// Settings Routes
// =============================================================================

// PUT /api/me/username - Change username (requires password confirmation)
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
    // Verify password
    const [users] = await db.query('SELECT password FROM users WHERE id = ?', [userId]);
    const valid = await bcrypt.compare(password, users[0].password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Check if username is already taken
    const [existing] = await db.query(
      'SELECT id FROM users WHERE username = ? AND id != ?',
      [newUsername, userId]
    );
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

// PUT /api/me/password - Change password (requires current password)
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
    // Verify current password
    const [users] = await db.query('SELECT password FROM users WHERE id = ?', [userId]);
    const valid = await bcrypt.compare(currentPassword, users[0].password);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash and save new password
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hash, userId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// GET /api/me/login-history - Get user's login history
app.get('/api/me/login-history', requireAuth, async (req, res) => {
  const userId = req.session.userId;

  try {
    const [history] = await db.query(`
      SELECT id, login_time, ip_address, user_agent
      FROM login_history
      WHERE user_id = ?
      ORDER BY login_time DESC
      LIMIT 20
    `, [userId]);
    res.json({ history });
  } catch (err) {
    console.error('Login history error:', err.message);
    res.json({ history: [] });
  }
});

// =============================================================================
// Fallback Routes (SPA Routing)
// =============================================================================

// Handle root path - redirect to home if logged in, login page otherwise
app.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/home.html');
  }
  return res.redirect('/login.html');
});

// Catch-all: redirect unauthenticated users to login, others to home
app.get('*', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/home.html');
  }
  return res.redirect('/login.html');
});

// =============================================================================
// Start Server
// =============================================================================
app.listen(PORT, () => {
  console.log(`✅ VibeCheck running at http://localhost:${PORT}`);
});