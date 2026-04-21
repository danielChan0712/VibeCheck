DROP DATABASE IF EXISTS vibecheck;
CREATE DATABASE vibecheck;
USE vibecheck;

-- Users Table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  bio TEXT,
  avatar VARCHAR(255) DEFAULT 'https://ui-avatars.com/api/?background=01696f&color=fff&name=User',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME NULL
);

-- Videos Table
CREATE TABLE videos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(120) NULL,
  caption TEXT,
  video_url VARCHAR(255) NOT NULL,
  thumbnail_url VARCHAR(255) DEFAULT 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=900&q=80',
  views INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Likes Table
CREATE TABLE likes (
  user_id INT NOT NULL,
  video_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, video_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

-- Follows Table
CREATE TABLE follows (
  follower_id INT NOT NULL,
  following_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Comments Table
CREATE TABLE comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  video_id INT NOT NULL,
  text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

-- New: per-user view log for “recently viewed”
CREATE TABLE views_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  video_id INT NOT NULL,
  viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  INDEX (user_id, viewed_at)
);

CREATE TABLE IF NOT EXISTS login_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (user_id, login_time)
);

-- Sample Users
INSERT INTO users (username, email, password, bio) VALUES
  ('sarah_art', 'sarah@test.com', 'demo-hash', 'Digital artist ✨'),
  ('alex_music', 'alex@test.com', 'demo-hash', 'Music producer 🎧'),
  ('maya_dance', 'maya@test.com', 'demo-hash', 'Dancer & choreographer 💃');

-- Sample Videos
INSERT INTO videos (user_id, title, caption, video_url, thumbnail_url, views) VALUES
  (1, 'Speed painting sunset', 'Speed painting sunset 🌅 #art #timelapse', 'video1.mp4', 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=80', 15420),
  (1, 'My art process', 'My art process ✏️ #tutorial', 'video2.mp4', 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80', 8750),
  (2, 'New beat drop', 'New beat drop! 🔥 #music #producer', 'video3.mp4', 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80', 32100),
  (2, 'Making melodies', 'Making melodies 🎹 #flstudio', 'video4.mp4', 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80', 12600),
  (3, 'Learn this choreo', 'Learn this choreo 💃 #dance', 'video5.mp4', 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=900&q=80', 45800);

-- Sample Follows
INSERT INTO follows (follower_id, following_id) VALUES
  (1, 2),
  (1, 3),
  (2, 1),
  (2, 3),
  (3, 1),
  (3, 2);

-- Sample Likes
INSERT INTO likes (user_id, video_id) VALUES
  (1, 3),
  (1, 5),
  (2, 1),
  (2, 5),
  (3, 1),
  (3, 2),
  (3, 4);

-- Sample Comments
INSERT INTO comments (user_id, video_id, text) VALUES
  (2, 1, 'Beautiful work!'),
  (3, 1, 'Love the colors'),
  (1, 3, 'This is fire 🔥'),
  (3, 3, 'Beat goes hard!');
