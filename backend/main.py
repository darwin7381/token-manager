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
import json
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
    
    # 生成 token_preview
    token_dict = dict(updated_token)
    if token_dict.get('token_encrypted'):
        try:
            full_token = decrypt_token(token_dict['token_encrypted'])
            if len(full_token) > 16:
                token_dict['token_preview'] = f"{full_token[:12]}...{full_token[-6:]}"
            else:
                token_dict['token_preview'] = full_token
        except:
            token_dict['token_preview'] = "ntk_***...***"
    else:
        token_dict['token_preview'] = "***舊版Token***"
    
    return TokenResponse(**token_dict)


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
    
    # 0. 如果有實際密鑰，先儲存到 Cloudflare KV
    if data.backend_auth_secrets:
        try:
            cf_kv = get_cf_kv()
            for secret_name, secret_value in data.backend_auth_secrets.items():
                await cf_kv.put_secret(secret_name, secret_value)
                print(f"✅ Stored secret {secret_name} to Cloudflare KV")
        except Exception as e:
            raise HTTPException(500, f"Failed to store secrets to Cloudflare: {str(e)}")
    
    # 1. 存入資料庫（只儲存配置，不儲存實際密鑰）
    async with db.pool.acquire() as conn:
        try:
            route_id = await conn.fetchval("""
                INSERT INTO routes (name, path, backend_url, description, tags, backend_auth_type, backend_auth_config)
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
                RETURNING id
            """, data.name, data.path, data.backend_url, data.description, data.tags or [], 
                data.backend_auth_type or 'none', 
                json.dumps(data.backend_auth_config) if data.backend_auth_config else None)
            
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
    
    # 確保返回時 backend_auth_config 是 dict（Pydantic 期望 dict）
    auth_config_for_response = data.backend_auth_config
    if auth_config_for_response and isinstance(auth_config_for_response, str):
        try:
            auth_config_for_response = json.loads(auth_config_for_response)
        except:
            auth_config_for_response = None
    
    return RouteResponse(
        id=route_id,
        name=data.name,
        path=data.path,
        backend_url=data.backend_url,
        description=data.description,
        tags=data.tags or [],
        backend_auth_type=data.backend_auth_type or 'none',
        backend_auth_config=auth_config_for_response,
        created_at=created_at
    )


