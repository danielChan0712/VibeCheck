# VibeCheck

VibeCheck is a short-form video sharing platform inspired by modern social media apps, where users can upload videos, interact through likes and comments, follow creators, and receive personalized recommendations. It is built with Node.js, Express, and MySQL, and demonstrates full-stack development concepts including authentication, file uploads, relational data modeling, and session-based user management.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [License](#license)

## Features

- **User Authentication** — Signup, login with bcrypt password hashing, session management, and logout
- **Video Upload** — Upload videos with title, caption, and category
- **Video Feed** — Browse a recommendations feed sorted by recency
- **Personalized Recommendations** — Videos recommended based on hashtags from liked and commented videos
- **Engagement** — Like, comment, and view videos with real-time count updates
- **Follow System** — Follow and unfollow other users
- **Profile Dashboard** — View uploaded, liked, commented, and recently viewed videos
- **Public Profiles** — Browse other users' videos and bios
- **Privacy Controls** — Toggle videos between public and private
- **Security** — Login history tracking with IP address and user agent
- **Settings** — Change username, password, bio, and view login activity

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

## Prerequisites

- Node.js v14 or later
- MySQL v5.7 or later, or MariaDB
- npm

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd VibeCheck
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the project root:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=vibecheck
```

4. Set up the database:

```bash
mysql -u root -p
```

Then run:

```sql
CREATE DATABASE vibecheck;
USE vibecheck;
```

Import the schema:

```bash
mysql -u root -p vibecheck < database.sql
```

5. Create the uploads directory:

```bash
mkdir uploads
```

6. Start the server:

```bash
node server.js
```

7. Open the app in your browser:

```text
http://localhost:3000
```

## Database Schema

The application uses 8 tables:

| Table | Description |
|-------|-------------|
| users | User accounts including username, email, password hash, bio, and avatar |
| videos | Uploaded videos including title, caption, video URL, views, and privacy status |
| likes | User-video like relationships |
| comments | Video comments linked to users |
| follows | User-to-user follow relationships |
| views_log | Tracks video views for recently viewed history |
| login_history | Login events with IP address and user agent |
| sessions | Active user sessions managed by express-session |

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/me` | Get current user info |
| POST | `/api/signup` | Register a new account |
| POST | `/api/login` | Log in and record login history |
| POST | `/api/logout` | Log out and clear session |

### Videos

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/videos/:id` | Get video details, comments, and like status |
| POST | `/api/videos/:id/like` | Toggle like on a video |
| POST | `/api/videos/:id/comments` | Add a comment |
| GET | `/api/videos/:id/recommended` | Get personalized recommendations |
| POST | `/api/upload` | Upload a new video |
| PUT | `/api/videos/:id/privacy` | Toggle video privacy |
| DELETE | `/api/videos/:id` | Delete a video and all related data |

### Profiles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/:id` | Get a public profile and videos |
| POST | `/api/users/:id/follow` | Follow or unfollow a user |
| GET | `/api/me/profile` | Get own profile dashboard |
| PUT | `/api/me/bio` | Update bio |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/api/me/username` | Change username |
| PUT | `/api/me/password` | Change password |
| GET | `/api/me/login-history` | View login history |

### Feed

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/recommendations` | Get all videos for the feed |

## Project Structure

```text
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
├── .env                    # Environment variables
├── .gitignore              # Git ignore rules
├── package.json            # Node.js dependencies and scripts
├── package-lock.json       # Locked dependency versions
├── database.sql            # Database schema definition
└── server.js               # Express backend server
```

## License

This project is for educational and demo purposes only.