import psycopg2

conn = psycopg2.connect("postgresql://yayanews:Jia1009po@127.0.0.1:5432/yayanews")
cur = conn.cursor()
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'categories';")
rows = cur.fetchall()
print([r[0] for r in rows])
conn.close()
