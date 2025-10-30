"""
Token Manager - FastAPI 主應用
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from datetime import datetime, timedelta
import secrets
import hashlib
import os
from dotenv import load_dotenv

from models import (
    TokenCreate, TokenUpdate, TokenResponse, TokenCreateResponse,
    RouteCreate, RouteUpdate, RouteResponse, StatsResponse
)
from database import db
from cloudflare import get_cf_kv

# 加載環境變數
load_dotenv()

# 創建 FastAPI 應用
app = FastAPI(
    title="Token Manager API",
    description="API Token 集中管理系統",
    version="1.0.0"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生產環境應限制具體域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== 啟動/關閉事件 ====================

@app.on_event("startup")
async def startup():
    """應用啟動時初始化數據庫"""
    try:
        await db.connect()
        print("✅ Database connected and tables initialized")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        raise


@app.on_event("shutdown")
async def shutdown():
    """應用關閉時清理資源"""
    await db.disconnect()
    print("👋 Database disconnected")


# ==================== 工具函數 ====================

def generate_token() -> str:
    """生成安全的 API Token"""
    return f"ntk_{secrets.token_urlsafe(32)}"


def hash_token(token: str) -> str:
    """計算 token 的 SHA256 hash"""
    return hashlib.sha256(token.encode()).hexdigest()


async def log_audit(action: str, entity_type: str, entity_id: int = None, details: dict = None):
    """記錄審計日誌"""
    import json
    async with db.pool.acquire() as conn:
        # asyncpg 需要 JSONB 參數使用 json.dumps 轉換
        details_json = json.dumps(details) if details else None
        await conn.execute("""
            INSERT INTO audit_logs (action, entity_type, entity_id, details)
            VALUES ($1, $2, $3, $4::jsonb)
        """, action, entity_type, entity_id, details_json)


# ==================== Token API ====================

@app.post("/api/tokens", response_model=TokenCreateResponse)
async def create_token(data: TokenCreate):
    """創建新的 API Token"""
    try:
        # 1. 生成 token
        token = generate_token()
        token_hash = hash_token(token)
        
        # 2. 計算過期時間
        expires_at = None
        if data.expires_days:
            expires_at = datetime.utcnow() + timedelta(days=data.expires_days)
        
        # 3. 存入資料庫
        async with db.pool.acquire() as conn:
            token_id = await conn.fetchval("""
                INSERT INTO tokens (token_hash, name, department, scopes, expires_at)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            """, token_hash, data.name, data.department, data.scopes, expires_at)
        
        # 4. 同步到 Cloudflare KV
        try:
            cf_kv = get_cf_kv()
            await cf_kv.put_token(token_hash, {
                "name": data.name,
                "department": data.department,
                "scopes": data.scopes,
                "created_at": datetime.utcnow().isoformat(),
                "expires_at": expires_at.isoformat() if expires_at else None
            })
        except Exception as e:
            # 如果 KV 同步失敗,回滾數據庫操作
            async with db.pool.acquire() as conn:
                await conn.execute("DELETE FROM tokens WHERE id = $1", token_id)
            raise HTTPException(500, f"Failed to sync to Cloudflare: {str(e)}")
        
        # 5. 記錄審計日誌
        await log_audit("create", "token", token_id, {"name": data.name})
        
        # 6. 返回 token (只此一次!)
        return TokenCreateResponse(
            id=token_id,
            token=token,
            name=data.name,
            department=data.department,
            scopes=data.scopes
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"❌ Error creating token: {e}")
        print(traceback.format_exc())
        raise HTTPException(500, f"Error creating token: {str(e)}")


@app.get("/api/tokens", response_model=List[TokenResponse])
async def list_tokens():
    """列出所有活躍的 tokens (不包含實際 token 值)"""
    async with db.pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, name, department, scopes, created_at, expires_at, last_used
            FROM tokens
            WHERE is_active = TRUE
            ORDER BY created_at DESC
        """)
    
    return [TokenResponse(**dict(row)) for row in rows]


