# Database.py 完整解析與遷移機制

**日期**: 2025-11-03  
**目的**: 詳細說明 database.py 的工作原理和遷移機制

---

## 📚 database.py 是什麼？

```python
"""
database.py 是應用的資料庫管理中心

職責:
  1. 連接管理 - 創建和管理資料庫連接池
  2. Schema 初始化 - 創建表、索引、約束
  3. Schema 遷移 - 自動升級資料庫結構
  4. 系統數據初始化 - 創建必需的系統數據
"""
```

---

## 🔄 與 Prisma 的對比

### **Prisma（你用過的）**

```javascript
// schema.prisma
model User {
  id    Int    @id @default(autoincrement())
  email String @unique
}

// 工作流程
1. 修改 schema.prisma
2. 執行 npx prisma migrate dev --name add_email
3. 生成遷移檔案 migrations/20231103_add_email.sql
4. 執行遷移
5. 生成 Prisma Client

問題:
  ❌ 需要管理大量遷移檔案
  ❌ 遷移檔案容易衝突
  ❌ 必須按順序執行遷移
  ❌ 複雜且容易出錯
```

### **我們的方案（基於 asyncpg）**

```python
# database.py
async def init_tables(self):
    # 創建表
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE
        )
    """)
    
    # 檢查並添加新欄位（遷移）
    column_exists = await conn.fetchval("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='users' AND column_name='phone'
        )
    """)
    
    if not column_exists:
        await conn.execute("ALTER TABLE users ADD COLUMN phone VARCHAR(20)")

優點:
  ✅ 零遷移檔案
  ✅ 自動檢測和升級
  ✅ 冪等性（可重複執行）
  ✅ 簡單直觀
  ✅ 不會衝突
```

---

## 🔍 database.py 工作原理

### **執行流程**

```
應用啟動
  ↓
main.py: @app.on_event("startup")
  ↓
await db.connect()
  ↓
database.py: async def connect(self)
  ↓
創建連接池
  ↓
await self.init_tables()
  ↓
╔════════════════════════════════════════╗
║  初始化所有表                          ║
╠════════════════════════════════════════╣
║  1. CREATE TABLE IF NOT EXISTS tokens  ║
║  2. CREATE TABLE IF NOT EXISTS routes  ║
║  3. CREATE TABLE IF NOT EXISTS teams   ║
║  4. CREATE TABLE IF NOT EXISTS audits  ║
╚════════════════════════════════════════╝
  ↓
╔════════════════════════════════════════╗
║  Schema 遷移檢查                       ║
╠════════════════════════════════════════╣
║  檢查 tokens 表是否有 team_id 欄位？   ║
║  → 沒有？添加 team_id 和 created_by    ║
║  → 有？跳過                            ║
║                                        ║
║  檢查 tokens 表是否有 department 欄位？║
║  → 有？移除 department                 ║
║  → 沒有？跳過                          ║
║                                        ║
║  檢查是否有外鍵約束？                  ║
║  → 沒有？添加外鍵約束                  ║
║  → 有？跳過                            ║
╚════════════════════════════════════════╝
  ↓
╔════════════════════════════════════════╗
║  系統數據初始化                        ║
╠════════════════════════════════════════╣
║  await self.init_system_teams(conn)    ║
║  → 檢查 core-team 是否存在？           ║
║     → 沒有？創建 core-team             ║
║     → 有？跳過                         ║
╚════════════════════════════════════════╝
  ↓
應用就緒 ✅
```

---

## 🎯 自動遷移機制詳解

### **如何檢測現有結構？**

```python
# 使用 PostgreSQL 的 information_schema

# 1. 檢查欄位是否存在
column_exists = await conn.fetchval("""
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='tokens' AND column_name='team_id'
    )
""")
# 返回 True 或 False

# 2. 檢查表是否存在
table_exists = await conn.fetchval("""
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name='teams'
    )
""")

# 3. 檢查約束是否存在
constraint_exists = await conn.fetchval("""
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name='tokens_team_id_fkey'
    )
""")

# 4. 檢查索引是否存在（使用 pg_indexes）
index_exists = await conn.fetchval("""
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname='idx_tokens_team_id'
    )
""")
```

### **遷移邏輯**

