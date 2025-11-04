"""
Token Manager - FastAPI 主應用
"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from datetime import datetime, timedelta
import secrets
import hashlib
import os
import base64
from dotenv import load_dotenv
from cryptography.fernet import Fernet

from models import (
    TokenCreate, TokenUpdate, TokenResponse, TokenCreateResponse,
    RouteCreate, RouteUpdate, RouteResponse, StatsResponse
)
from database import db
from cloudflare import get_cf_kv
from user_routes import router as user_router
from team_routes import router as team_router
from invite_routes import router as invite_router
from clerk_auth import verify_clerk_token, get_user_role_in_team, get_user_teams

# 加載環境變數
load_dotenv()

# 創建 FastAPI 應用
app = FastAPI(
    title="Token Manager API",
    description="API Token 集中管理系統",
    version="1.0.0"
)

# 註冊路由
app.include_router(user_router)
app.include_router(team_router)
app.include_router(invite_router)

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


def get_encryption_key() -> bytes:
    """獲取加密金鑰"""
    key = os.getenv("TOKEN_ENCRYPTION_KEY")
    if not key:
        # 如果沒有設定，生成一個臨時的（僅用於開發）
        print("⚠️ Warning: TOKEN_ENCRYPTION_KEY not set, using temporary key")
        key = Fernet.generate_key().decode()
    
    # 確保金鑰是正確的格式
    try:
        return base64.urlsafe_b64decode(key)
    except:
        # 如果不是 base64，直接使用
        return key.encode()


def encrypt_token(token: str) -> str:
    """加密 Token"""
    try:
        key = os.getenv("TOKEN_ENCRYPTION_KEY")
        if not key:
            # 生成一個臨時金鑰（開發用）
            key = Fernet.generate_key().decode()
            print(f"⚠️ 請設定 TOKEN_ENCRYPTION_KEY 環境變數，臨時金鑰: {key}")
        
        cipher = Fernet(key.encode() if isinstance(key, str) else key)
        encrypted = cipher.encrypt(token.encode())
        return base64.urlsafe_b64encode(encrypted).decode()
    except Exception as e:
        print(f"❌ Token encryption failed: {e}")
        raise


def decrypt_token(encrypted_token: str) -> str:
    """解密 Token"""
    try:
        key = os.getenv("TOKEN_ENCRYPTION_KEY")
        if not key:
            raise ValueError("TOKEN_ENCRYPTION_KEY not set")
        
        cipher = Fernet(key.encode() if isinstance(key, str) else key)
        encrypted_bytes = base64.urlsafe_b64decode(encrypted_token.encode())
        decrypted = cipher.decrypt(encrypted_bytes)
        return decrypted.decode()
    except Exception as e:
        print(f"❌ Token decryption failed: {e}")
        raise HTTPException(500, f"Failed to decrypt token: {str(e)}")


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


async def check_team_token_permission(user: dict, team_id: str, action: str):
    """
    檢查用戶在該團隊是否有權限管理 Token
    
    Args:
        user: 用戶數據（來自 verify_clerk_token）
        team_id: 團隊 ID
        action: 操作類型（create, edit, delete）
    
    Raises:
        HTTPException: 如果沒有權限
    """
    # 檢查是否是全局 ADMIN
    global_role = user.get("public_metadata", {}).get("tokenManager:globalRole")
    if global_role == "ADMIN":
        return  # 全局 ADMIN 可以做任何事
    
    # 檢查在該團隊的角色
    role = get_user_role_in_team(user, team_id)
    
    if not role:
        raise HTTPException(403, f"You are not a member of team '{team_id}'")
    
    # Token 管理權限：ADMIN, MANAGER, DEVELOPER 可以創建
    # ADMIN, MANAGER 可以編輯和刪除
    if action == "create":
        if role not in ["ADMIN", "MANAGER", "DEVELOPER"]:
            raise HTTPException(403, f"Role '{role}' cannot create tokens. Required: ADMIN, MANAGER, or DEVELOPER")
    elif action in ["edit", "delete"]:
        if role not in ["ADMIN", "MANAGER"]:
            raise HTTPException(403, f"Role '{role}' cannot {action} tokens. Required: ADMIN or MANAGER")


async def check_core_team_permission(user: dict, action: str):
    """
    檢查用戶是否有 Core Team 權限來管理路由
    
    Args:
        user: 用戶數據（來自 verify_clerk_token）
        action: 操作類型（create, edit, delete）
    
    Raises:
        HTTPException: 如果沒有權限
    """
    # 檢查是否是全局 ADMIN（全局 ADMIN 也可以管理路由）
    global_role = user.get("public_metadata", {}).get("tokenManager:globalRole")
    if global_role == "ADMIN":
        return  # 全局 ADMIN 可以做任何事
    
    # 檢查在 core-team 的角色
    role = get_user_role_in_team(user, "core-team")
    
    if not role:
        raise HTTPException(403, "需要 Core Team 權限才能管理路由")
    
    # 路由管理權限：
    # - 創建: ADMIN, MANAGER, DEVELOPER
    # - 編輯: ADMIN, MANAGER
    # - 刪除: ADMIN only
    if action == "create":
        if role not in ["ADMIN", "MANAGER", "DEVELOPER"]:
            raise HTTPException(403, f"Core Team '{role}' 角色無法創建路由。需要：ADMIN, MANAGER 或 DEVELOPER")
    elif action == "edit":
        if role not in ["ADMIN", "MANAGER"]:
            raise HTTPException(403, f"Core Team '{role}' 角色無法編輯路由。需要：ADMIN 或 MANAGER")
    elif action == "delete":
        if role != "ADMIN":
            raise HTTPException(403, f"Core Team '{role}' 角色無法刪除路由。只有 ADMIN 可以刪除")


# ==================== Token API ====================

@app.post("/api/tokens", response_model=TokenCreateResponse)
async def create_token(data: TokenCreate, request: Request):
    """創建新的 API Token"""
    try:
        # 0. 驗證用戶身份和權限
        user = await verify_clerk_token(request)
        await check_team_token_permission(user, data.team_id, "create")
        
        # 1. 生成 token
        token = generate_token()
        token_hash = hash_token(token)
        token_encrypted = encrypt_token(token)  # 加密儲存
        
        # 2. 計算過期時間
        expires_at = None
        if data.expires_days and data.expires_days > 0:
            expires_at = datetime.utcnow() + timedelta(days=data.expires_days)
        # 如果 expires_days 是 None 或 0，則永不過期（expires_at = None）
        
        # 3. 存入資料庫（同時儲存 hash 和加密的明文）
        async with db.pool.acquire() as conn:
            token_id = await conn.fetchval("""
                INSERT INTO tokens (token_hash, token_encrypted, name, team_id, created_by, description, scopes, expires_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
            """, token_hash, token_encrypted, data.name, data.team_id, user["id"], data.description, data.scopes, expires_at)
        
        # 4. 同步到 Cloudflare KV
        try:
            cf_kv = get_cf_kv()
            await cf_kv.put_token(token_hash, {
                "name": data.name,
                "team_id": data.team_id,
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
        await log_audit("create", "token", token_id, {
            "name": data.name,
            "team_id": data.team_id,
            "created_by": user["id"]
        })
        
        # 6. 返回 token (只此一次!)
        return TokenCreateResponse(
            id=token_id,
            token=token,
            name=data.name,
            team_id=data.team_id,
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
async def list_tokens(request: Request):
    """列出所有活躍的 tokens (不包含實際 token 值)"""
    # 驗證用戶身份
    user = await verify_clerk_token(request)
    
    # 檢查是否是全局 ADMIN
    global_role = user.get("public_metadata", {}).get("tokenManager:globalRole")
    
    async with db.pool.acquire() as conn:
        if global_role == "ADMIN":
            # 全局 ADMIN 可以看到所有 Token
            rows = await conn.fetch("""
                SELECT id, name, team_id, created_by, description, token_encrypted, scopes, created_at, expires_at, last_used
                FROM tokens
                WHERE is_active = TRUE
                ORDER BY created_at DESC
            """)
        else:
            # 普通用戶只能看到自己所屬團隊的 Token
            user_teams = get_user_teams(user)
            if not user_teams:
                return []  # 用戶不屬於任何團隊
            
            rows = await conn.fetch("""
                SELECT id, name, team_id, created_by, description, token_encrypted, scopes, created_at, expires_at, last_used
                FROM tokens
                WHERE is_active = TRUE AND team_id = ANY($1)
                ORDER BY created_at DESC
            """, user_teams)
    
    # 為每個 Token 生成預覽字串
    tokens = []
    for row in rows:
        token_dict = dict(row)
        
        # 生成 token_preview (如果有加密的 Token)
        if token_dict.get('token_encrypted'):
            try:
                full_token = decrypt_token(token_dict['token_encrypted'])
                # 顯示格式: ntk_abc...xyz (前8個字符 + ... + 後4個字符)
                if len(full_token) > 16:
                    token_dict['token_preview'] = f"{full_token[:12]}...{full_token[-6:]}"
                else:
                    token_dict['token_preview'] = full_token
            except:
                token_dict['token_preview'] = "ntk_***...***"
        else:
            token_dict['token_preview'] = "***舊版Token***"
        
        # 移除 token_encrypted（不要傳給前端）
        token_dict.pop('token_encrypted', None)
        tokens.append(TokenResponse(**token_dict))
    
    return tokens


@app.put("/api/tokens/{token_id}", response_model=TokenResponse)
async def update_token(token_id: int, data: TokenUpdate, request: Request):
    """更新 Token (名稱、權限)"""
    # 驗證用戶身份
    user = await verify_clerk_token(request)
    
    async with db.pool.acquire() as conn:
        # 獲取現有 Token
        token = await conn.fetchrow("SELECT * FROM tokens WHERE id = $1 AND is_active = TRUE", token_id)
        if not token:
            raise HTTPException(404, "Token not found")
        
        # 檢查權限
        await check_team_token_permission(user, token['team_id'], "edit")
        
        # 構建更新語句
        updates = []
        params = []
        param_count = 1
        
        if data.name is not None:
            updates.append(f"name = ${param_count}")
            params.append(data.name)
            param_count += 1
        
        if data.description is not None:
            updates.append(f"description = ${param_count}")
            params.append(data.description)
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
                "team_id": updated_token['team_id'],
                "scopes": updated_token['scopes'],
                "created_at": updated_token['created_at'].isoformat(),
                "expires_at": updated_token['expires_at'].isoformat() if updated_token['expires_at'] else None
            })
        except Exception as e:
            print(f"Warning: Failed to update token in KV: {e}")
    
    # 審計日誌
    await log_audit("update", "token", token_id, {
        "name": data.name,
        "scopes": data.scopes,
        "updated_by": user["id"]
    })
    
    return TokenResponse(**dict(updated_token))


@app.get("/api/tokens/{token_id}/reveal")
async def reveal_token(token_id: int, request: Request):
    """解密並返回 Token 明文 - 需要該團隊權限"""
    # 驗證用戶身份
    user = await verify_clerk_token(request)
    
    # 獲取 Token 並檢查權限
    async with db.pool.acquire() as conn:
        token_row = await conn.fetchrow("""
            SELECT token_encrypted, team_id FROM tokens 
            WHERE id = $1 AND is_active = TRUE
        """, token_id)
        
        if not token_row:
            raise HTTPException(404, "Token not found")
        
        if not token_row['token_encrypted']:
            raise HTTPException(400, "此 Token 無法解密（舊版本 Token）")
        
        # 檢查權限（團隊成員才能查看）
        global_role = user.get("public_metadata", {}).get("tokenManager:globalRole")
        if global_role != "ADMIN":
            role = get_user_role_in_team(user, token_row['team_id'])
            if not role:
                raise HTTPException(403, "You are not a member of this team")
    
    # 解密並返回
    try:
        decrypted_token = decrypt_token(token_row['token_encrypted'])
        return {"token": decrypted_token}
    except Exception as e:
        raise HTTPException(500, f"Failed to decrypt token: {str(e)}")


@app.delete("/api/tokens/{token_id}")
async def delete_token(token_id: int, request: Request):
    """撤銷 (刪除) token"""
    # 驗證用戶身份
    user = await verify_clerk_token(request)
    
    # 1. 獲取 token 並檢查權限
    async with db.pool.acquire() as conn:
        token = await conn.fetchrow("""
            SELECT token_hash, name, team_id FROM tokens WHERE id = $1
        """, token_id)
        
        if not token:
            raise HTTPException(404, "Token not found")
        
        # 檢查權限
        await check_team_token_permission(user, token['team_id'], "delete")
        
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
    await log_audit("delete", "token", token_id, {
        "name": token['name'],
        "team_id": token['team_id'],
        "deleted_by": user["id"]
    })
    
    return {"status": "deleted"}


# ==================== Route API ====================

@app.post("/api/routes", response_model=RouteResponse)
async def create_route(data: RouteCreate, request: Request):
    """新增微服務路由 - 需要 Core Team 權限"""
    # 驗證用戶身份和權限
    user = await verify_clerk_token(request)
    await check_core_team_permission(user, "create")
    
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
async def list_routes(request: Request):
    """列出所有路由 - 所有已登入用戶都可以查看"""
    # 驗證用戶身份（但不檢查特定權限，所有人都可以查看）
    user = await verify_clerk_token(request)
    
    async with db.pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, name, path, backend_url, description, tags, created_at
            FROM routes
            ORDER BY created_at DESC
        """)
    
    return [RouteResponse(**dict(row)) for row in rows]


@app.put("/api/routes/{route_id}", response_model=RouteResponse)
async def update_route(route_id: int, data: RouteUpdate, request: Request):
    """修改路由 - 需要 Core Team ADMIN 或 MANAGER 權限"""
    # 驗證用戶身份和權限
    user = await verify_clerk_token(request)
    await check_core_team_permission(user, "edit")
    
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
async def list_tags(request: Request):
    """列出所有可用的 tags - 所有已登入用戶都可以查看"""
    # 驗證用戶身份
    user = await verify_clerk_token(request)
    
    async with db.pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT DISTINCT unnest(tags) as tag
            FROM routes
            WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
            ORDER BY tag
        """)
    
    return {"tags": [row['tag'] for row in rows]}


@app.delete("/api/routes/{route_id}")
async def delete_route(route_id: int, request: Request):
    """刪除路由 - 需要 Core Team ADMIN 權限"""
    # 驗證用戶身份和權限
    user = await verify_clerk_token(request)
    await check_core_team_permission(user, "delete")
    
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

