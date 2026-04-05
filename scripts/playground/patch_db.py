import psycopg2
conn = psycopg2.connect("postgresql://yayanews:REDACTED@127.0.0.1:5432/yayanews")
cur = conn.cursor()
cur.execute("UPDATE topics SET cover_image = REPLACE(cover_image, '.png', '.jpg')")
conn.commit()
print("Updated rows:", cur.rowcount)
cur.close()
conn.close()
