/**
 * Token Manager 角色和權限定義
 * 使用 RBAC + Team Scoping 模式
 */

export const NAMESPACE = 'tokenManager';

/**
 * 角色定義
 */
export const ROLES = {
  ADMIN: {
    id: 'ADMIN',
    name: '系統管理員',
    scope: 'team',  // 改為 team，統一處理
    color: '#ef4444', // 紅色
    icon: '👑',
    permissions: ['*'],
    description: '可以管理所選團隊的所有資源、用戶和系統設定',
    features: [
      '查看和管理所選團隊的 Token',
      '查看和管理所選團隊的路由',
      '管理所選團隊的用戶權限',
      '查看審計日誌',
      '系統設定'
    ],
    requiresTeam: true,  // 所有角色都需要至少一個團隊（可以是 ALL）
    canManageUsers: true,
    canManageAllResources: true,
    canViewAuditLogs: true
  },
  
  MANAGER: {
    id: 'MANAGER',
    name: '團隊管理者',
    scope: 'team',
    color: '#3b82f6', // 藍色
    icon: '⭐',
    permissions: [
      'read:all',
      'create:team',
      'update:team',
      'delete:team',
      'manage:team-members'
    ],
    description: '可以管理所選團隊的所有資源（可選擇多個團隊或全部團隊）',
    features: [
      '查看所選團隊的 Token 和路由',
      '創建所選團隊的 Token 和路由',
      '編輯和刪除所選團隊的資源',
      '管理所選團隊的成員'
    ],
    requiresTeam: true,
    canManageUsers: true,
    canManageAllResources: true,
    canViewAuditLogs: false
  },
  
  DEVELOPER: {
    id: 'DEVELOPER',
    name: '開發者',
    scope: 'team',
    color: '#10b981', // 綠色
    icon: '💻',
    permissions: [
      'read:all',
      'create:team',
      'update:own',
      'delete:own'
    ],
    description: '可以在所選團隊內創建和管理自己的資源（可選擇多個團隊或全部團隊）',
    features: [
      '查看所選團隊的 Token 和路由',
      '在所選團隊內創建自己的 Token 和路由',
      '編輯和刪除自己創建的資源'
    ],
    requiresTeam: true,
    canManageUsers: false,
    canManageAllResources: false,
    canViewAuditLogs: false
  },
  
  VIEWER: {
    id: 'VIEWER',
    name: '檢視者',
    scope: 'team',  // 改為 team，統一處理
    color: '#6b7280', // 灰色
    icon: '👁️',
    permissions: ['read:all'],
    description: '可以查看所選團隊的資源，但不能修改（可選擇多個團隊或全部團隊）',
    features: [
      '查看所選團隊的 Token',
      '查看所選團隊的路由',
      '查看統計數據'
    ],
    requiresTeam: true,  // 所有角色都需要至少一個團隊（可以是 ALL）
    canManageUsers: false,
    canManageAllResources: false,
    canViewAuditLogs: false
  }
};

/**
 * 團隊定義
 * 注意：團隊信息應該從 API 動態獲取（/api/teams）
 * 這裡只保留 fallback 用途
 */
export const TEAMS = {
  // 移除硬編碼的團隊
  // 所有團隊信息從 PostgreSQL API 動態獲取
};

/**
 * 權限動作定義
 */
export const PERMISSIONS = {
  // Token 相關
  READ_TOKENS: 'read:tokens',
  CREATE_TOKENS: 'create:tokens',
  UPDATE_TOKENS: 'update:tokens',
  DELETE_TOKENS: 'delete:tokens',
  
  // Route 相關
  READ_ROUTES: 'read:routes',
  CREATE_ROUTES: 'create:routes',
  UPDATE_ROUTES: 'update:routes',
  DELETE_ROUTES: 'delete:routes',
  
  // 用戶管理
  READ_USERS: 'read:users',
  MANAGE_USERS: 'manage:users',
  MANAGE_TEAM_MEMBERS: 'manage:team-members',
  
  // 系統
  VIEW_STATS: 'view:stats',
  VIEW_AUDIT_LOGS: 'view:audit-logs',
  MANAGE_SETTINGS: 'manage:settings'
};

/**
 * 獲取角色的顯示信息
 */
export const getRoleInfo = (roleId) => {
  return ROLES[roleId] || ROLES.VIEWER;
};

/**
 * 獲取團隊的顯示信息
 * 注意：應該從動態獲取的團隊列表中查找，這只是 fallback
 */
export const getTeamInfo = (teamId) => {
  return Object.values(TEAMS).find(team => team.id === teamId) || null;
  // 返回 null 表示團隊不在 constants 中，應該從 API 獲取
};

/**
 * 檢查角色是否需要團隊
 */
export const roleRequiresTeam = (roleId) => {
  return ROLES[roleId]?.requiresTeam || false;
};


