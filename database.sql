DROP DATABASE IF EXISTS vibecheck;
CREATE DATABASE vibecheck;
USE vibecheck;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  bio TEXT,
  avatar VARCHAR(255) DEFAULT 'default.png',
  favorite_tag VARCHAR(50) DEFAULT 'trending',
  last_login DATETIME
);

CREATE TABLE videos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  caption TEXT,
  video_url VARCHAR(255) NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  views INT DEFAULT 0,
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE likes (
  user_id INT NOT NULL,
  video_id INT NOT NULL,
  PRIMARY KEY (user_id, video_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (video_id) REFERENCES videos(id)
);

CREATE TABLE follows (
  follower_id INT NOT NULL,
  following_id INT NOT NULL,
  PRIMARY KEY (follower_id, following_id),
  FOREIGN KEY (follower_id) REFERENCES users(id),
  FOREIGN KEY (following_id) REFERENCES users(id)
);

CREATE TABLE comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  video_id INT NOT NULL,
  text TEXT NOT NULL,
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (video_id) REFERENCES videos(id)
);

INSERT INTO users (username, email, password, bio, favorite_tag) VALUES
('sarah_art', 'sarah@test.com', '$2b$10$YKxuXX4pz9CqZQ3kXo9wPeWvHBJX9qN4mPqYV8LhR5tZf3kX7q8Zq', 'Digital artist ✨', 'art'),
('alex_music', 'alex@test.com', '$2b$10$YKxuXX4pz9CqZQ3kXo9wPeWvHBJX9qN4mPqYV8LhR5tZf3kX7q8Zq', 'Music producer 🎵', 'music'),
('maya_dance', 'maya@test.com', '$2b$10$YKxuXX4pz9CqZQ3kXo9wPeWvHBJX9qN4mPqYV8LhR5tZf3kX7q8Zq', 'Dancer & choreographer 💃', 'dance');

INSERT INTO videos (user_id, caption, video_url, category, views) VALUES
(1, 'Speed painting sunset 🌅 #art #timelapse', 'video1.mp4', 'art', 15420),
(1, 'My art process ✏️ #tutorial', 'video2.mp4', 'art', 8750),
(2, 'New beat drop! 🔥 #music #producer', 'video3.mp4', 'music', 32100),
(2, 'Making melodies 🎹 #flstudio', 'video4.mp4', 'music', 12600),
(3, 'Learn this choreo 💃 #dance', 'video5.mp4', 'dance', 45800);

INSERT INTO follows (follower_id, following_id) VALUES
(1, 2), (1, 3), (2, 1), (2, 3), (3, 1), (3, 2);

INSERT INTO likes (user_id, video_id) VALUES
(1, 3), (1, 5), (2, 1), (2, 5), (3, 1), (3, 2), (3, 4);

INSERT INTO comments (user_id, video_id, text) VALUES
(2, 1, 'Beautiful work!'),
(3, 1, 'Love the colors'),
(1, 3, 'This is fire 🔥'),
(3, 3, 'Beat goes hard!');
