import psycopg2

conn = psycopg2.connect("postgresql://yayanews:Jia1009po@127.0.0.1:5432/yayanews")
cur = conn.cursor()
cur.execute("SELECT slug, title FROM topics WHERE cover_image IS NULL OR cover_image = '';")
items = cur.fetchall()
missing = [item[0] for item in items]
print(f"Missing images count: {len(missing)}")
print(f"Missing items: {missing}")
cur.close()
conn.close()
