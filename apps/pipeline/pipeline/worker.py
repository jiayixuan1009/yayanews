import os
from redis import Redis
from rq import Worker, Queue
from pipeline.utils.redis_conn import get_redis_connection

listen = ['yayanews']

conn = get_redis_connection()

def main():
    print(f"Starting YayaNews RQ Worker...", flush=True)
    queues = [Queue(name, connection=conn) for name in listen]
    worker = Worker(queues, connection=conn)
    worker.work(with_scheduler=True)

if __name__ == '__main__':
    main()
else:
    # Entry point when run via `python3 -m pipeline.worker` (PM2)
    main()
