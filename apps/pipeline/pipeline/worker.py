import os
from redis import Redis
from rq import Worker, Queue
from pipeline.utils.redis_conn import get_redis_connection

# 允许通过环境变量指定监听的队列，多个用逗号分隔
# 例如: RQ_QUEUES=yayanews:flash 或 RQ_QUEUES=yayanews:articles
listen = os.environ.get('RQ_QUEUES', 'yayanews:flash,yayanews:articles').split(',')

conn = get_redis_connection()

def main():
    print(f"Starting YayaNews RQ Worker on queues: {listen}", flush=True)
    queues = [Queue(name.strip(), connection=conn) for name in listen]
    worker = Worker(queues, connection=conn)
    worker.work(with_scheduler=True)

if __name__ == '__main__':
    main()
else:
    # Entry point when run via `python3 -m pipeline.worker` (PM2)
    main()

