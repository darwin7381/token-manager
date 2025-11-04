/**
 * 權限管理 Hook - Per-Team Roles 架構
 */

import { useUser } from '@clerk/clerk-react';
import { NAMESPACE, ROLES } from '../constants/roles';

export const usePermissions = () => {
  const { user, isLoaded } = useUser();
  
  // Debug: 檢查 metadata
  if (user && isLoaded) {
    console.log('Current user teamRoles:', user.publicMetadata?.['tokenManager:teamRoles']);
  }
  
  // ==================== Per-Team Roles Functions ====================
  
  /**
   * 獲取用戶在特定團隊的角色
   */
  const getUserRoleInTeam = (teamId) => {
    if (!user) return null;
    const teamRoles = user.publicMetadata?.[`${NAMESPACE}:teamRoles`] || {};
    const role = teamRoles[teamId];
    // null 表示已刪除
    return (role && role !== null) ? role : null;
  };
  
  /**
   * 獲取用戶所在的所有團隊
   */
  const getUserTeams = () => {
    if (!user) return [];
    const teamRoles = user.publicMetadata?.[`${NAMESPACE}:teamRoles`] || {};
    // 過濾掉 null（已刪除的）
    return Object.keys(teamRoles).filter(teamId => teamRoles[teamId] !== null);
  };
  
  /**
   * 獲取用戶的所有團隊角色映射
   */
  const getAllTeamRoles = () => {
    if (!user) return {};
    const teamRoles = user.publicMetadata?.[`${NAMESPACE}:teamRoles`] || {};
    // 過濾掉 null（已刪除的）
    const filtered = {};
    Object.entries(teamRoles).forEach(([teamId, role]) => {
      if (role !== null) {
        filtered[teamId] = role;
      }
    });
    return filtered;
  };
  
  /**
   * 獲取用戶的最高角色（用於頁面訪問控制）
   */
  const getHighestRole = () => {
    const teamRoles = getAllTeamRoles();
    const roles = Object.values(teamRoles);
    
    if (roles.length === 0) return 'VIEWER';
    
    const hierarchy = ['VIEWER', 'DEVELOPER', 'MANAGER', 'ADMIN'];
    let highest = 'VIEWER';
    
    roles.forEach(role => {
      if (hierarchy.indexOf(role) > hierarchy.indexOf(highest)) {
        highest = role;
      }
    });
    
    return highest;
  };
  
  // ==================== Permission Checks ====================
  
  /**
   * 檢查是否可以訪問用戶管理頁面
   * 基於最高角色
   */
  const canAccessUserManagement = () => {
    if (!isLoaded || !user) return false;
    const highestRole = getHighestRole();
    return highestRole === 'ADMIN' || highestRole === 'MANAGER';
  };
  
  /**
   * 檢查是否可以編輯某用戶在某團隊的角色
   */
  const canEditUserInTeam = (targetUser, teamId) => {
    if (!isLoaded || !user || !targetUser) return false;
    
    // 1. 獲取我在該團隊的角色
    const myRole = getUserRoleInTeam(teamId);
    
    if (!myRole) return false;
    if (!['ADMIN', 'MANAGER'].includes(myRole)) return false;
    
    // 2. 獲取目標用戶在該團隊的角色
    const targetTeamRoles = targetUser.publicMetadata?.[`${NAMESPACE}:teamRoles`] || {};
    const targetRole = targetTeamRoles[teamId];
    
    // 3. MANAGER 不能編輯 ADMIN 或 MANAGER
    if (myRole === 'MANAGER' && ['ADMIN', 'MANAGER'].includes(targetRole)) {
      return false;
    }
    
    return true;
  };
  
  /**
   * 檢查是否可以添加用戶到團隊
   */
  const canAddUserToTeam = (teamId) => {
    if (!isLoaded || !user) return false;
    
    const myRole = getUserRoleInTeam(teamId);
    return myRole === 'ADMIN' || myRole === 'MANAGER';
  };
  
  /**
   * 檢查是否可以從團隊移除用戶
   */
  const canRemoveUserFromTeam = (targetUser, teamId) => {
    if (!isLoaded || !user || !targetUser) return false;
    
    const myRole = getUserRoleInTeam(teamId);
    if (!['ADMIN', 'MANAGER'].includes(myRole)) return false;
    
    const targetTeamRoles = targetUser.publicMetadata?.[`${NAMESPACE}:teamRoles`] || {};
    const targetRole = targetTeamRoles[teamId];
    
    // MANAGER 不能移除 ADMIN/MANAGER
    if (myRole === 'MANAGER' && ['ADMIN', 'MANAGER'].includes(targetRole)) {
      return false;
    }
    
    return true;
  };
  
  // ==================== Resource Permissions ====================
  
  /**
   * 檢查是否可以訪問特定團隊的資源
   */
  const hasAccessToTeam = (teamId) => {
    const myRole = getUserRoleInTeam(teamId);
    return myRole !== null;  // 只要在團隊就能訪問
  };
  
  /**
   * 檢查是否可以創建資源
   */
  const canCreate = (teamId) => {
    if (!isLoaded || !user) return false;
    
    const myRole = getUserRoleInTeam(teamId);
    if (!myRole) return false;
    
    // VIEWER 不能創建
    return myRole !== 'VIEWER';
  };
  
  /**
   * 檢查是否可以編輯資源
   */
  const canUpdate = (resource) => {
    if (!isLoaded || !user || !resource) return false;
    
    const myRole = getUserRoleInTeam(resource.team);
    if (!myRole) return false;
    
    // ADMIN 和 MANAGER 可以編輯團隊內所有資源
    if (myRole === 'ADMIN' || myRole === 'MANAGER') {
      return true;
    }
    
    // DEVELOPER 只能編輯自己創建的
    if (myRole === 'DEVELOPER') {
      return resource.createdBy === user.id;
    }
    
    return false;  // VIEWER 不能編輯
  };
  
  /**
   * 檢查是否可以刪除資源
   */
  const canDelete = (resource) => {
    if (!isLoaded || !user || !resource) return false;
    
    const myRole = getUserRoleInTeam(resource.team);
    if (!myRole) return false;
    
    // ADMIN 和 MANAGER 可以刪除團隊內所有資源
    if (myRole === 'ADMIN' || myRole === 'MANAGER') {
      return true;
    }
    
    // DEVELOPER 只能刪除自己創建的
    if (myRole === 'DEVELOPER') {
      return resource.createdBy === user.id;
    }
    
    return false;  // VIEWER 不能刪除
  };
  
  // ==================== Role Checks ====================
  
  const highestRole = getHighestRole();
  
  return {
    // 基本信息
    isLoaded,
    userId: user?.id,
    highestRole,
    userTeams: getUserTeams(),
    allTeamRoles: getAllTeamRoles(),
    
    // 角色檢查
    isAdmin: highestRole === 'ADMIN',
    isManager: highestRole === 'MANAGER',
    isDeveloper: highestRole === 'DEVELOPER',
    isViewer: highestRole === 'VIEWER',
    
    // Per-Team 函數
    getUserRoleInTeam,
    getUserTeams,
    getAllTeamRoles,
    getHighestRole,
    
    // 用戶管理權限
    canAccessUserManagement,
    canEditUserInTeam,
    canAddUserToTeam,
    canRemoveUserFromTeam,
    
    // 資源權限
    hasAccessToTeam,
    canCreate,
    canUpdate,
    canDelete
  };
};
