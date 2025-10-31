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
    scope: 'global',
    color: '#ef4444', // 紅色
    icon: '👑',
    permissions: ['*'],
    description: '可以管理所有資源、用戶和系統設定',
    features: [
      '查看和管理所有 Token',
      '查看和管理所有路由',
      '管理所有用戶的權限',
      '查看審計日誌',
      '系統設定'
    ]
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
    description: '可以管理自己團隊的所有資源',
    features: [
      '查看所有 Token 和路由',
      '創建團隊的 Token 和路由',
      '編輯和刪除團隊的資源',
      '管理團隊成員（不包括其他團隊）'
    ],
    requiresTeam: true
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
    description: '可以創建和管理自己的資源',
    features: [
      '查看所有 Token 和路由',
      '創建自己的 Token 和路由',
      '編輯和刪除自己創建的資源'
    ],
    requiresTeam: true
  },
  
  VIEWER: {
    id: 'VIEWER',
    name: '檢視者',
    scope: 'global',
    color: '#6b7280', // 灰色
    icon: '👁️',
    permissions: ['read:all'],
    description: '只能查看所有資源，無法進行任何修改',
    features: [
      '查看所有 Token',
      '查看所有路由',
      '查看統計數據'
    ]
  }
};

/**
 * 團隊定義（可以從後端動態獲取，這裡先定義預設值）
 */
export const TEAMS = {
  PLATFORM: {
    id: 'platform-team',
    name: 'Platform Team',
    description: '平台基礎設施團隊',
    color: '#8b5cf6'
  },
  BACKEND: {
    id: 'backend-team',
    name: 'Backend Team',
    description: '後端開發團隊',
    color: '#3b82f6'
  },
  FRONTEND: {
    id: 'frontend-team',
    name: 'Frontend Team',
    description: '前端開發團隊',
    color: '#10b981'
  },
  DATA: {
    id: 'data-team',
    name: 'Data Team',
    description: '數據工程團隊',
    color: '#f59e0b'
  },
  DEVOPS: {
    id: 'devops-team',
    name: 'DevOps Team',
    description: 'DevOps 團隊',
    color: '#ef4444'
  }
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
 */
export const getTeamInfo = (teamId) => {
  return Object.values(TEAMS).find(team => team.id === teamId) || null;
};

/**
 * 檢查角色是否需要團隊
 */
export const roleRequiresTeam = (roleId) => {
  return ROLES[roleId]?.requiresTeam || false;
};