```python
# 範例：添加 team_id 欄位

# 第一次啟動（tokens 表沒有 team_id）
column_exists = False
  ↓
執行: ALTER TABLE tokens ADD COLUMN team_id VARCHAR(50)
  ↓
輸出: "🔄 Migrating tokens table: adding team_id..."
      "✅ Tokens table migration completed"

# 第二次啟動（tokens 表已有 team_id）
column_exists = True
  ↓
跳過 ALTER TABLE
  ↓
無輸出（或輸出 "✓ team_id column already exists"）
```

### **冪等性（Idempotency）**

```python
什麼是冪等性？
  執行多次 = 執行一次
  不會產生副作用

我們的實現:
  ✅ CREATE TABLE IF NOT EXISTS → 表存在就跳過
  ✅ 先檢查欄位存在才 ALTER TABLE → 不會重複添加
  ✅ 先檢查約束存在才 ADD CONSTRAINT → 不會重複創建
  ✅ INSERT 前先 SELECT EXISTS → 不會重複插入

好處:
  ✅ 可以多次重啟應用，不會出錯
  ✅ 多個實例同時啟動也安全
  ✅ 部署時不需要擔心狀態
```

---

## 🆚 Prisma vs 我們的方案

### **Prisma 的問題**

```bash
# Prisma 工作流
1. 修改 schema.prisma
2. prisma migrate dev
   → 生成 migrations/20231103120000_xxx/migration.sql
   → 執行 SQL
   → 更新 _prisma_migrations 表

3. 修改 schema.prisma 又一次
4. prisma migrate dev
   → 生成 migrations/20231103130000_yyy/migration.sql
   → 執行 SQL

5. 幾個月後...
   migrations/
     ├── 20231103120000_add_user/
     ├── 20231103130000_add_email/
     ├── 20231104140000_add_phone/
     ├── 20231105150000_remove_age/
     ├── 20231106160000_add_index/
     └── ... (100+ 個遷移檔案)

問題:
  ❌ 遷移檔案爆炸
  ❌ 多人協作時遷移衝突
  ❌ 必須按順序執行
  ❌ 無法跳過某個遷移
  ❌ 回滾複雜
  ❌ 新環境要執行所有遷移（慢）
```

### **我們的方案優勢**

```python
# 我們的 database.py

async def init_tables(self):
    # 最終狀態定義（不是增量變更）
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS tokens (
            id SERIAL PRIMARY KEY,
            token_hash VARCHAR(64) UNIQUE,
            name VARCHAR(255),
            team_id VARCHAR(50),      ← 最終欄位
            created_by VARCHAR(100),  ← 最終欄位
            scopes TEXT[],
            created_at TIMESTAMP,
            expires_at TIMESTAMP,
            is_active BOOLEAN
        )
    """)
    
    # 遷移邏輯（處理升級）
    if not column_exists('team_id'):
        add_column('team_id')
    
    if column_exists('department'):  # 舊欄位
        remove_column('department')

優點:
  ✅ 零遷移檔案
  ✅ 一個檔案管理所有 Schema
  ✅ 看最終狀態就知道資料庫結構
  ✅ 新環境直接創建最終狀態（快）
  ✅ 舊環境自動升級
  ✅ 不會衝突
```

---

## 💾 關於 information_schema

### **什麼是 information_schema？**

```sql
information_schema 是 PostgreSQL 的元數據資料庫

包含所有關於資料庫結構的信息:
  - information_schema.tables → 所有表
  - information_schema.columns → 所有欄位
  - information_schema.table_constraints → 所有約束
  - pg_indexes → 所有索引

作用:
  讓我們可以「查詢資料庫的結構」
  就像查詢普通資料一樣
```

### **實際應用**

```sql
-- 查詢 tokens 表有哪些欄位
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tokens';

-- 結果:
column_name   | data_type
--------------+-----------
id            | integer
token_hash    | varchar
name          | varchar
team_id       | varchar    ← 新欄位
created_by    | varchar    ← 新欄位
scopes        | ARRAY
created_at    | timestamp

-- 檢查某個欄位是否存在
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='tokens' AND column_name='team_id'
);
-- 返回 true 或 false
```

---

## 🔄 完整遷移範例

### **場景：從 v1.0 升級到 v2.0**

