# VibeCheck

A full-stack video sharing and vibe checking platform with user authentication, video uploads, and smart recommendations.

## Features

- Login / Sign up system
- Sidebar navigation menu
- Home feed with personalized content
- Profile page with user stats
- Video upload and playback
- Smart recommendation engine
- Like, follow, and tag system

## Tech Stack

- Backend: Node.js + Express
- Database: MySQL
- Frontend: HTML, CSS, JavaScript
- File Upload: Multer
- Authentication: JWT + bcrypt

## Prerequisites

Before you begin, ensure you have installed:

- Node.js (v14 or higher)
- MySQL (v8 or higher)
- Git (for cloning)

## Installation Guide

### Step 1: Clone the Repository

git clone https://github.com/danielChan0712/VibeCheck.git
cd VibeCheck

### Step 2: Install Dependencies

npm install

This installs:
- express (web server)
- mysql2 (database driver)
- dotenv (environment variables)
- jsonwebtoken (authentication)
- bcrypt (password hashing)
- multer (file uploads)
- cors (cross-origin requests)

### Step 3: Set Up the Database

Login to MySQL:
mysql -u root -p

Inside MySQL, run:
source database.sql;
or copy-paste the contents of database.sql

Exit MySQL:
exit;

### Step 4: Configure Environment Variables (.env)

What is .env?
A .env file stores sensitive information like passwords and keys. It is NEVER uploaded to GitHub.

Create the .env file:

On Mac/Linux:
touch .env

On Windows:
type nul > .env

Add these variables to .env:

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD_HERE
DB_NAME=vibecheck_db

# Server Configuration
PORT=3000

# Security (Generate your own secret key)
JWT_SECRET=your_super_secret_key_change_this

# File Upload
MAX_FILE_SIZE=100000000

How to get each value:

DB_HOST: Usually "localhost"
DB_USER: Your MySQL username (default is "root")
DB_PASSWORD: Your MySQL password (what you set during MySQL installation)
DB_NAME: Must match database.sql (use "vibecheck_db")
PORT: Port for the server (use 3000 or any available port)
JWT_SECRET: Generate a random string (see methods below)

Generate a secure JWT_SECRET:

Method 1 - Using Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

Method 2 - Using OpenSSL (Mac/Linux):
openssl rand -hex 32

Method 3 - Create a long random string manually:
Example: "xK9mP2vL5nQ8rT3wE7yU1zC4"

### Step 5: Create Required Folders

Create folder for uploaded videos:
mkdir -p public/videos
mkdir -p uploads

Set permissions (Mac/Linux):
chmod 755 public/videos
chmod 755 uploads

### Step 6: Start the Application

Development mode (with auto-restart):
npm run dev

OR Production mode:
npm start

### Step 7: Access the Application

Open your browser and go to:
http://localhost:3000

## Using the Application

### Demo Accounts (Quick Login)

Click these buttons on the login page:
- Demo User 1: alice@example.com
- Demo User 2: bob@example.com
- Demo User 3: charlie@example.com

### Creating Your Own Account

1. Click "Sign Up" on the login page
2. Fill in your email and password
3. Choose a favorite tag (music, gaming, comedy, etc.)
4. Start uploading and sharing

### Uploading Videos

1. Click "Upload" in the sidebar
2. Select a video file (MP4, MOV, etc.)
3. Add a title, description, and tags
4. Click "Upload" - your video will be processed

### Getting Recommendations

The recommendation engine suggests videos based on:
- Your favorite tag
- Who you follow
- Videos you have liked
- Most viewed content

## Troubleshooting

### Error: "Cannot find module 'dotenv'"

npm install dotenv

### Error: "ER_ACCESS_DENIED_ERROR"

Your MySQL password in .env is incorrect. Check:
- MySQL is running: mysql -u root -p
- Password matches your MySQL setup

### Error: "ER_BAD_DB_ERROR"

Database does not exist. Run the SQL:
mysql -u root -p < database.sql

### Uploaded videos not showing

Check folder permissions:
ls -la public/videos
Should be writable by Node.js

### Port 3000 already in use

Change PORT=3001 in .env or kill the process:

On Mac/Linux:
lsof -i :3000
kill -9 [PID]

On Windows:
netstat -ano | findstr :3000
taskkill /PID [PID] /F

## Project Structure

VibeCheck/
├── server.js           # Main application
├── database.sql        # Database schema
├── package.json        # Dependencies
├── .env               # Environment variables (create this)
├── .gitignore         # Files ignored by git
├── public/
│   ├── index.html     # Main page
│   ├── login.html     # Authentication
│   ├── home.html      # Feed
│   ├── profile.html   # User profile
│   ├── video.html     # Video player
│   ├── style.css      # Styling
│   ├── script.js      # Frontend logic
│   └── videos/        # Uploaded videos
├── uploads/           # Temporary uploads
└── python/
    └── trending.py    # Recommendation engine
