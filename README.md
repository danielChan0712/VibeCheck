# VibeCheck

Revised full-stack version with:
- Login / sign up
- Sidebar menu
- Home feed
- Profile page
- Video page
- Upload function
- Recommendation function

## Setup

1. Run the SQL in `database.sql`.
2. Put your MySQL credentials in `.env`.
3. Run:
   ```bash
   npm install
   npm start
   ```
4. Open `http://localhost:3000`.

## Notes

- Uploaded videos are saved to `public/videos/`.
- Recommendation uses `favorite_tag`, follows, likes, and views.
- Demo account buttons fill the login form with sample emails.