@app.put("/api/tokens/{token_id}", response_model=TokenResponse)
async def update_token(token_id: int, data: TokenUpdate):
    """更新 Token (名稱、部門、權限)"""
    
    async with db.pool.acquire() as conn:
        # 獲取現有 Token
        token = await conn.fetchrow("SELECT * FROM tokens WHERE id = $1 AND is_active = TRUE", token_id)
        if not token:
            raise HTTPException(404, "Token not found")
        
        # 構建更新語句
        updates = []
        params = []
        param_count = 1
        
        if data.name is not None:
            updates.append(f"name = ${param_count}")
            params.append(data.name)
            param_count += 1
        
        if data.department is not None:
            updates.append(f"department = ${param_count}")
            params.append(data.department)
            param_count += 1
        
        if data.scopes is not None:
            updates.append(f"scopes = ${param_count}")
            params.append(data.scopes)
            param_count += 1
        
        if not updates:
            raise HTTPException(400, "No fields to update")
        
        params.append(token_id)
        query = f"UPDATE tokens SET {', '.join(updates)} WHERE id = ${param_count}"
        
        await conn.execute(query, *params)
        updated_token = await conn.fetchrow("SELECT * FROM tokens WHERE id = $1", token_id)
    
    # 如果 scopes 更新了，需要同步到 KV
    if data.scopes is not None:
        try:
            cf_kv = get_cf_kv()
            await cf_kv.put_token(updated_token['token_hash'], {
                "name": updated_token['name'],
                "department": updated_token['department'],
                "scopes": updated_token['scopes'],
                "created_at": updated_token['created_at'].isoformat(),
                "expires_at": updated_token['expires_at'].isoformat() if updated_token['expires_at'] else None
            })
        except Exception as e:
            print(f"Warning: Failed to update token in KV: {e}")
    
    # 審計日誌
    await log_audit("update", "token", token_id, {
        "name": data.name,
        "department": data.department,
        "scopes": data.scopes
    })
    
    return TokenResponse(**dict(updated_token))


@app.delete("/api/tokens/{token_id}")
async def delete_token(token_id: int):
    """撤銷 (刪除) token"""
    
    # 1. 獲取 token_hash
    async with db.pool.acquire() as conn:
        token = await conn.fetchrow("""
            SELECT token_hash, name FROM tokens WHERE id = $1
        """, token_id)
        
        if not token:
            raise HTTPException(404, "Token not found")
        
        # 2. 從資料庫刪除
        await conn.execute("DELETE FROM tokens WHERE id = $1", token_id)
    
    # 3. 從 Cloudflare KV 刪除
    try:
        cf_kv = get_cf_kv()
        await cf_kv.delete_token(token['token_hash'])
    except Exception as e:
        print(f"Warning: Failed to delete token from KV: {e}")
        # 即使 KV 刪除失敗,也不回滾數據庫操作
        # 因為 token 已經從數據庫刪除,下次創建會覆蓋 KV
    
    # 4. 記錄審計日誌
    await log_audit("delete", "token", token_id, {"name": token['name']})
    
    return {"status": "deleted"}


# ==================== Route API ====================

@app.post("/api/routes", response_model=RouteResponse)
async def create_route(data: RouteCreate):
    """新增微服務路由"""
    
    # 1. 存入資料庫
    async with db.pool.acquire() as conn:
        try:
            route_id = await conn.fetchval("""
                INSERT INTO routes (name, path, backend_url, description, tags)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            """, data.name, data.path, data.backend_url, data.description, data.tags or [])
            
            created_at = await conn.fetchval(
                "SELECT created_at FROM routes WHERE id = $1", route_id
            )
        except Exception as e:
            if "unique" in str(e).lower():
                raise HTTPException(400, f"Route path '{data.path}' already exists")
            raise HTTPException(500, f"Database error: {str(e)}")
    
    # 2. 同步所有路由到 Cloudflare
    await sync_routes_to_kv()
    
    # 3. 記錄審計日誌
    await log_audit("create", "route", route_id, {
        "path": data.path,
        "backend_url": data.backend_url,
        "tags": data.tags or []
    })
    
    return RouteResponse(
        id=route_id,
        name=data.name,
        path=data.path,
        backend_url=data.backend_url,
        description=data.description,
        tags=data.tags or [],
        created_at=created_at
    )


