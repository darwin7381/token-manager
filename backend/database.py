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
                    name VARCHAR(255) NOT NULL,
                    department VARCHAR(100) NOT NULL,
                    scopes TEXT[] NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    expires_at TIMESTAMP,
                    last_used TIMESTAMP,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE
                )
            """)
            
            # 創建索引
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_tokens_hash 
                ON tokens(token_hash)
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_tokens_active 
                ON tokens(is_active)
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


# 全局數據庫實例
db = Database()

