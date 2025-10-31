/**
 * 權限管理 Hook
 * 使用 RBAC + Team Scoping 模式
 */

import { useUser } from '@clerk/clerk-react';
import { NAMESPACE, ROLES } from '../constants/roles';

export const usePermissions = () => {
  const { user, isLoaded } = useUser();
  
  // 從 Clerk metadata 讀取角色和團隊
  const userRole = user?.publicMetadata?.[`${NAMESPACE}:role`] || 'VIEWER';
  const userTeam = user?.publicMetadata?.[`${NAMESPACE}:team`] || null;
  
  /**
   * 檢查是否有特定權限
   */
  const hasPermission = (permission) => {
    if (!isLoaded || !user) return false;
    
    const roleConfig = ROLES[userRole];
    if (!roleConfig) return false;
    
    // ADMIN 有所有權限
    if (roleConfig.permissions.includes('*')) return true;
    
    // 檢查具體權限
    return roleConfig.permissions.some(p => {
      if (p === permission) return true;
      // 支援萬用字元，如 'read:*' 匹配 'read:tokens'
      if (p.endsWith(':*')) {
        const prefix = p.split(':')[0];
        return permission.startsWith(prefix + ':');
      }
      return false;
    });
  };
  
  /**
   * 檢查是否可以讀取資源
   */
  const canRead = (resourceType = 'all') => {
    return hasPermission(`read:${resourceType}`) || hasPermission('read:all');
  };
  
  /**
   * 檢查是否可以創建資源
   * @param {string} resourceType - 資源類型 (tokens, routes, etc.)
   */
  const canCreate = (resourceType) => {
    if (!isLoaded || !user) return false;
    
    // ADMIN 可以創建任何資源
    if (userRole === 'ADMIN') return true;
    
    // MANAGER 和 DEVELOPER 需要有團隊才能創建
    if (['MANAGER', 'DEVELOPER'].includes(userRole)) {
      if (!userTeam) return false; // 沒有團隊不能創建
      return hasPermission('create:team') || hasPermission(`create:${resourceType}`);
    }
    
    return false;
  };
  
  /**
   * 檢查是否可以編輯資源
   * @param {Object} resource - 資源對象，必須包含 createdBy 和 team
   */
  const canUpdate = (resource) => {
    if (!isLoaded || !user || !resource) return false;
    
    // ADMIN 可以編輯所有資源
    if (userRole === 'ADMIN') return true;
    
    // MANAGER 可以編輯自己團隊的資源
    if (userRole === 'MANAGER') {
      return resource.team === userTeam;
    }
    
    // DEVELOPER 只能編輯自己創建的資源
    if (userRole === 'DEVELOPER') {
      return resource.createdBy === user.id;
    }
    
    return false;
  };
  
  /**
   * 檢查是否可以刪除資源
   * @param {Object} resource - 資源對象
   */
  const canDelete = (resource) => {
    if (!isLoaded || !user || !resource) return false;
    
    // ADMIN 可以刪除所有資源
    if (userRole === 'ADMIN') return true;
    
    // MANAGER 可以刪除自己團隊的資源
    if (userRole === 'MANAGER') {
      return resource.team === userTeam;
    }
    
    // DEVELOPER 只能刪除自己創建的資源
    if (userRole === 'DEVELOPER') {
      return resource.createdBy === user.id;
    }
    
    return false;
  };
  
  /**
   * 檢查是否可以管理用戶
   * @param {Object} targetUser - 目標用戶對象（選填）
   */
  const canManageUsers = (targetUser = null) => {
    if (!isLoaded || !user) return false;
    
    // ADMIN 可以管理所有用戶
    if (userRole === 'ADMIN') {
      return hasPermission('manage:users');
    }
    
    // MANAGER 只能管理自己團隊的成員
    if (userRole === 'MANAGER') {
      if (!targetUser) return hasPermission('manage:team-members');
      const targetTeam = targetUser.publicMetadata?.[`${NAMESPACE}:team`];
      return targetTeam === userTeam && hasPermission('manage:team-members');
    }
    
    return false;
  };
  
  /**
   * 檢查是否是特定角色
   */
  const isRole = (role) => userRole === role;
  
  /**
   * 檢查是否至少是某個角色（角色層級）
   * 層級：ADMIN > MANAGER > DEVELOPER > VIEWER
   */
  const isAtLeast = (role) => {
    const hierarchy = ['VIEWER', 'DEVELOPER', 'MANAGER', 'ADMIN'];
    const userLevel = hierarchy.indexOf(userRole);
    const requiredLevel = hierarchy.indexOf(role);
    return userLevel >= requiredLevel;
  };
  
  /**
   * 獲取當前用戶可以看到的資源過濾條件
   * 用於列表查詢
   */
  const getResourceFilter = () => {
    if (userRole === 'ADMIN' || userRole === 'VIEWER') {
      // ADMIN 和 VIEWER 可以看所有資源
      return { scope: 'all' };
    }
    
    if (userRole === 'MANAGER') {
      // MANAGER 可以看所有，但只能操作自己團隊的
      return { scope: 'all', editableTeam: userTeam };
    }
    
    if (userRole === 'DEVELOPER') {
      // DEVELOPER 可以看所有，但只能操作自己的
      return { scope: 'all', editableOwner: user.id };
    }
    
    return { scope: 'none' };
  };
  
  return {
    // 基本信息
    isLoaded,
    userId: user?.id,
    userRole,
    userTeam,
    roleConfig: ROLES[userRole],
    
    // 角色檢查
    isRole,
    isAtLeast,
    isAdmin: userRole === 'ADMIN',
    isManager: userRole === 'MANAGER',
    isDeveloper: userRole === 'DEVELOPER',
    isViewer: userRole === 'VIEWER',
    
    // 權限檢查
    hasPermission,
    canRead,
    canCreate,
    canUpdate,
    canDelete,
    canManageUsers,
    
    // 工具函數
    getResourceFilter
  };
};