@app.get("/api/routes", response_model=List[RouteResponse])
async def list_routes(request: Request):
    """列出所有路由 - 所有已登入用戶都可以查看"""
    try:
        # 驗證用戶身份（但不檢查特定權限，所有人都可以查看）
        user = await verify_clerk_token(request)
        
        async with db.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT id, name, path, backend_url, description, tags, 
                       backend_auth_type, backend_auth_config, created_at
                FROM routes
                ORDER BY created_at DESC
            """)
        
            # 處理 JSONB 類型的 backend_auth_config
            routes = []
            for row in rows:
                route_dict = dict(row)
                
                # 強制確保 backend_auth_config 是 dict 或 None
                auth_config = route_dict.get('backend_auth_config')
                if auth_config:
                    if isinstance(auth_config, str):
                        # 如果是字串，解析為 dict
                        try:
                            route_dict['backend_auth_config'] = json.loads(auth_config)
                        except:
                            route_dict['backend_auth_config'] = None
                    elif not isinstance(auth_config, dict):
                        # 如果不是 dict 也不是字串，設為 None
                        route_dict['backend_auth_config'] = None
                else:
                    route_dict['backend_auth_config'] = None
                
                routes.append(RouteResponse(**route_dict))
            
            return routes
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"❌ Error in list_routes: {e}")
        print(traceback.format_exc())
        raise HTTPException(500, f"Failed to list routes: {str(e)}")


@app.put("/api/routes/{route_id}", response_model=RouteResponse)
async def update_route(route_id: int, data: RouteUpdate, request: Request):
    """修改路由 - 需要 Core Team ADMIN 或 MANAGER 權限"""
    # 驗證用戶身份和權限
    user = await verify_clerk_token(request)
    await check_core_team_permission(user, "edit")
    
    # 如果有更新實際密鑰，先儲存到 Cloudflare KV
    if data.backend_auth_secrets:
        try:
            cf_kv = get_cf_kv()
            for secret_name, secret_value in data.backend_auth_secrets.items():
                await cf_kv.put_secret(secret_name, secret_value)
                print(f"✅ Updated secret {secret_name} in Cloudflare KV")
        except Exception as e:
            print(f"Warning: Failed to update secrets: {e}")
    
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
        
        if data.backend_auth_type is not None:
            updates.append(f"backend_auth_type = ${param_count}")
            params.append(data.backend_auth_type)
            param_count += 1
        
        if data.backend_auth_config is not None:
            updates.append(f"backend_auth_config = ${param_count}::jsonb")
            params.append(json.dumps(data.backend_auth_config) if data.backend_auth_config else None)
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
    
    # 處理 backend_auth_config（如果是字串則解析為 dict）
    route_dict = dict(route)
    if route_dict.get('backend_auth_config'):
        if isinstance(route_dict['backend_auth_config'], str):
            try:
                route_dict['backend_auth_config'] = json.loads(route_dict['backend_auth_config'])
            except:
                route_dict['backend_auth_config'] = None
    
    return RouteResponse(**route_dict)


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
    """同步所有路由到 Cloudflare KV (包含 tags 和後端認證信息)"""
    async with db.pool.acquire() as conn:
        routes = await conn.fetch("""
            SELECT path, backend_url, tags, backend_auth_type, backend_auth_config 
            FROM routes
        """)
    
    # 格式: {path: {url, tags, auth}}
    routes_map = {}
    for route in routes:
        route_config = {
            'url': route['backend_url'],
            'tags': route['tags'] or []
        }
        
        # 添加後端認證配置
        if route['backend_auth_type'] and route['backend_auth_type'] != 'none':
            auth_config = route['backend_auth_config']
            
            # 確保 auth_config 是 dict
            if isinstance(auth_config, str):
                try:
                    auth_config = json.loads(auth_config)
                except:
                    auth_config = {}
            
            route_config['auth'] = {
                'type': route['backend_auth_type'],
                'config': auth_config or {}
            }
        
        routes_map[route['path']] = route_config
    
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


@app.get("/api/dashboard/overview")
async def get_dashboard_overview(request: Request):
    """
    獲取 Dashboard 概覽數據
    包含：總數統計、團隊分佈、時間趨勢
    """
    user = await verify_clerk_token(request)
    
    async with db.pool.acquire() as conn:
        # 1. 基礎統計
        total_tokens = await conn.fetchval(
            "SELECT COUNT(*) FROM tokens WHERE is_active = TRUE"
        )
        total_routes = await conn.fetchval("SELECT COUNT(*) FROM routes")
        total_teams = await conn.fetchval("SELECT COUNT(*) FROM teams")
        
        # 2. 按團隊分組的 Token 統計
        tokens_by_team = await conn.fetch("""
            SELECT team_id, COUNT(*) as count
            FROM tokens
            WHERE is_active = TRUE AND team_id IS NOT NULL
            GROUP BY team_id
            ORDER BY count DESC
        """)
        
        # 3. 最近 7 天的 Token 創建趨勢
        token_trend = await conn.fetch("""
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count
            FROM tokens
            WHERE created_at >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        """)
        
        # 4. 最近 10 條審計日誌
        recent_logs = await conn.fetch("""
            SELECT action, entity_type, entity_id, details, created_at
            FROM audit_logs
            ORDER BY created_at DESC
            LIMIT 10
        """)
        
        # 5. 即將過期的 Token（30 天內）
        expiring_soon = await conn.fetch("""
            SELECT id, name, team_id, expires_at
            FROM tokens
            WHERE is_active = TRUE 
                AND expires_at IS NOT NULL
                AND expires_at <= NOW() + INTERVAL '30 days'
                AND expires_at > NOW()
            ORDER BY expires_at ASC
            LIMIT 5
        """)
    
    # 獲取團隊名稱映射
    async with db.pool.acquire() as conn:
        teams_data = await conn.fetch("SELECT id, name FROM teams")
        team_names = {team['id']: team['name'] for team in teams_data}
    
    # 處理團隊統計（添加團隊名稱）
    tokens_by_team_with_names = [
        {
            "team_id": row['team_id'],
            "team_name": team_names.get(row['team_id'], row['team_id']),
            "count": row['count']
        }
        for row in tokens_by_team
    ]
    
    return {
        "overview": {
            "total_tokens": total_tokens,
            "total_routes": total_routes,
            "total_teams": total_teams,
        },
        "tokens_by_team": tokens_by_team_with_names,
        "token_trend": [
            {
                "date": row['date'].isoformat(),
                "count": row['count']
            }
            for row in token_trend
        ],
        "recent_logs": [dict(log) for log in recent_logs],
        "expiring_soon": [
            {
                "id": row['id'],
                "name": row['name'],
                "team_id": row['team_id'],
                "team_name": team_names.get(row['team_id'], row['team_id']),
                "expires_at": row['expires_at'].isoformat()
            }
            for row in expiring_soon
        ]
    }


@app.get("/api/dashboard/audit-logs")
async def get_audit_logs(
    request: Request,
    limit: int = 50,
    offset: int = 0,
    action: str = None,
    entity_type: str = None
):
    """
    獲取審計日誌（帶分頁和篩選）
    """
    user = await verify_clerk_token(request)
    
    # 構建查詢條件
    conditions = []
    params = []
    param_count = 1
    
    if action:
        conditions.append(f"action = ${param_count}")
        params.append(action)
        param_count += 1
    
    if entity_type:
        conditions.append(f"entity_type = ${param_count}")
        params.append(entity_type)
        param_count += 1
    
    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)
    
    async with db.pool.acquire() as conn:
        # 獲取總數
        count_query = f"SELECT COUNT(*) FROM audit_logs {where_clause}"
        total = await conn.fetchval(count_query, *params)
        
        # 獲取數據
        params.extend([limit, offset])
        data_query = f"""
            SELECT id, action, entity_type, entity_id, details, created_at
            FROM audit_logs
            {where_clause}
            ORDER BY created_at DESC
            LIMIT ${param_count} OFFSET ${param_count + 1}
        """
        logs = await conn.fetch(data_query, *params)
    
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "data": [dict(log) for log in logs]
    }


# ==================== 健康檢查 ====================

@app.get("/health")
async def health():
    """
    健康檢查端點（簡易版）
    用於 k8s liveness probe 等場景
    """
    return {
        "status": "healthy",
        "service": "token-manager",
        "version": "1.0.0"
    }


@app.get("/health/detailed")
async def health_detailed():
    """
    詳細健康檢查
    檢查數據庫連接、Cloudflare KV 連接等
    """
    health_status = {
        "status": "healthy",
        "service": "token-manager",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "checks": {}
    }
    
    # 1. 檢查數據庫連接
    try:
        async with db.pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        health_status["checks"]["database"] = {
            "status": "healthy",
            "message": "Database connection successful"
        }
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["checks"]["database"] = {
            "status": "unhealthy",
            "message": f"Database connection failed: {str(e)}"
        }
    
    # 2. 檢查 Cloudflare KV（如果已配置）
    try:
        cf_kv = get_cf_kv()
        if not cf_kv.is_dummy:
            # 嘗試讀取一個測試 key
            import httpx
            url = f"{cf_kv.base_url}/values/health-check"
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    url,
                    headers=cf_kv.headers,
                    timeout=5.0
                )
            health_status["checks"]["cloudflare_kv"] = {
                "status": "healthy",
                "message": "Cloudflare KV connection successful"
            }
        else:
            health_status["checks"]["cloudflare_kv"] = {
                "status": "skipped",
                "message": "Using dummy credentials (development mode)"
            }
    except Exception as e:
        health_status["checks"]["cloudflare_kv"] = {
            "status": "warning",
            "message": f"Cloudflare KV check failed: {str(e)}"
        }
    
    # 3. 檢查 Clerk 連接
    try:
        from clerk_auth import clerk_client
        # 嘗試獲取用戶計數（limit 1 不會消耗太多資源）
        users_response = clerk_client.users.list(request={"limit": 1})
        health_status["checks"]["clerk"] = {
            "status": "healthy",
            "message": "Clerk API connection successful"
        }
    except Exception as e:
        health_status["checks"]["clerk"] = {
            "status": "warning",
            "message": f"Clerk API check failed: {str(e)}"
        }
    
    return health_status


@app.post("/api/usage-log")
async def log_token_usage(request: Request):
    """
    記錄 Token 使用情況（由 Cloudflare Worker 調用）
    不需要認證，因為是內部調用
    """
    try:
        data = await request.json()
        token_hash = data.get('token_hash')
        route_path = data.get('route')
        timestamp = data.get('timestamp')
        response_status = data.get('response_status')
        response_time_ms = data.get('response_time_ms')
        ip_address = data.get('ip_address')
        user_agent = data.get('user_agent')
        request_method = data.get('request_method')
        error_message = data.get('error_message')
        
        if not token_hash:
            raise HTTPException(400, "token_hash is required")
        
        async with db.pool.acquire() as conn:
            # 1. 更新 Token 的 last_used 時間
            await conn.execute("""
                UPDATE tokens 
                SET last_used = NOW()
                WHERE token_hash = $1
            """, token_hash)
            
            # 2. 記錄詳細使用日誌
            await conn.execute("""
                INSERT INTO token_usage_logs (
                    token_hash, route_path, used_at, response_status, 
                    response_time_ms, ip_address, user_agent, request_method, error_message
                )
                VALUES ($1, $2, to_timestamp($3::double precision / 1000), $4, $5, $6, $7, $8, $9)
            """, token_hash, route_path, timestamp, response_status, 
                response_time_ms, ip_address, user_agent, request_method, error_message)
        
        return {"status": "logged"}
    except Exception as e:
        # 記錄錯誤但不影響 Worker 的正常運作
        print(f"Warning: Failed to log token usage: {e}")
        import traceback
        print(traceback.format_exc())
        return {"status": "error", "message": str(e)}


@app.get("/api/usage/stats")
async def get_usage_stats(request: Request):
    """
    獲取整體使用統計
    """
    user = await verify_clerk_token(request)
    
    async with db.pool.acquire() as conn:
        # 1. 總體統計
        total_calls = await conn.fetchval("SELECT COUNT(*) FROM token_usage_logs")
        total_errors = await conn.fetchval("SELECT COUNT(*) FROM token_usage_logs WHERE response_status >= 400")
        avg_response_time = await conn.fetchval("SELECT AVG(response_time_ms) FROM token_usage_logs WHERE response_time_ms IS NOT NULL")
        
        # 2. 最近 24 小時的調用趨勢
        hourly_usage = await conn.fetch("""
            SELECT 
                DATE_TRUNC('hour', used_at) as hour,
                COUNT(*) as call_count,
                AVG(response_time_ms) as avg_response_time
            FROM token_usage_logs
            WHERE used_at >= NOW() - INTERVAL '24 hours'
            GROUP BY hour
            ORDER BY hour DESC
        """)
        
        # 3. Top 10 最常使用的 Token
        top_tokens = await conn.fetch("""
            SELECT 
                t.id,
                t.token_hash,
                t.name,
                t.team_id,
                COUNT(ul.id) as usage_count,
                MAX(ul.used_at) as last_used
            FROM tokens t
            INNER JOIN token_usage_logs ul ON t.token_hash = ul.token_hash AND ul.used_at >= NOW() - INTERVAL '7 days'
            GROUP BY t.id, t.token_hash, t.name, t.team_id
            ORDER BY usage_count DESC
            LIMIT 10
        """)
        
        # 4. Top 10 最常訪問的路由（JOIN routes 獲取名稱）
        top_routes = await conn.fetch("""
            SELECT 
                ul.route_path,
                r.name as route_name,
                r.id as route_id,
                COUNT(*) as call_count,
                AVG(ul.response_time_ms) as avg_response_time,
                COUNT(CASE WHEN ul.response_status >= 400 THEN 1 END) as error_count
            FROM token_usage_logs ul
            LEFT JOIN routes r ON ul.route_path = r.path
            WHERE ul.used_at >= NOW() - INTERVAL '7 days'
            GROUP BY ul.route_path, r.name, r.id
            ORDER BY call_count DESC
            LIMIT 10
        """)
    
        # 5. 最近 100 條調用記錄（JOIN tokens 獲取名稱）
        recent_logs = await conn.fetch("""
            SELECT 
                ul.token_hash,
                t.id as token_id,
                t.name as token_name,
                ul.route_path,
                ul.request_method,
                ul.response_status,
                ul.response_time_ms,
                ul.ip_address,
                ul.used_at
            FROM token_usage_logs ul
            LEFT JOIN tokens t ON ul.token_hash = t.token_hash
            ORDER BY ul.used_at DESC
            LIMIT 100
        """)
    
    return {
        "overview": {
            "total_calls": total_calls,
            "total_errors": total_errors,
            "avg_response_time": float(avg_response_time) if avg_response_time else 0,
            "success_rate": ((total_calls - total_errors) / total_calls * 100) if total_calls > 0 else 0
        },
        "hourly_usage": [
            {
                "hour": row['hour'].isoformat(),
                "call_count": row['call_count'],
                "avg_response_time": float(row['avg_response_time']) if row['avg_response_time'] else 0
            }
            for row in hourly_usage
        ],
        "top_tokens": [
            {
                "id": row['id'],
                "name": row['name'],
                "team_id": row['team_id'],
                "usage_count": row['usage_count'],
                "last_used": row['last_used'].isoformat() if row['last_used'] else None
            }
            for row in top_tokens
        ],
        "top_routes": [
            {
                "route_path": row['route_path'],
                "route_name": row['route_name'] or row['route_path'],
                "route_id": row['route_id'],
                "call_count": row['call_count'],
                "avg_response_time": float(row['avg_response_time']) if row['avg_response_time'] else 0,
                "error_count": row['error_count'],
                "success_rate": ((row['call_count'] - row['error_count']) / row['call_count'] * 100) if row['call_count'] > 0 else 0
            }
            for row in top_routes
        ],
        "recent_logs": [
            {
                "token_hash": row['token_hash'],
                "token_id": row['token_id'],
                "token_name": row['token_name'],
                "route_path": row['route_path'],
                "request_method": row['request_method'],
                "response_status": row['response_status'],
                "response_time_ms": row['response_time_ms'],
                "ip_address": row['ip_address'],
                "used_at": row['used_at'].isoformat() if row['used_at'] else None
            }
            for row in recent_logs
        ]
    }


@app.get("/api/usage/token/{token_id}")
async def get_token_usage(token_id: int, request: Request, limit: int = 50):
    """
    獲取特定 Token 的使用記錄
    """
    user = await verify_clerk_token(request)
    
    async with db.pool.acquire() as conn:
        # 獲取 Token 資訊
        token = await conn.fetchrow("SELECT * FROM tokens WHERE id = $1", token_id)
        if not token:
            raise HTTPException(404, "Token not found")
        
        # 檢查權限
        await check_team_token_permission(user, token['team_id'], "edit")
        
        # 獲取使用記錄（JOIN routes 獲取名稱）
        usage_logs = await conn.fetch("""
            SELECT 
                ul.*,
                r.name as route_name,
                r.id as route_id
            FROM token_usage_logs ul
            LEFT JOIN routes r ON ul.route_path = r.path
            WHERE ul.token_hash = $1
            ORDER BY ul.used_at DESC
            LIMIT $2
        """, token['token_hash'], limit)
        
        # 統計數據
        stats = await conn.fetchrow("""
            SELECT 
                COUNT(*) as total_calls,
                COUNT(CASE WHEN response_status >= 400 THEN 1 END) as error_count,
                AVG(response_time_ms) as avg_response_time,
                MIN(used_at) as first_used,
                MAX(used_at) as last_used
            FROM token_usage_logs
            WHERE token_hash = $1
        """, token['token_hash'])
    
    # 獲取路由分佈（帶名稱）
    async with db.pool.acquire() as conn:
        route_distribution = await conn.fetch("""
            SELECT 
                r.id as route_id,
                r.name as route_name,
                r.path as route_path,
                COUNT(*) as count
            FROM token_usage_logs ul
            LEFT JOIN routes r ON ul.route_path = r.path
            WHERE ul.token_hash = $1
            GROUP BY r.id, r.name, r.path
            ORDER BY count DESC
        """, token['token_hash'])
    
    return {
        "token": {
            "id": token['id'],
            "name": token['name'],
            "team_id": token['team_id']
        },
        "stats": dict(stats) if stats else {},
        "recent_usage": [dict(log) for log in usage_logs],
        "route_distribution": [dict(d) for d in route_distribution]
    }


@app.get("/api/usage/route")
async def get_route_usage(request: Request, route_path: str = None, limit: int = 50):
    """
    獲取路由的使用記錄
    """
    user = await verify_clerk_token(request)
    
    async with db.pool.acquire() as conn:
        if route_path:
            # 特定路由的使用記錄（JOIN tokens 獲取名稱）
            usage_logs = await conn.fetch("""
                SELECT 
                    ul.*,
                    t.name as token_name,
                    t.id as token_id
                FROM token_usage_logs ul
                LEFT JOIN tokens t ON ul.token_hash = t.token_hash
                WHERE ul.route_path = $1
                ORDER BY ul.used_at DESC
                LIMIT $2
            """, route_path, limit)
            
            stats = await conn.fetchrow("""
                SELECT 
                    COUNT(*) as total_calls,
                    COUNT(CASE WHEN response_status >= 400 THEN 1 END) as error_count,
                    AVG(response_time_ms) as avg_response_time
                FROM token_usage_logs
                WHERE route_path = $1
            """, route_path)
            
            # 獲取 Token 分佈（帶名稱）
            token_distribution = await conn.fetch("""
                SELECT 
                    t.id as token_id,
                    t.name as token_name,
                    COUNT(*) as count
                FROM token_usage_logs ul
                LEFT JOIN tokens t ON ul.token_hash = t.token_hash
                WHERE ul.route_path = $1
                GROUP BY t.id, t.name
                ORDER BY count DESC
                LIMIT 5
            """, route_path)
        else:
            # 所有路由的統計
            usage_logs = await conn.fetch("""
                SELECT 
                    route_path,
                    COUNT(*) as call_count,
                    AVG(response_time_ms) as avg_response_time,
                    MAX(used_at) as last_used
                FROM token_usage_logs
                GROUP BY route_path
                ORDER BY call_count DESC
                LIMIT $1
            """, limit)
            stats = None
            token_distribution = None
    
    result = {
        "stats": dict(stats) if stats else None,
        "usage_logs": [dict(log) for log in usage_logs]
    }
    
    if route_path and token_distribution:
        result["token_distribution"] = [dict(d) for d in token_distribution]
    
    return result


@app.get("/api/usage/test-data")
async def get_test_usage_data():
    """
    測試用：查看最近的使用記錄（不需要認證）
    生產環境應該移除此 endpoint
    """
    async with db.pool.acquire() as conn:
        logs = await conn.fetch("""
            SELECT token_hash, route_path, request_method, response_status, 
                   response_time_ms, ip_address, used_at
            FROM token_usage_logs
            ORDER BY used_at DESC
            LIMIT 10
        """)
    
    return {
        "count": len(logs),
        "logs": [dict(log) for log in logs]
    }


@app.get("/api/test/get-real-data")
async def get_real_token_and_routes():
    """
    測試用：獲取真實的 Token hash 和路由（不需要認證）
    用於生成測試數據
    """
    async with db.pool.acquire() as conn:
        tokens = await conn.fetch("""
            SELECT id, token_hash, name, team_id
            FROM tokens
            WHERE is_active = TRUE
            ORDER BY id
            LIMIT 10
        """)
        
        routes = await conn.fetch("""
            SELECT id, path, name
            FROM routes
            ORDER BY id
        """)
    
    return {
        "tokens": [
            {
                "id": t['id'],
                "hash": t['token_hash'],
                "name": t['name'],
                "team_id": t['team_id']
            }
            for t in tokens
        ],
        "routes": [
            {
                "id": r['id'],
                "path": r['path'],
                "name": r['name']
            }
            for r in routes
        ]
    }


@app.get("/")
async def root():
    """根路徑"""
    return {
        "message": "Token Manager API",
        "docs": "/docs",
        "health": "/health"
    }

