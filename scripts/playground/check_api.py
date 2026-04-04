"""Quick API health check for both DeepSeek models."""
import time, os, sys
sys.path.insert(0, '/var/www/yayanews/apps/pipeline')
os.chdir('/var/www/yayanews/apps/pipeline')

from openai import OpenAI

KEY = "sk-5ff36f81c0a1485caf5cb617c313efb8"
BASE = "https://api.deepseek.com/v1"

client = OpenAI(base_url=BASE, api_key=KEY, timeout=30.0)

for model in ["deepseek-chat", "deepseek-reasoner"]:
    print(f"\n--- Testing {model} ---")
    t0 = time.time()
    try:
        r = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Say OK in one word"}],
            max_tokens=5,
        )
        elapsed = time.time() - t0
        print(f"  Result: {r.choices[0].message.content.strip()}")
        print(f"  Time: {elapsed:.1f}s  ✅")
    except Exception as e:
        elapsed = time.time() - t0
        print(f"  ERROR: {type(e).__name__}: {e}")
        print(f"  Time: {elapsed:.1f}s  ❌")

# Check balance
print("\n--- Balance ---")
import urllib.request, json
req = urllib.request.Request("https://api.deepseek.com/user/balance",
    headers={"Authorization": f"Bearer {KEY}"})
with urllib.request.urlopen(req, timeout=10) as resp:
    data = json.loads(resp.read())
    for b in data.get("balance_infos", []):
        print(f"  {b['currency']}: {b['total_balance']}")
