import os
from redis import Redis
from rq import Worker, Queue, SimpleWorker
from pipeline.utils.redis_conn import get_redis_connection

# 允许通过环境变量指定监听的队列，多个用逗号分隔
if os.name == 'nt':
    import rq.timeouts
    class WindowsDeathPenalty(object):
        def __init__(self, timeout, exception, **kwargs): pass
        def __enter__(self): pass
        def __exit__(self, type, value, traceback): pass
        def cancel(self): pass
    rq.timeouts.UnixSignalDeathPenalty = WindowsDeathPenalty

# 例如: RQ_QUEUES=yayanews:flash 或 RQ_QUEUES=yayanews:articles
listen = os.environ.get('RQ_QUEUES', 'yayanews:flash,yayanews:articles').split(',')

conn = get_redis_connection()

def main():
    print(f"Starting YayaNews RQ Worker on queues: {listen}", flush=True)
    queues = [Queue(name.strip(), connection=conn) for name in listen]
    WorkerClass = SimpleWorker if os.name == 'nt' else Worker
    if os.name == 'nt':
        WorkerClass.death_penalty_class = WindowsDeathPenalty
    worker = WorkerClass(queues, connection=conn)
    is_primary = os.environ.get('NODE_APP_INSTANCE', '0') == '0'
    try:
        worker.work(with_scheduler=is_primary)
    except ValueError as e:
        if 'scheduler' in str(e).lower():
            worker.work(with_scheduler=False)
        else:
            raise

if __name__ == '__main__':
    main()
else:
    # Entry point when run via `python3 -m pipeline.worker` (PM2)
    main()

