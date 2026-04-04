import psycopg2
conn = psycopg2.connect("postgresql://yayanews:Jia1009po@127.0.0.1:5432/yayanews")
cur = conn.cursor()
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'categories'")
cols = [r[0] for r in cur.fetchall()]
print(f"Categories columns: {cols}")
cur.close()
conn.close()
