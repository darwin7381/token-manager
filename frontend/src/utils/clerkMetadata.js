/**
 * Clerk Metadata 工具函數
 * 統一管理命名空間和 metadata 操作
 */

import { NAMESPACE } from '../constants/roles';

/**
 * 獲取完整的 metadata key
 */
export const getMetadataKey = (key) => {
  return `${NAMESPACE}:${key}`;
};

/**
 * 從用戶獲取 Token Manager 的角色
 */
export const getUserRole = (user) => {
  if (!user?.publicMetadata) return 'VIEWER';
  return user.publicMetadata[getMetadataKey('role')] || 'VIEWER';
};

/**
 * 從用戶獲取 Token Manager 的團隊
 */
export const getUserTeam = (user) => {
  if (!user?.publicMetadata) return null;
  return user.publicMetadata[getMetadataKey('team')] || null;
};

/**
 * 從用戶獲取所有 Token Manager 的 metadata
 */
export const getTokenManagerMetadata = (user) => {
  if (!user?.publicMetadata) return {};
  
  const metadata = {};
  const prefix = `${NAMESPACE}:`;
  
  Object.keys(user.publicMetadata).forEach(key => {
    if (key.startsWith(prefix)) {
      const shortKey = key.substring(prefix.length);
      metadata[shortKey] = user.publicMetadata[key];
    }
  });
  
  return metadata;
};

/**
 * 構建設定角色的 metadata 對象
 * 注意：這個函數只生成 metadata，實際更新需要在後端或 Clerk Dashboard 操作
 */
export const buildRoleMetadata = (role, team = null) => {
  const metadata = {
    [getMetadataKey('role')]: role,
    [getMetadataKey('updatedAt')]: new Date().toISOString()
  };
  
  // 如果有團隊，加入團隊信息
  if (team) {
    metadata[getMetadataKey('team')] = team;
  }
  
  return metadata;
};

/**
 * 驗證 metadata 結構是否正確
 */
export const validateMetadata = (metadata) => {
  const role = metadata[getMetadataKey('role')];
  
  if (!role) {
    return { valid: false, error: '缺少角色信息' };
  }
  
  const validRoles = ['ADMIN', 'MANAGER', 'DEVELOPER', 'VIEWER'];
  if (!validRoles.includes(role)) {
    return { valid: false, error: `無效的角色: ${role}` };
  }
  
  // MANAGER 和 DEVELOPER 必須有團隊
  if (['MANAGER', 'DEVELOPER'].includes(role)) {
    const team = metadata[getMetadataKey('team')];
    if (!team) {
      return { valid: false, error: `${role} 角色必須指定團隊` };
    }
  }
  
  return { valid: true };
};

/**
 * 格式化顯示用的角色信息
 */
export const formatRoleDisplay = (user) => {
  const role = getUserRole(user);
  const team = getUserTeam(user);
  
  if (team) {
    return `${role} (${team})`;
  }
  
  return role;
};