```python
# v1.0 Schema (舊)
tokens:
  - id
  - token_hash
  - name
  - department      ← 舊欄位
  - scopes
  - created_at

# v2.0 Schema (新)
tokens:
  - id
  - token_hash
  - name
  - team_id         ← 新欄位
  - created_by      ← 新欄位
  - scopes
  - created_at

# database.py 如何處理？

# Step 1: CREATE TABLE IF NOT EXISTS
# → 如果表不存在，創建 v2.0 版本（已包含 team_id, created_by）
# → 如果表已存在，什麼都不做

# Step 2: 檢查 team_id 是否存在
column_exists = SELECT EXISTS (columns WHERE column_name='team_id')
# → v1.0: 返回 False
# → v2.0: 返回 True

# Step 3: 如果不存在，添加
if not column_exists:
    ALTER TABLE tokens ADD COLUMN team_id VARCHAR(50)
    print("✅ Added team_id column")

# Step 4: 檢查舊欄位 department 是否存在
dept_exists = SELECT EXISTS (columns WHERE column_name='department')
# → v1.0: 返回 True
# → v2.0: 返回 False

# Step 5: 如果存在，移除
if dept_exists:
    ALTER TABLE tokens DROP COLUMN department
    print("✅ Removed deprecated department column")

結果:
  v1.0 資料庫 → 自動升級為 v2.0
  v2.0 資料庫 → 不做任何改動
  全新資料庫 → 直接創建 v2.0
```

---

## 🎯 為什麼這個方案更好？

### **對比表**

| 特性 | Prisma Migrate | 我們的方案 |
|------|---------------|-----------|
| **遷移檔案數量** | 每次修改一個檔案 | 0 個檔案 |
| **查看當前結構** | 要看最後一個遷移檔 | 直接看 database.py |
| **新環境部署** | 執行所有遷移（慢） | 直接創建最終狀態（快） |
| **多人協作** | 容易衝突 | 不會衝突 |
| **回滾** | 需要寫 down 遷移 | 無法回滾 |
| **冪等性** | 不保證 | 完全保證 |
| **學習曲線** | 陡峭 | 平緩 |

### **適用場景**

```yaml
Prisma 適合:
  ✅ 需要精確的遷移歷史記錄
  ✅ 需要回滾功能
  ✅ 複雜的 ORM 需求
  ✅ TypeScript 生態

我們的方案適合:
  ✅ 快速迭代開發
  ✅ 簡單的資料庫結構
  ✅ 不需要回滾（前進式開發）
  ✅ Python/FastAPI 生態
  ✅ 小型到中型項目
```

---

## 🔐 安全性問題

### **問題：直接執行 SQL 不危險嗎？**

```python
# 我們的做法
await conn.execute("""
    CREATE TABLE IF NOT EXISTS tokens (...)
""")

# 參數化查詢（防 SQL 注入）
await conn.execute("""
    INSERT INTO tokens (name, team_id) 
    VALUES ($1, $2)
""", name, team_id)  # ← 參數化，安全

安全措施:
  ✅ 使用 asyncpg 的參數化查詢
  ✅ CREATE TABLE 語句寫死在代碼中（不來自用戶輸入）
  ✅ Schema 定義在代碼中（受版本控制）
  ✅ 只在啟動時執行（不在運行時）
```

---

## 📝 最佳實踐

### **1. Schema 定義寫在 CREATE TABLE**

```python
# ✅ 好的做法
await conn.execute("""
    CREATE TABLE IF NOT EXISTS tokens (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        team_id VARCHAR(50),      ← 最終的完整 Schema
        created_by VARCHAR(100),
        scopes TEXT[]
    )
""")
```

### **2. 遷移邏輯寫在檢查後**

```python
# ✅ 好的做法
column_exists = await conn.fetchval("""
    SELECT EXISTS (...)
""")

if not column_exists:
    await conn.execute("ALTER TABLE tokens ADD COLUMN team_id VARCHAR(50)")
    print("✅ Migration: added team_id")
```

### **3. 清理舊欄位**

```python
# ✅ 好的做法
if column_exists('department'):
    await conn.execute("ALTER TABLE tokens DROP COLUMN department")
    print("✅ Removed deprecated column: department")
```

### **4. 初始化系統數據**

```python
# ✅ 好的做法
async def init_system_teams(self, conn):
    if not exists('core-team'):
        INSERT INTO teams VALUES ('core-team', ...)
        print("✅ Created system team: core-team")
```

---

## 🔮 未來擴展

### **如果需要更複雜的遷移？**

