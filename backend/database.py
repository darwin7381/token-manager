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


# 全局數據庫實例
db = Database()

