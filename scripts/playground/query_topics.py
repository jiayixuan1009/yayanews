import psycopg2
import json

conn = psycopg2.connect("postgresql://yayanews:Jia1009po@127.0.0.1:5432/yayanews")
cur = conn.cursor()
cur.execute("SELECT id, slug, cover_image, status FROM topics ORDER BY id ASC;")
rows = cur.fetchall()

result = []
for r in rows:
    result.append({
        "id": r[0],
        "slug": r[1],
        "cover_image": r[2],
        "status": r[3]
    })

with open("/var/www/yayanews/topics_report.json", "w") as f:
    json.dump(result, f, indent=2)

print(f"Total topics: {len(rows)}")
conn.close()