@app.get("/api/routes", response_model=List[RouteResponse])
async def list_routes():
    """列出所有路由"""
    async with db.pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, name, path, backend_url, description, tags, created_at
            FROM routes
            ORDER BY created_at DESC
        """)
    
    return [RouteResponse(**dict(row)) for row in rows]


@app.put("/api/routes/{route_id}", response_model=RouteResponse)
async def update_route(route_id: int, data: RouteUpdate):
    """修改路由"""
    
    async with db.pool.acquire() as conn:
        # 獲取現有路由
        route = await conn.fetchrow("SELECT * FROM routes WHERE id = $1", route_id)
        if not route:
            raise HTTPException(404, "Route not found")
        
        # 構建更新語句
        updates = []
        params = []
        param_count = 1
        
        if data.name is not None:
            updates.append(f"name = ${param_count}")
            params.append(data.name)
            param_count += 1
        
        if data.backend_url is not None:
            updates.append(f"backend_url = ${param_count}")
            params.append(data.backend_url)
            param_count += 1
        
        if data.description is not None:
            updates.append(f"description = ${param_count}")
            params.append(data.description)
            param_count += 1
        
        if data.tags is not None:
            updates.append(f"tags = ${param_count}")
            params.append(data.tags)
            param_count += 1
        
        if not updates:
            raise HTTPException(400, "No fields to update")
        
        params.append(route_id)
        query = f"UPDATE routes SET {', '.join(updates)} WHERE id = ${param_count}"
        
        await conn.execute(query, *params)
        route = await conn.fetchrow("SELECT * FROM routes WHERE id = $1", route_id)
    
    # 同步到 Cloudflare
    await sync_routes_to_kv()
    
    # 審計日誌
    await log_audit("update", "route", route_id, {
        "backend_url": data.backend_url,
        "description": data.description,
        "tags": data.tags
    })
    
    return RouteResponse(**dict(route))


@app.get("/api/routes/tags")
async def list_tags():
    """列出所有可用的 tags"""
    async with db.pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT DISTINCT unnest(tags) as tag
            FROM routes
            WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
            ORDER BY tag
        """)
    
    return {"tags": [row['tag'] for row in rows]}


@app.delete("/api/routes/{route_id}")
async def delete_route(route_id: int):
    """刪除路由"""
    
    async with db.pool.acquire() as conn:
        route = await conn.fetchrow("SELECT path FROM routes WHERE id = $1", route_id)
        
        if not route:
            raise HTTPException(404, "Route not found")
        
        await conn.execute("DELETE FROM routes WHERE id = $1", route_id)
    
    # 同步到 Cloudflare
    await sync_routes_to_kv()
    
    # 審計日誌
    await log_audit("delete", "route", route_id, {"path": route['path']})
    
    return {"status": "deleted"}


async def sync_routes_to_kv():
    """同步所有路由到 Cloudflare KV (包含 tags 信息)"""
    async with db.pool.acquire() as conn:
        routes = await conn.fetch("SELECT path, backend_url, tags FROM routes")
    
    # 新格式: {path: {url: backend_url, tags: [...]}}
    routes_map = {}
    for route in routes:
        routes_map[route['path']] = {
            'url': route['backend_url'],
            'tags': route['tags'] or []
        }
    
    try:
        cf_kv = get_cf_kv()
        await cf_kv.put_routes(routes_map)
    except Exception as e:
        raise HTTPException(500, f"Failed to sync routes to Cloudflare: {str(e)}")


# ==================== 統計 API ====================

@app.get("/api/stats", response_model=StatsResponse)
async def get_stats():
    """獲取統計信息"""
    async with db.pool.acquire() as conn:
        total_tokens = await conn.fetchval(
            "SELECT COUNT(*) FROM tokens WHERE is_active = TRUE"
        )
        total_routes = await conn.fetchval("SELECT COUNT(*) FROM routes")
        
        recent_logs = await conn.fetch("""
            SELECT action, entity_type, details, created_at
            FROM audit_logs
            ORDER BY created_at DESC
            LIMIT 10
        """)
    
    return StatsResponse(
        total_tokens=total_tokens,
        total_routes=total_routes,
        recent_activity=[dict(log) for log in recent_logs]
    )


# ==================== 健康檢查 ====================

@app.get("/health")
async def health():
    """健康檢查端點"""
    return {
        "status": "healthy",
        "service": "token-manager",
        "version": "1.0.0"
    }


@app.get("/")
async def root():
    """根路徑"""
    return {
        "message": "Token Manager API",
        "docs": "/docs",
        "health": "/health"
    }

