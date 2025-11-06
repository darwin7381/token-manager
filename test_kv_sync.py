"""
測試 KV 同步邏輯
"""
import asyncio
import os
import sys

# 添加 backend 到路徑
sys.path.insert(0, '/Users/JL/Development/microservice-system/token-manager/backend')

os.environ['CF_ACCOUNT_ID'] = "b1d3f8b35c1b43afe837b997180714f3"
os.environ['CF_API_TOKEN'] = "uBsg7eV7RvCGFNhtWlTKcmQxx7mh_gWwqfoQbvC4"
os.environ['CF_KV_NAMESPACE_ID'] = "c36cc6c8cc38473dad537a0ab016d83f"
os.environ['CLERK_SECRET_KEY'] = "sk_test_Ra6GoB17s1RYjRQoaAIKQTCUBHRNtIvtKRE7CEuOba"
os.environ['DATABASE_URL'] = "postgresql://postgres:lxMLMsTYvbGyQTsNDtRyfhslZLmqASnJ@maglev.proxy.rlwy.net:40447/railway"

from database import Database

async def test_sync():
    print("=" * 70)
    print("測試 KV 到 PostgreSQL 同步邏輯")
    print("=" * 70)
    
    db = Database()
    await db.connect()
    
    # 只測試同步功能
    await db.sync_missing_from_kv()
    
    await db.disconnect()
    print("\n✅ 測試完成")

if __name__ == "__main__":
    asyncio.run(test_sync())

