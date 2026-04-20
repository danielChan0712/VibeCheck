# VibeCheck

Fully corrected demo project with working login/sign up, home recommendations, artist profile page, and video page.

## Setup

1. Copy `.env.example` to `.env` and set your MySQL password.
2. Create the schema:
   `mysql -u root -p < database.sql`
3. Install packages:
   `npm install`
4. Start the app:
   `npm start`
5. Open `http://localhost:3000`

## Sample login

- Email: `sarah@test.com`
- Password: `password123`

## Pages

- `/login.html`
- `/home.html`
- `/profile.html?id=1`
- `/video.html?id=1`

## Notes

- The schema matches the backend exactly, including `favorite_tag` and `category`.
- Sample data is auto-seeded by `server.js` if the tables are empty.
- Uploads are stored in `uploads/`.
