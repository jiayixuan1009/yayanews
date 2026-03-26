"""
Pipeline 周报邮件：近 7 日文章/快讯 run 次数、总耗时、产量摘要。

环境变量（均必填除 SSL）：
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
  DIGEST_TO_EMAIL  收件人，多个用逗号
  DIGEST_FROM_EMAIL 发件人（默认同 SMTP_USER）
  SMTP_USE_TLS      默认 1

用法（建议 cron 每周一，见 PRD §14.5）：
  python -m pipeline.tools.weekly_digest_email

  0 6 * * 1 cd /path/to/biyanews && . ./.env && python -m pipeline.tools.weekly_digest_email
"""
import os
import smtplib
import sqlite3
import sys
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

DB = Path(__file__).resolve().parent.parent.parent / "data" / "yayanews.db"


def main():
    host = os.environ.get("SMTP_HOST", "")
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER", "")
    password = os.environ.get("SMTP_PASSWORD", "")
    to_raw = os.environ.get("DIGEST_TO_EMAIL", "")
    from_addr = os.environ.get("DIGEST_FROM_EMAIL") or user
    use_tls = os.environ.get("SMTP_USE_TLS", "1") != "0"

    if not all([host, user, password, to_raw]):
        print("缺少 SMTP_HOST / SMTP_USER / SMTP_PASSWORD / DIGEST_TO_EMAIL", file=sys.stderr)
        sys.exit(1)

    to_list = [x.strip() for x in to_raw.split(",") if x.strip()]
    since = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")

    conn = sqlite3.connect(str(DB))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT run_type,
               COUNT(*) as n,
               SUM(items_produced) as produced,
               AVG(total_seconds) as avg_sec,
               MAX(total_seconds) as max_sec
        FROM pipeline_runs
        WHERE finished_at >= ?
        GROUP BY run_type
        """,
        (since,),
    ).fetchall()
    conn.close()

    lines = [f"YayaNews Pipeline 周报（UTC 近 7 日，自 {since}）", ""]
    if not rows:
        lines.append("本周期无 pipeline_runs 记录。")
    else:
        lines.append(f"{'类型':<10} {'次数':>6} {'产出合计':>10} {'平均秒':>10} {'最大秒':>10}")
        for r in rows:
            lines.append(
                f"{r['run_type']:<10} {r['n']:>6} {r['produced'] or 0:>10} "
                f"{(r['avg_sec'] or 0):>10.1f} {(r['max_sec'] or 0):>10.1f}"
            )

    body = "\n".join(lines)
    subject = f"[YayaNews] Pipeline 周报 {datetime.utcnow().strftime('%Y-%m-%d')}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = ", ".join(to_list)
    msg.attach(MIMEText(body, "plain", "utf-8"))

    with smtplib.SMTP(host, port, timeout=30) as s:
        if use_tls:
            s.starttls()
        s.login(user, password)
        s.sendmail(from_addr, to_list, msg.as_string())

    print("周报已发送 →", to_list)


if __name__ == "__main__":
    main()
