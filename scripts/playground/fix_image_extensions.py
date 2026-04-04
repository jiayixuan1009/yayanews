import psycopg2
import os
import subprocess

def main():
    conn = psycopg2.connect("postgresql://yayanews:Jia1009po@127.0.0.1:5432/yayanews")
    cur = conn.cursor()
    cur.execute("SELECT id, cover_image FROM topics WHERE cover_image IS NOT NULL AND cover_image != '';")
    rows = cur.fetchall()

    base_dir = "/var/www/yayanews/apps/web/public"
    updates = []

    for row in rows:
        topic_id = row[0]
        cover_image = row[1]
        
        if cover_image.endswith(".png"):
            file_path = os.path.join(base_dir, cover_image.lstrip("/"))
            if os.path.exists(file_path):
                # Check mime type
                res = subprocess.run(["file", file_path], capture_output=True, text=True)
                if "JPEG" in res.stdout:
                    new_image = cover_image[:-4] + ".jpg"
                    new_file_path = os.path.join(base_dir, new_image.lstrip("/"))
                    os.rename(file_path, new_file_path)
                    print(f"Renamed {file_path} -> {new_file_path}")
                    updates.append((new_image, topic_id))

    if updates:
        for new_img, tid in updates:
            cur.execute("UPDATE topics SET cover_image = %s WHERE id = %s", (new_img, tid))
        conn.commit()
        print(f"Updated {len(updates)} records in database.")
    else:
        print("No records to update.")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
