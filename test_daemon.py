import time
from pathlib import Path
import json

# mock redis to prevent the test from connecting to real redis if missing
import sys
class MockRedis:
    def __init__(self, *args, **kwargs): pass
class MockQueue:
    def __init__(self, *args, **kwargs): pass
    def enqueue(self, *args, **kwargs): print(f"Enqueued {args} {kwargs}")

sys.modules['redis'] = __import__('types').SimpleNamespace(Redis=MockRedis)
sys.modules['rq'] = __import__('types').SimpleNamespace(Queue=MockQueue)

import pipeline.run_daemon as rd

rd.redis_host = 'dummy'
rd.FLASH_SEC = 2
rd.ARTICLE_SEC = 2
rd.SLEEP_SEC = 1

def mock_sleep(s):
    print("Sleeping...")
    time.sleep(1)
    raise SystemExit(0)
    
rd.time.sleep = mock_sleep

try:
    rd.main()
except SystemExit:
    pass
except Exception as e:
    import traceback
    traceback.print_exc()

print("Log content:")
try:
    print(Path("data/pipeline_run.log").read_text())
except FileNotFoundError:
    print("NO LOG FILE")
