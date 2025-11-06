"""
數據庫連接和初始化模塊
"""
import asyncpg
import os
from typing import Optional


class Database:
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
    
    async def connect(self):
        """創建數據庫連接池"""
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            raise ValueError("DATABASE_URL environment variable is not set")
        
        self.pool = await asyncpg.create_pool(
            database_url,
            min_size=2,
            max_size=10,
            command_timeout=60
        )
        
        # 初始化數據表
        await self.init_tables()
    
    async def disconnect(self):
        """關閉數據庫連接池"""
        if self.pool:
            await self.pool.close()
    
    async def init_tables(self):
        """初始化所有數據表"""
        async with self.pool.acquire() as conn:
            # Tokens 表
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS tokens (
                    id SERIAL PRIMARY KEY,
                    token_hash VARCHAR(64) NOT NULL UNIQUE,
                    token_encrypted TEXT,
                    name VARCHAR(255) NOT NULL,
                    team_id VARCHAR(50),
                    created_by VARCHAR(100),
                    description TEXT,
                    scopes TEXT[] NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    expires_at TIMESTAMP,
                    last_used TIMESTAMP,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE
                )
            """)
            
            # 遷移：如果 tokens 表已存在但沒有新欄位，則添加
            # 檢查 team_id 欄位是否存在
            column_exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='tokens' AND column_name='team_id'
                )
            """)
            
            if not column_exists:
                print("🔄 Migrating tokens table: adding team_id and created_by columns...")
                await conn.execute("""
                    ALTER TABLE tokens 
                    ADD COLUMN IF NOT EXISTS team_id VARCHAR(50),
                    ADD COLUMN IF NOT EXISTS created_by VARCHAR(100)
                """)
                print("✅ Tokens table migration completed")
            
            # 檢查是否還有 department 欄位（舊欄位）
            dept_exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='tokens' AND column_name='department'
                )
            """)
            
            if dept_exists:
                print("🔄 Removing deprecated 'department' column from tokens table...")
                await conn.execute("""
                    ALTER TABLE tokens DROP COLUMN IF EXISTS department
                """)
                print("✅ Deprecated column removed")
            
            # 檢查 description 欄位是否存在
            desc_exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='tokens' AND column_name='description'
                )
            """)
            
            if not desc_exists:
                print("🔄 Adding description column to tokens table...")
                await conn.execute("""
                    ALTER TABLE tokens ADD COLUMN IF NOT EXISTS description TEXT
                """)
                print("✅ Description column added")
            
            # 檢查 token_encrypted 欄位是否存在
            encrypted_exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='tokens' AND column_name='token_encrypted'
                )
            """)
            
            if not encrypted_exists:
                print("🔄 Adding token_encrypted column to tokens table...")
                await conn.execute("""
                    ALTER TABLE tokens ADD COLUMN IF NOT EXISTS token_encrypted TEXT
                """)
                print("✅ Token encryption support added")
            
            # 添加外鍵約束（如果 teams 表已存在）
            fk_exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints 
                    WHERE constraint_name='tokens_team_id_fkey' AND table_name='tokens'
                )
            """)
            
            if not fk_exists:
                # 檢查 teams 表是否存在
                teams_exists = await conn.fetchval("""
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables 
                        WHERE table_name='teams'
                    )
                """)
                
                if teams_exists:
                    await conn.execute("""
                        ALTER TABLE tokens 
                        ADD CONSTRAINT tokens_team_id_fkey 
                        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
                    """)
                    print("✅ Foreign key constraint added to tokens table")
            
            # 創建索引
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_tokens_hash 
                ON tokens(token_hash)
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_tokens_active 
                ON tokens(is_active)
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_tokens_team_id 
                ON tokens(team_id)
            """)
            
            # Routes 表
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS routes (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255),
                    path VARCHAR(255) NOT NULL UNIQUE,
                    backend_url TEXT NOT NULL,
                    description TEXT,
                    tags TEXT[] DEFAULT '{}',
                    backend_auth_type VARCHAR(50) DEFAULT 'none',
                    backend_auth_config JSONB,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_routes_path 
                ON routes(path)
            """)
            
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_routes_tags 
                ON routes USING GIN(tags)
            """)
            
            # 檢查並添加後端認證欄位
            auth_type_exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='routes' AND column_name='backend_auth_type'
                )
            """)
            
            if not auth_type_exists:
                print("🔄 Adding backend authentication columns to routes table...")
                await conn.execute("""
                    ALTER TABLE routes 
                    ADD COLUMN IF NOT EXISTS backend_auth_type VARCHAR(50) DEFAULT 'none',
                    ADD COLUMN IF NOT EXISTS backend_auth_config JSONB
                """)
                print("✅ Backend authentication support added to routes")
            
            # Token 使用記錄表（詳細記錄每次調用）
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS token_usage_logs (
                    id SERIAL PRIMARY KEY,
                    token_hash VARCHAR(64) NOT NULL,
                    route_path VARCHAR(255),
                    used_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    response_status INTEGER,
                    response_time_ms INTEGER,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    request_method VARCHAR(10),
                    error_message TEXT
                )
            """)
            
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_usage_token_hash 
                ON token_usage_logs(token_hash)
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_usage_used_at 
                ON token_usage_logs(used_at DESC)
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_usage_route 
                ON token_usage_logs(route_path)
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_usage_composite
                ON token_usage_logs(token_hash, used_at DESC)
            """)
            
            print("✅ Token usage logs table initialized")
            
            # Audit Logs 表
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id SERIAL PRIMARY KEY,
                    action VARCHAR(50) NOT NULL,
                    entity_type VARCHAR(50) NOT NULL,
                    entity_id INTEGER,
                    details JSONB,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_audit_logs_created 
                ON audit_logs(created_at DESC)
            """)
            
            # Teams 表
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS teams (
                    id VARCHAR(50) PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    description TEXT,
                    color VARCHAR(7) NOT NULL DEFAULT '#3b82f6',
                    icon VARCHAR(10),
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    created_by VARCHAR(100),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_teams_created 
                ON teams(created_at DESC)
            """)
            
            # 初始化系統必需的團隊
            await self.init_system_teams(conn)
    
    async def init_system_teams(self, conn):
        """
        初始化系統必需的團隊
        
        Core Team: 負責管理核心基礎設施（路由、系統設定等）
        """
        # 檢查 core-team 是否存在
        core_team_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1 FROM teams WHERE id = 'core-team'
            )
        """)
        
        if not core_team_exists:
            print("🔄 Creating system team: core-team...")
            await conn.execute("""
                INSERT INTO teams (id, name, description, color, icon, created_by)
                VALUES ($1, $2, $3, $4, $5, $6)
            """, 
                'core-team',
                'Core Team',
                '核心基礎設施團隊 - 負責管理路由、系統設定等核心功能',
                '#8b5cf6',  # 紫色
                '⚙️',
                'system'
            )
            print("✅ Core Team created successfully")
        else:
            print("✓ Core Team already exists")
        
        # ========== KV 到 PostgreSQL 同步 ==========
        print("\n🔄 Checking for missing data from Cloudflare KV...")
        await self.sync_missing_from_kv()
    
    async def sync_missing_from_kv(self):
        """
        從 Cloudflare KV 補足 PostgreSQL 缺失的數據
        
        策略：
        - PostgreSQL 優先（已存在的不動）
        - 只補足缺失的
        - 自動處理團隊依賴
        """
        from cloudflare import get_cf_kv
        from datetime import datetime
        
        cf_kv = get_cf_kv()
        if cf_kv.is_dummy:
            print("⏭️  Skipping KV sync (using dummy credentials)")
            return
        
        try:
            async with self.pool.acquire() as conn:
                # ========== 1. 同步 Tokens ==========
                print("🔍 Syncing tokens from KV...")
                
                # 1.1 獲取 PostgreSQL 現有的 token_hash
                existing_tokens = await conn.fetch("SELECT token_hash FROM tokens")
                existing_hash_set = {row['token_hash'] for row in existing_tokens}
                print(f"   PostgreSQL has {len(existing_hash_set)} tokens")
                
                # 1.2 從 KV 列出所有 token keys
                all_token_keys = []
                cursor = None
                
                while True:
                    result = await cf_kv.list_keys(prefix="token:", cursor=cursor)
                    keys = result.get("keys", [])
                    all_token_keys.extend([k["name"] for k in keys])
                    
                    cursor = result.get("cursor")
                    if not cursor or result.get("list_complete"):
                        break
                
                print(f"   KV has {len(all_token_keys)} tokens")
                
                # 1.3 找出缺失的 tokens
                imported_count = 0
                skipped_count = 0
                
                for key_name in all_token_keys:
                    token_hash = key_name.replace("token:", "")
                    
                    if token_hash in existing_hash_set:
                        skipped_count += 1
                        continue
                    
                    # 1.4 從 KV 讀取數據
                    kv_data = await cf_kv.get_value(key_name)
                    if not kv_data:
                        print(f"   ⚠️  Key {key_name} has no data, skipping")
                        continue
                    
                    # 1.5 確保團隊存在（從 Clerk 同步）
                    team_id = kv_data.get('team_id', 'core-team')
                    team_id = await self._ensure_team_from_clerk(conn, team_id)
                    
                    # 1.6 插入 PostgreSQL
                    try:
                        # 解析時間
                        created_at = None
                        if kv_data.get('created_at'):
                            try:
                                created_at = datetime.fromisoformat(kv_data['created_at'].replace('Z', '+00:00'))
                            except:
                                created_at = datetime.utcnow()
                        else:
                            created_at = datetime.utcnow()
                        
                        expires_at = None
                        if kv_data.get('expires_at'):
                            try:
                                expires_at = datetime.fromisoformat(kv_data['expires_at'].replace('Z', '+00:00'))
                            except:
                                pass
                        
                        await conn.execute("""
                            INSERT INTO tokens 
                            (token_hash, name, team_id, scopes, created_at, expires_at, 
                             created_by, description, is_active, token_encrypted)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NULL)
                            ON CONFLICT (token_hash) DO NOTHING
                        """, 
                            token_hash,
                            kv_data.get('name', 'Imported Token'),
                            team_id,
                            kv_data.get('scopes', ['*']),
                            created_at,
                            expires_at,
                            'kv-import',  # 標記為從 KV 導入
                            f"從 Cloudflare KV 自動導入 ({datetime.utcnow().strftime('%Y-%m-%d %H:%M')})"
                        )
                        imported_count += 1
                        print(f"   ✅ Imported token: {kv_data.get('name', 'Unknown')} ({token_hash[:8]}...)")
                    
                    except Exception as e:
                        print(f"   ❌ Failed to import token {token_hash[:8]}: {e}")
                        continue
                
                if imported_count > 0:
                    print(f"✅ Token sync complete: {imported_count} imported, {skipped_count} skipped")
                else:
                    print(f"✓ All tokens in sync ({skipped_count} tokens checked)")
                
                # ========== 2. 同步 Routes ==========
                print("\n🔍 Syncing routes from KV...")
                
                # 2.1 獲取 PostgreSQL 現有的路由
                existing_routes = await conn.fetch("SELECT path FROM routes")
                existing_paths = {row['path'] for row in existing_routes}
                print(f"   PostgreSQL has {len(existing_paths)} routes")
                
                # 2.2 從 KV 讀取 routes
                routes_data = await cf_kv.get_value("routes")
                
                if routes_data and isinstance(routes_data, dict):
                    kv_routes = routes_data
                    print(f"   KV has {len(kv_routes)} routes")
                    
                    # 2.3 補足缺失的路由
                    route_imported = 0
                    route_skipped = 0
                    
                    for path, route_config in kv_routes.items():
                        if path in existing_paths:
                            route_skipped += 1
                            continue
                        
                        try:
                            # 處理新舊格式
                            if isinstance(route_config, str):
                                # 舊格式：{"path": "url"}
                                backend_url = route_config
                                tags = []
                                auth_type = 'none'
                                auth_config = None
                            elif isinstance(route_config, dict):
                                # 新格式：{"url": "...", "tags": [...], "auth": {...}}
                                backend_url = route_config.get('url', route_config.get('backend_url', ''))
                                tags = route_config.get('tags', [])
                                auth = route_config.get('auth', {})
                                auth_type = auth.get('type', 'none') if auth else 'none'
                                auth_config = auth.get('config') if auth else None
                            else:
                                print(f"   ⚠️  Invalid route config for {path}, skipping")
                                continue
                            
                            # 插入路由
                            await conn.execute("""
                                INSERT INTO routes 
                                (path, name, backend_url, description, tags, 
                                 backend_auth_type, backend_auth_config, created_at)
                                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                                ON CONFLICT (path) DO NOTHING
                            """,
                                path,
                                f"Imported: {path}",
                                backend_url,
                                f"從 Cloudflare KV 自動導入 ({datetime.utcnow().strftime('%Y-%m-%d %H:%M')})",
                                tags,
                                auth_type,
                                auth_config,
                                datetime.utcnow()
                            )
                            route_imported += 1
                            print(f"   ✅ Imported route: {path} → {backend_url}")
                        
                        except Exception as e:
                            print(f"   ❌ Failed to import route {path}: {e}")
                            continue
                    
                    if route_imported > 0:
                        print(f"✅ Route sync complete: {route_imported} imported, {route_skipped} skipped")
                    else:
                        print(f"✓ All routes in sync ({route_skipped} routes checked)")
                else:
                    print("   ℹ️  No routes in KV")
        
        except Exception as e:
            print(f"⚠️  KV sync encountered an error: {e}")
            print("   Continuing with startup (sync is optional)...")
            # 不拋出異常，允許服務正常啟動
    
    async def _ensure_team_from_clerk(self, conn, team_id: str) -> str:
        """
        確保團隊存在，從 Clerk 同步團隊資訊
        
        Returns:
            實際使用的 team_id（如果不存在則返回 'core-team'）
        """
        from datetime import datetime
        from clerk_backend_api import Clerk
        import os
        
        # 1. 檢查 PostgreSQL 是否已有此團隊
        team_exists = await conn.fetchval("""
            SELECT EXISTS (SELECT 1 FROM teams WHERE id = $1)
        """, team_id)
        
        if team_exists:
            return team_id  # 已存在，直接返回
        
        # 2. 從 Clerk 查詢此團隊的資訊
        print(f"   🔍 Team '{team_id}' not in PostgreSQL, checking Clerk...")
        
        try:
            clerk_secret = os.getenv("CLERK_SECRET_KEY")
            if not clerk_secret:
                print(f"   ⚠️  CLERK_SECRET_KEY not set, using core-team")
                return 'core-team'
            
            clerk = Clerk(bearer_auth=clerk_secret)
            
            # 遍歷用戶找到此團隊的資訊
            users_response = clerk.users.list(request={})
            users = users_response.data
            
            team_info = None
            team_members = []
            
            for user in users:
                metadata = user.public_metadata or {}
                team_roles = metadata.get('tokenManager:teamRoles', {})
                
                if team_id in team_roles:
                    team_members.append({
                        'user_id': user.id,
                        'role': team_roles[team_id]
                    })
                    
                    # 嘗試獲取團隊名稱（如果 metadata 中有）
                    teams_list = metadata.get('tokenManager:teams', [])
                    for t in teams_list:
                        if isinstance(t, dict) and t.get('id') == team_id:
                            team_info = t
                            break
            
            if not team_members:
                # Clerk 中沒有此團隊
                print(f"   ⚠️  Team '{team_id}' not found in Clerk, using core-team")
                return 'core-team'
            
            # 3. 從 Clerk 找到了團隊，創建到 PostgreSQL
            team_name = team_info.get('name', f'Team {team_id}') if team_info else f'Team {team_id}'
            team_description = f"從 Clerk 同步的團隊（{len(team_members)} 個成員）"
            team_color = team_info.get('color', '#3b82f6') if team_info else '#3b82f6'
            team_icon = team_info.get('icon', '👥') if team_info else '👥'
            
            # 找出創建者（第一個 ADMIN）
            creator = 'system'
            for member in team_members:
                if member['role'] == 'ADMIN':
                    creator = member['user_id']
                    break
            
            await conn.execute("""
                INSERT INTO teams (id, name, description, color, icon, created_by, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
                team_id,
                team_name,
                team_description,
                team_color,
                team_icon,
                creator,
                datetime.utcnow()
            )
            
            print(f"   ✅ Synced team from Clerk: {team_name} ({team_id}) with {len(team_members)} members")
            return team_id
        
        except Exception as e:
            print(f"   ❌ Failed to sync team from Clerk: {e}")
            print(f"   → Using core-team as fallback")
            return 'core-team'


# 全局數據庫實例
db = Database()

