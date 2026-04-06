import os
import sys
import asyncio
from prisma import Prisma
import random

async def main():
    db = Prisma()
    await db.connect()
    
    # 查找所有来源是 方程式新闻/BWEnews 的文章
    articles = await db.article.find_many(
        where={'source': {'contains': 'BWEnews'}}
    )
    print(f"Found {len(articles)} BWEnews articles.")
    
    for article in articles:
        seed = random.randint(1, 100000)
        new_url = f"https://loremflickr.com/1200/630/finance,crypto,business/all?lock={seed}"
        await db.article.update(
            where={'id': article.id},
            data={'cover_image': new_url}
        )
        print(f"Updated article {article.id} cover -> {new_url}")
        
    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
