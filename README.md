# VibeCheck

A short-form video sharing platform where users can upload, watch, like, comment on, and follow content from others. Built with Node.js, Express, and MySQL.

---

## Features

- User Authentication — Signup, login (with bcrypt password hashing), session management, and logout
- Video Upload — Upload videos with title, caption, and category (auto-tagged as hashtag)
- Video Feed — Browse a recommendations feed sorted by recency
- Personalized Recommendations — Videos recommended based on hashtags from your liked and commented videos
- Engagement — Like, comment, and view videos with real-time count updates
- Follow System — Follow and unfollow other users
- Profile Dashboard — View your uploaded, liked, commented, and recently viewed videos
- Public Profiles — Browse other users' videos and bio
- Privacy Controls — Toggle videos between public and private
- Security — Login history tracking with IP address and user agent
- Settings — Change username, password, bio, and view login activity

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| HTML / CSS / JavaScript | Frontend user interface |
| Node.js + Express.js | Backend web server and RESTful API |
| MySQL | Relational database |
| mysql2 | MySQL connection pool and queries |
| express-session | Session-based authentication |
| bcrypt | Password hashing |
| multer | File upload handling |
| dotenv | Environment variable management |

---

## Prerequisites

- Node.js (v14 or later)
- MySQL (v5.7 or later, or MariaDB)
- npm (comes with Node.js)

---

## Installation

1. Clone the repository

   git clone <repository-url>
   cd VibeCheck

2. Install dependencies

   npm install

3. Set up environment variables

   Create a .env file in the project root with the following:

   PORT=3000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=vibecheck

4. Set up the database

   mysql -u root -p

   CREATE DATABASE vibecheck;
   USE vibecheck;

   Then run the schema file:

   mysql -u root -p vibecheck < schema.sql

5. Create the uploads directory

   mkdir uploads

6. Start the server

   node server.js

   Visit http://localhost:3000 in your browser.

---

## Database Schema

The application uses 8 tables:

| Table | Description |
|-------|-------------|
| users | User accounts (username, email, password hash, bio, avatar) |
| videos | Uploaded videos (title, caption, video_url, views, is_private) |
| likes | User-video like relationships (many-to-many) |
| comments | Video comments linked to users |
| follows | User-to-user follow relationships (self-referencing many-to-many) |
| views_log | Tracks video views per user for "recently viewed" history |
| login_history | Login events with IP and user agent for security |
| sessions | Active user sessions (managed by express-session) |

---

## API Endpoints

Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/me | Get current user info |
| POST | /api/signup | Register a new account |
| POST | /api/login | Log in (records login history) |
| POST | /api/logout | Log out and clear session |

Videos

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/videos/:id | Get video details, comments, like status |
| POST | /api/videos/:id/like | Toggle like on a video |
| POST | /api/videos/:id/comments | Add a comment |
| GET | /api/videos/:id/recommended | Get personalized recommendations |
| POST | /api/upload | Upload a new video |
| PUT | /api/videos/:id/privacy | Toggle video privacy |
| DELETE | /api/videos/:id | Delete a video and all related data |

Profiles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/users/:id | Get public profile and videos |
| POST | /api/users/:id/follow | Follow/unfollow a user |
| GET | /api/me/profile | Get own profile dashboard |
| PUT | /api/me/bio | Update bio |

Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | /api/me/username | Change username |
| PUT | /api/me/password | Change password |
| GET | /api/me/login-history | View login history |

Feed

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/recommendations | Get all videos for the feed |

---

## Project Structure

VibeCheck/
├── public/                 # Static frontend files
│   ├── index.html          # Landing page
│   ├── home.html           # Main feed / recommendations
│   ├── login.html          # Login / signup page
│   ├── my-profile.html     # User dashboard
│   ├── profile.html        # Public profile view
│   ├── settings.html       # Account settings
│   ├── video.html          # Video watch page
│   ├── style.css           # Global styles
│   └── script.js           # Frontend application logic
├── uploads/                # Uploaded video files (created at runtime)
├── .env                    # Environment variables (create this file)
├── .gitignore              # Git ignore rules
├── package.json            # Node.js dependencies and scripts
├── package-lock.json       # Locked dependency versions
├── schema.sql              # Database schema definition
└── server.js               # Express backend server

---

## License

This project is for educational/demo purposes.