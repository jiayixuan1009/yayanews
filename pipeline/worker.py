import os
from redis import Redis
from rq import Worker, Queue, Connection

listen = ['yayanews']
redis_host = os.environ.get('REDIS_HOST', 'localhost')
redis_port = int(os.environ.get('REDIS_PORT', '6379'))

conn = Redis(host=redis_host, port=redis_port, db=0)

if __name__ == '__main__':
    print(f"Starting YayaNews RQ Worker on Redis {redis_host}:{redis_port}...")
    with Connection(conn):
        worker = Worker(map(Queue, listen))
        worker.work(with_scheduler=True)
