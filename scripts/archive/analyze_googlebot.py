import gzip
import re
from collections import Counter

LOG_PATH = r"D:\sessionfilter\accesslog\access.log-20260408.gz"

status_codes = Counter()
blocked = []
sitemap_lines = []

with gzip.open(LOG_PATH, "rt", encoding="utf-8", errors="replace") as f:
    for line in f:
        if "Googlebot" not in line and "googlebot" not in line:
            continue
        m = re.search(r'" (\d{3}) ', line)
        if m:
            code = m.group(1)
            status_codes[code] += 1
            if code in ("403", "429", "444", "503"):
                blocked.append(line.strip()[:400])
        if "sitemap" in line.lower():
            sitemap_lines.append(line.strip()[:400])

print("=" * 60)
print("Googlebot Status Code Distribution")
print("=" * 60)
for code, cnt in sorted(status_codes.items()):
    flag = "  *** BLOCKED ***" if code in ("403", "429", "444", "503") else ""
    print(f"  HTTP {code}: {cnt} requests{flag}")
print(f"  TOTAL: {sum(status_codes.values())} requests")

print(f"\n{'=' * 60}")
print(f"Sitemap-related Googlebot requests: {len(sitemap_lines)}")
print("=" * 60)
for l in sitemap_lines[:30]:
    print(l)

print(f"\n{'=' * 60}")
print(f"BLOCKED requests (403/429/444/503): {len(blocked)}")
print("=" * 60)
for l in blocked[:20]:
    print(l)
    print()
