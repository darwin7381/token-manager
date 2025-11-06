import { useState, useEffect } from 'react';
import { Users, Shield, Search, UserPlus } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { usePermissions } from '../../hooks/usePermissions';
import { getRoleInfo } from '../../constants/roles';
import { updateUserTeamRole, addUserToTeam, removeUserFromTeam } from '../../services/api';
import EditUserModal from './EditUserModal';
import InviteUserModal from './InviteUserModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function UserManagement() {
  const { canAccessUserManagement, isAdmin, getAllTeamRoles } = usePermissions();
  const { getToken } = useAuth();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);  // 動態獲取的團隊列表
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTeams();
    fetchUsers();
  }, []);

  const fetchTeams = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/teams`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTeams(data);
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = await getToken();
      
      if (!token) {
        throw new Error('無法獲取認證 token，請重新登入');
      }
      
      console.log('Fetching users...');
      
      const response = await fetch(`${API_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Fetched users:', data);
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleUserAction = async (userId, actionData) => {
    try {
      setError(null);
      
      const token = await getToken();
      
      if (!token) {
        throw new Error('無法獲取認證 token，請重新登入');
      }
      
      console.log('User action:', actionData);
      
      if (actionData.action === 'update') {
        // 更新團隊角色
        await updateUserTeamRole(userId, actionData.teamId, actionData.role, token);
      } else if (actionData.action === 'add') {
        // 添加到團隊
        await addUserToTeam(userId, actionData.teamId, actionData.role, token);
      } else if (actionData.action === 'remove') {
        // 從團隊移除
        await removeUserFromTeam(userId, actionData.teamId, token);
      }
      
      console.log('Action completed successfully');
      
      // 重新獲取用戶列表
      const response = await fetch(`${API_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const updatedUsers = await response.json();
        setUsers(updatedUsers);
        
        // 更新 Modal 中的 selectedUser 數據
        if (selectedUser && selectedUser.id === userId) {
          const updatedUser = updatedUsers.find(u => u.id === userId);
          if (updatedUser) {
            setSelectedUser(updatedUser);
          }
        }
      }
      
    } catch (error) {
      console.error('Failed to perform action:', error);
      setError(`操作失敗：${error.message}`);
      throw error;
    }
  };

  // 獲取用戶的團隊角色（Per-Team Roles 格式）
  const getUserTeamRoles = (user) => {
    return user.publicMetadata?.['tokenManager:teamRoles'] || {};
  };
  
  // 獲取用戶的最高角色（只考慮存在的團隊）
  const getUserHighestRole = (user) => {
    const teamRoles = getUserTeamRoles(user);
    
    // 只考慮存在於 DB 的團隊
    const validRoles = Object.entries(teamRoles)
      .filter(([teamId, _]) => teams.find(t => t.id === teamId))
      .map(([_, role]) => role);
    
    if (validRoles.length === 0) return 'VIEWER';
    
    const hierarchy = ['VIEWER', 'DEVELOPER', 'MANAGER', 'ADMIN'];
    let highest = 'VIEWER';
    
    validRoles.forEach(role => {
      if (hierarchy.indexOf(role) > hierarchy.indexOf(highest)) {
        highest = role;
      }
    });
    
    return highest;
  };
  
  // 獲取最後登入時間
  const getLastSignInAt = (user) => {
    return user.lastSignInAt;
  };

  // 過濾用戶
  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase();
    const highestRole = getUserHighestRole(user);
    return (
      user.email?.toLowerCase().includes(query) ||
      user.firstName?.toLowerCase().includes(query) ||
      user.lastName?.toLowerCase().includes(query) ||
      highestRole.toLowerCase().includes(query)
    );
  });

  if (!canAccessUserManagement()) {
    return (
      <div className="section">
        <h2><Shield size={20} /> 權限不足</h2>
        <p>你沒有權限訪問用戶管理功能。</p>
      </div>
    );
  }

  return (
    <div>
      {/* 頁面標題 */}
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>
            <Users size={24} /> 用戶管理
          </h2>
          {isAdmin && (
            <button 
              className="btn"
              onClick={() => setShowInviteModal(true)}
            >
              <UserPlus size={18} />
              邀請用戶
            </button>
          )}
        </div>

        {/* 搜尋框 */}
        <div className="search-box" style={{ maxWidth: '400px', marginBottom: '20px' }}>
          <Search className="search-icon" size={18} />
          <input
            type="search"
            className="search-input"
            placeholder="搜尋用戶..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 錯誤提示 */}
      {error && (
        <div className="section">
          <div className="error-message">
            ❌ {error}
          </div>
        </div>
      )}

      {/* 用戶列表 */}
      <div className="section">
        {loading ? (
          <div className="loading">載入用戶列表...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            {searchQuery ? '沒有找到符合的用戶' : '還沒有用戶'}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>用戶</th>
                <th>最高角色</th>
                <th>團隊</th>
                <th>最後登入</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => {
                const teamRoles = getUserTeamRoles(user);
                const userTeams = Object.keys(teamRoles);
                const highestRole = getUserHighestRole(user);
                const roleInfo = getRoleInfo(highestRole);
                const lastSignInAt = getLastSignInAt(user);
                
                // 檢查是否可以管理此用戶
                // 條件：至少可以編輯一個團隊 OR 可以邀請到我的團隊
                const myTeamRoles = getAllTeamRoles();
                const myTeams = Object.keys(myTeamRoles);
                
                // 檢查是否至少可以編輯一個現有團隊
                const canEditAnyTeam = userTeams.some(teamId => {
                  const myRole = myTeamRoles[teamId];
                  const targetRole = teamRoles[teamId];
                  
                  if (!myRole || !['ADMIN', 'MANAGER'].includes(myRole)) return false;
                  if (myRole === 'MANAGER' && ['ADMIN', 'MANAGER'].includes(targetRole)) return false;
                  
                  return true;
                });
                
                // 檢查是否可以邀請到我的團隊
                const canInviteToMyTeams = myTeams.some(teamId => {
                  const myRole = myTeamRoles[teamId];
                  // 如果我在這個團隊是 ADMIN/MANAGER，且目標用戶不在這個團隊
                  return ['ADMIN', 'MANAGER'].includes(myRole) && !userTeams.includes(teamId);
                });
                
                // 只要滿足任一條件就可以管理
                const canManage = canEditAnyTeam || canInviteToMyTeams;

                return (
                  <tr key={user.id}>
                    {/* 用戶信息 */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="user-avatar" style={{ width: '40px', height: '40px' }}>
                          {user.imageUrl ? (
                            <img 
                              src={user.imageUrl} 
                              alt={user.firstName} 
                              style={{ width: '100%', height: '100%', borderRadius: '8px', objectFit: 'cover' }}
                            />
                          ) : (
                            user.firstName?.charAt(0)?.toUpperCase() || 'U'
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: '2px' }}>
                            {user.firstName} {user.lastName}
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 最高角色 */}
                    <td>
                      <div 
                        className="badge" 
                        style={{ 
                          backgroundColor: `${roleInfo.color}15`,
                          color: roleInfo.color,
                          borderColor: `${roleInfo.color}30`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>{roleInfo.icon}</span>
                        <span>{roleInfo.name}</span>
                      </div>
                    </td>

                    {/* 團隊 */}
                    <td>
                      {userTeams.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {userTeams
                            .filter(teamId => {
                              // 只顯示存在於 DB 的團隊（自動過濾孤兒數據）
                              const teamInfo = teams.find(t => t.id === teamId);
                              return teamInfo !== undefined;
                            })
                            .map(teamId => {
                              // 從動態獲取的團隊列表中查找
                              const teamInfo = teams.find(t => t.id === teamId);
                              const role = teamRoles[teamId];
                              const roleInfo = getRoleInfo(role);
                            
                            return (
                              <div 
                                key={teamId}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '12px'
                                }}
                              >
                                <span 
                                  className="badge badge-info"
                                  style={{
                                    backgroundColor: `${teamInfo.color}15`,
                                    color: teamInfo.color,
                                    borderColor: `${teamInfo.color}30`,
                                    fontSize: '11px',
                                    padding: '2px 6px'
                                  }}
                                >
                                  {teamInfo.icon || '👥'} {teamInfo.name}
                                </span>
                                <span style={{ color: 'var(--text-tertiary)' }}>
                                  {roleInfo.icon} {role}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>-</span>
                      )}
                    </td>

                    {/* 最後登入時間 */}
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {lastSignInAt ? new Date(lastSignInAt).toLocaleDateString('zh-TW', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : '-'}
                    </td>

                    {/* 操作 */}
                    <td>
                      <button 
                        className="btn btn-secondary btn-small"
                        onClick={() => handleEditUser(user)}
                        disabled={!canManage}
                        style={{
                          opacity: canManage ? 1 : 0.5,
                          cursor: canManage ? 'pointer' : 'not-allowed'
                        }}
                        title={!canManage ? '你沒有權限管理此用戶' : ''}
                      >
                        編輯
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 編輯用戶 Modal */}
      {showEditModal && selectedUser && (
        <EditUserModal
          user={selectedUser}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
          }}
          onSave={handleUserAction}
        />
      )}

      {/* 邀請用戶 Modal */}
      {showInviteModal && (
        <InviteUserModal
          onClose={() => {
            setShowInviteModal(false);
            fetchUsers();  // 刷新列表（雖然新用戶要等註冊後才會出現）
          }}
        />
      )}
    </div>
  );
}
