import { useState, useEffect } from 'react';
import { Users, Shield, Search, UserPlus } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { usePermissions } from '../../hooks/usePermissions';
import { ROLES, TEAMS, getRoleInfo, getTeamInfo } from '../../constants/roles';
import { updateUserRole } from '../../services/api';
import EditUserModal from './EditUserModal';

export default function UserManagement() {
  const { canManageUsers, isAdmin } = usePermissions();
  const { getToken } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 獲取 Clerk session token
      const token = await getToken();
      
      if (!token) {
        throw new Error('無法獲取認證 token，請重新登入');
      }
      
      console.log('Fetching users with token:', token ? 'Token exists' : 'No token');
      
      // 調用後端 API 獲取用戶列表
      const response = await fetch('http://localhost:8000/api/users', {
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

  const handleUpdateUser = async (userId, roleData) => {
    try {
      setError(null);
      
      // 獲取 Clerk session token
      const token = await getToken();
      
      if (!token) {
        throw new Error('無法獲取認證 token，請重新登入');
      }
      
      console.log('Updating user role:', { userId, roleData });
      
      // 調用後端 API 更新用戶
      const result = await updateUserRole(userId, roleData, token);
      
      console.log('User role updated successfully:', result);
      
      // 重新獲取用戶列表以顯示最新資料
      await fetchUsers();
      
      // 關閉 modal
      setShowEditModal(false);
      
    } catch (error) {
      console.error('Failed to update user:', error);
      setError(`更新用戶失敗：${error.message}`);
      // 不關閉 modal，讓用戶可以重試
      throw error; // 拋出錯誤讓 EditUserModal 也能處理
    }
  };

  // 從 metadata 獲取角色和團隊
  const getUserRole = (user) => {
    return user.publicMetadata?.['tokenManager:role'] || 'VIEWER';
  };

  const getUserTeam = (user) => {
    return user.publicMetadata?.['tokenManager:team'] || null;
  };

  // 過濾用戶
  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase();
    return (
      user.email?.toLowerCase().includes(query) ||
      user.firstName?.toLowerCase().includes(query) ||
      user.lastName?.toLowerCase().includes(query) ||
      getUserRole(user).toLowerCase().includes(query)
    );
  });

  if (!canManageUsers()) {
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
            <button className="btn">
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

      {/* 用戶列表 */}
      <div className="section">
        {loading ? (
          <div className="loading">載入用戶列表...</div>
        ) : error ? (
          <div className="error-message">
            ❌ 載入失敗：{error}
            <br />
            <small>請確保後端服務正在運行，並且已實現 /api/users 端點</small>
          </div>
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
                <th>角色</th>
                <th>團隊</th>
                <th>加入時間</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => {
                const role = getUserRole(user);
                const team = getUserTeam(user);
                const roleInfo = getRoleInfo(role);
                const teamInfo = team ? getTeamInfo(team) : null;
                const joinedAt = user.publicMetadata?.['tokenManager:joinedAt'];

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

                    {/* 角色 */}
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
                      {teamInfo ? (
                        <div 
                          className="badge badge-info"
                          style={{
                            backgroundColor: `${teamInfo.color}15`,
                            color: teamInfo.color,
                            borderColor: `${teamInfo.color}30`
                          }}
                        >
                          {teamInfo.name}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>-</span>
                      )}
                    </td>

                    {/* 加入時間 */}
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {joinedAt ? new Date(joinedAt).toLocaleDateString('zh-TW') : '-'}
                    </td>

                    {/* 操作 */}
                    <td>
                      {canManageUsers(user) && (
                        <button 
                          className="btn btn-secondary btn-small"
                          onClick={() => handleEditUser(user)}
                        >
                          編輯
                        </button>
                      )}
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
          onClose={() => setShowEditModal(false)}
          onSave={handleUpdateUser}
        />
      )}
    </div>
  );
}

