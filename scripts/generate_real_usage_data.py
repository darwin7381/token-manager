#!/usr/bin/env python3
"""
生成真實的使用數據
使用真實的 Token hash 和路由路徑
"""

import asyncio
import asyncpg
import httpx
import random
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = "http://localhost:8000"
DATABASE_URL = os.getenv("DATABASE_URL")

async def main():
    print("🎬 生成真實使用數據")
    print("=" * 50)
    print()
    
    # 連接數據庫
    print("📊 連接數據庫...")
    conn = await asyncpg.connect(DATABASE_URL)
    
    # 獲取真實的 Token
    print("🔑 獲取真實 Token...")
    tokens = await conn.fetch("""
        SELECT token_hash, name, id 
        FROM tokens 
        WHERE is_active = TRUE 
        LIMIT 5
    """)
    
    if not tokens:
        print("❌ 沒有找到活躍的 Token")
        print("請先在前端創建一些 Token")
        await conn.close()
        return
    
    print(f"✅ 找到 {len(tokens)} 個 Token:")
    for t in tokens:
        print(f"   - {t['name']} (ID: {t['id']}) | Hash: {t['token_hash'][:20]}...")
    print()
    
    # 獲取真實的路由
    print("🛣️  獲取真實路由...")
    routes = await conn.fetch("SELECT path, name FROM routes")
    
    if not routes:
        print("❌ 沒有找到路由")
        print("請先在前端創建一些路由")
        await conn.close()
        return
    
    print(f"✅ 找到 {len(routes)} 個路由:")
    for r in routes:
        print(f"   - {r['name']}: {r['path']}")
    print()
    
    await conn.close()
    
    # 準備數據
    token_hashes = [t['token_hash'] for t in tokens]
    route_paths = [r['path'] for r in routes]
    methods = ['GET', 'POST', 'PUT', 'DELETE']
    
    print(f"🚀 開始生成 300 條使用記錄...")
    print()
    
    # 生成數據
    async with httpx.AsyncClient() as client:
        success_count = 0
        
        for i in range(300):
            # 隨機選擇
            token_hash = random.choice(token_hashes)
            route_path = random.choice(route_paths)
            method = random.choice(methods)
            
            # 95% 成功率
            status = 200 if random.random() < 0.95 else random.choice([404, 500])
            
            # 響應時間：50-2500ms
            response_time = random.randint(50, 2500)
            
            # 時間：最近 7 天隨機分佈
            hours_ago = random.randint(0, 168)  # 7 * 24
            timestamp = int((datetime.now() - timedelta(hours=hours_ago)).timestamp() * 1000)
            
            # IP 地址
            ip = f"192.168.1.{random.randint(1, 254)}"
            
            # 發送記錄
            try:
                response = await client.post(
                    f"{BACKEND_URL}/api/usage-log",
                    json={
                        "token_hash": token_hash,
                        "route": route_path,
                        "timestamp": timestamp,
                        "response_status": status,
                        "response_time_ms": response_time,
                        "ip_address": ip,
                        "user_agent": "n8n-workflow/1.0",
                        "request_method": method,
                        "error_message": "API Error" if status >= 400 else None
                    },
                    timeout=5.0
                )
                
                if response.status_code == 200:
                    success_count += 1
                    print(".", end="", flush=True)
                else:
                    print("x", end="", flush=True)
                    
            except Exception as e:
                print(f"\n❌ 錯誤: {e}")
            
            # 每 50 條休息一下
            if (i + 1) % 50 == 0:
                print(f" ({i + 1}/300)")
                await asyncio.sleep(0.1)
    
    print()
    print()
    print(f"✅ 完成！成功生成 {success_count}/300 條記錄")
    print()
    
    # 驗證數據
    print("🔍 驗證數據...")
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BACKEND_URL}/api/usage/test-data")
        data = response.json()
        print(f"✅ 資料庫中共有 {data['count']} 條使用記錄")
    
    print()
    print("=" * 50)
    print("🎉 真實演示數據生成完成！")
    print()
    print("📱 現在訪問以下頁面:")
    print()
    print("  1. API 使用分析:")
    print("     http://localhost:5173/usage-analytics")
    print()
    print("  2. Dashboard 總覽:")
    print("     http://localhost:5173/dashboard")
    print()
    print("  3. Token 使用詳情（使用你的真實 Token ID）:")
    for t in tokens[:3]:
        print(f"     http://localhost:5173/token-usage/{t['id']}")
    print()
    print("  4. 路由使用統計:")
    for r in routes[:3]:
        print(f"     http://localhost:5173/route-usage?path={r['path']}")
    print()
    print("✅ 所有頁面都能看到真實數據！")

if __name__ == "__main__":
    asyncio.run(main())

