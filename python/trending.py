import json
import mysql.connector
import os

conn = mysql.connector.connect(
    host=os.getenv('DB_HOST', 'localhost'),
    user=os.getenv('DB_USER', 'root'),
    password=os.getenv('DB_PASSWORD', ''),
    database=os.getenv('DB_NAME', 'vibecheck')
)
cur = conn.cursor(dictionary=True)
cur.execute('''
SELECT v.id, v.caption, v.video_url, v.category, v.views, v.created_at, u.username,
       (SELECT COUNT(*) FROM likes WHERE video_id = v.id) AS likes
FROM videos v
JOIN users u ON v.user_id = u.id
ORDER BY likes DESC, v.views DESC, v.created_at DESC
LIMIT 10
''')
rows = cur.fetchall()
print(json.dumps(rows, default=str))
cur.close()
conn.close()
