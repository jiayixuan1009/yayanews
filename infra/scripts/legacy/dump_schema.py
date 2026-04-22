import sqlite3
import pprint
conn = sqlite3.connect('data/yayanews.db')
for row in conn.execute("SELECT sql FROM sqlite_master WHERE type='table';"):
    print(row[0])
