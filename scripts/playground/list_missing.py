import psycopg2
conn = psycopg2.connect("postgresql://yayanews:Jia1009po@127.0.0.1:5432/yayanews")
cur = conn.cursor()
cur.execute("SELECT slug FROM topics WHERE cover_image IS NULL OR cover_image = '';")
items = [r[0] for r in cur.fetchall()]
print(f'Missing images count: {len(items)}\nMissing items: {items}')
cur.close()
conn.close()
