# 過時文檔說明

以下文檔為舊版權限系統設計，僅供參考，**不再適用於當前系統**。

## ❌ 已過時的文檔

### Global Role + Team Scope 架構（v1.0 - v2.1）
- `PERMISSIONS_GUIDE.md` - 舊的權限指南
- `PERMISSIONS_QUICK_REFERENCE.md` - 舊的快速參考
- `RBAC_REDESIGN.md` - 多次迭代的設計文檔

**為什麼過時：**
- 使用全局角色 + 團隊範圍
- 存在跨團隊影響問題
- 需要複雜的團隊交集檢查
- 有 "all" 團隊的特殊處理邏輯

---

## ✅ 當前有效文檔

### Per-Team Roles 架構（v3.0）
- **[`PERMISSION_RULES.md`](PERMISSION_RULES.md)** - 完整權限規則（主要文檔）
- **[`PER_TEAM_ROLES_ANALYSIS.md`](PER_TEAM_ROLES_ANALYSIS.md)** - 架構分析與對比

---

## 🔄 架構演進

### v1.0: Global Role
```json
{
  "role": "MANAGER",
  "team": "backend-team"
}
```
**問題：** 單團隊限制

---

### v2.0-2.1: Global Role + Multi-Team
```json
{
  "role": "MANAGER",
  "teams": ["backend-team", "platform-team"]
}
```
**問題：** 跨團隊影響（Platform MANAGER 改人會影響 Backend）

---

### v3.0: Per-Team Roles（當前）
```json
{
  "teamRoles": {
    "backend-team": "MANAGER",
    "platform-team": "DEVELOPER"
  }
}
```
**優勢：** 完美團隊隔離，無跨團隊影響

---

**請參閱最新文檔：[`PERMISSION_RULES.md`](PERMISSION_RULES.md)**

