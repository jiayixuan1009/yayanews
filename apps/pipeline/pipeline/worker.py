import os
from redis import Redis
from rq import Worker, Queue

listen = ['yayanews']
redis_host = os.environ.get('REDIS_HOST', 'localhost')
redis_port = int(os.environ.get('REDIS_PORT', '6379'))

conn = Redis(host=redis_host, port=redis_port, db=0)

def main():
    print(f"Starting YayaNews RQ Worker on Redis {redis_host}:{redis_port}...", flush=True)
    queues = [Queue(name, connection=conn) for name in listen]
    worker = Worker(queues, connection=conn)
    worker.work(with_scheduler=True)

if __name__ == '__main__':
    main()
else:
    # Entry point when run via `python3 -m pipeline.worker` (PM2)
    main()
