import psycopg2

conn = psycopg2.connect("postgresql://yayanews:Jia1009po@127.0.0.1:5432/yayanews")
cur = conn.cursor()
cur.execute("SELECT slug, cover_image FROM topics LIMIT 15;")
items = cur.fetchall()
for item in items:
    print(f" - {item[0]}: {item[1]}")
cur.close()
conn.close()