```python
# 可以添加版本號機制

# 創建版本表
CREATE TABLE IF NOT EXISTS schema_version (
    version INT PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT NOW()
)

# 檢查版本並遷移
current_version = await conn.fetchval("SELECT MAX(version) FROM schema_version")

if current_version < 2:
    # 執行 v1 → v2 遷移
    await migrate_v1_to_v2(conn)
    await conn.execute("INSERT INTO schema_version (version) VALUES (2)")

if current_version < 3:
    # 執行 v2 → v3 遷移
    await migrate_v2_to_v3(conn)
    await conn.execute("INSERT INTO schema_version (version) VALUES (3)")
```

但目前我們不需要這麼複雜！

---

## 📋 常見問題

### **Q1: 多個實例同時啟動會不會衝突？**

```
A: 不會！

原因:
  1. CREATE TABLE IF NOT EXISTS → 原子操作
  2. SELECT EXISTS → 只是查詢
  3. INSERT INTO teams → 有 PRIMARY KEY 約束，重複插入會失敗
  4. 我們會先 SELECT EXISTS 檢查

結果:
  第一個實例：創建 core-team ✅
  第二個實例：檢測到已存在，跳過 ✅
```

### **Q2: 如果遷移失敗怎麼辦？**

```python
A: 應用會啟動失敗

# main.py
@app.on_event("startup")
async def startup():
    try:
        await db.connect()
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        raise  # ← 應用不會啟動

好處:
  ✅ 快速失敗（Fail Fast）
  ✅ 不會在錯誤狀態下運行
  ✅ 錯誤訊息清晰
```

### **Q3: 可以手動修改資料庫嗎？**

```
A: 可以，但不建議！

如果手動修改:
  1. 修改後重啟應用
  2. database.py 會檢測你的修改
  3. 如果與預期不符，會嘗試修正

建議:
  ✅ 所有 Schema 變更都寫在 database.py
  ✅ 讓代碼成為唯一的真相來源
  ❌ 不要手動執行 ALTER TABLE
```

### **Q4: 如何查看當前資料庫結構？**

```bash
# 方法 1: psql 命令
psql $DATABASE_URL
\d tokens  # 查看 tokens 表結構
\d  # 列出所有表

# 方法 2: 直接看 database.py
# 最清晰，因為代碼就是文檔
```

---

## 🎓 學習重點

### **PostgreSQL 基礎**

```sql
-- 1. CREATE TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS users (...);
→ 如果表存在，什麼都不做（不報錯）

-- 2. ALTER TABLE ADD COLUMN IF NOT EXISTS
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
→ 如果欄位存在，什麼都不做

-- 3. information_schema
SELECT * FROM information_schema.columns WHERE table_name='users';
→ 查詢資料庫元數據

-- 4. EXISTS 子查詢
SELECT EXISTS (SELECT 1 FROM teams WHERE id='core-team');
→ 返回 true/false

-- 5. FOREIGN KEY ... ON DELETE CASCADE
ALTER TABLE tokens ADD CONSTRAINT fk_team 
FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
→ 刪除 team 時自動刪除相關 tokens
```

### **asyncpg 基礎**

```python
# 1. 連接池
pool = await asyncpg.create_pool(database_url, min_size=2, max_size=10)
→ 維護 2-10 個連接，複用連接

# 2. 獲取連接
async with pool.acquire() as conn:
    # 使用連接
→ 自動歸還連接到池

# 3. 執行查詢
result = await conn.fetchval("SELECT COUNT(*) FROM users")
→ 返回單一值

rows = await conn.fetch("SELECT * FROM users")
→ 返回多行

await conn.execute("INSERT INTO users (...) VALUES (...)")
→ 執行但不返回結果
```

---

## 📝 總結

### **database.py 的精髓**

```yaml
哲學:
  定義「最終狀態」而非「變更步驟」

優點:
  ✅ 簡單：一個檔案，沒有遷移檔案夾
  ✅ 清晰：看代碼就知道資料庫長什麼樣
  ✅ 安全：冪等性保證
  ✅ 快速：新環境直接創建最終狀態
  ✅ 自動：舊環境自動升級

適合:
  ✅ 快速開發
  ✅ 前進式開發（不需要回滾）
  ✅ 小到中型項目
  ✅ 團隊協作

不適合:
  ❌ 需要精確遷移歷史
  ❌ 需要頻繁回滾
  ❌ 複雜的資料轉換
```

---

**這就是為什麼我們不用 Prisma！** 🚀

簡單、清晰、有效。

