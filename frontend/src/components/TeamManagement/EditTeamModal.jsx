import { useState, useEffect } from 'react';
import { Users, Trash2, UserPlus, X } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { ROLES, getRoleInfo } from '../../constants/roles';
import { usePermissions } from '../../hooks/usePermissions';

const API_URL = import.meta.env.VITE_API_URL || '${API_URL}';

export default function EditTeamModal({ team, onClose, onSave }) {
  const { getToken } = useAuth();
  const { getUserRoleInTeam, userId } = usePermissions();
  
  const [formData, setFormData] = useState({
    name: team.name,
    description: team.description || '',
    color: team.color,
    icon: team.icon || ''
  });
  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('DEVELOPER');

  const myRoleInTeam = getUserRoleInTeam(team.id);
  const canManageMembers = myRoleInTeam === 'ADMIN' || myRoleInTeam === 'MANAGER';

  useEffect(() => {
    fetchMembers();
    fetchAllUsers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      
      const response = await fetch(`${API_URL}/api/teams/${team.id}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const token = await getToken();
      const response = await fetch('${API_URL}/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAllUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleUpdateTeamInfo = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      await onSave(formData);
    } catch (error) {
      // 錯誤已在父組件處理
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMemberRole = async (userId, newRole) => {
    try {
      setSaving(true);
      const token = await getToken();
      
      const response = await fetch(`${API_URL}/api/users/${userId}/team-role`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          team_id: team.id,
          role: newRole
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail);
      }
      
      console.log('Role updated, refreshing members...');
      
      // 重新獲取成員列表
      await fetchMembers();
      
      console.log('Members refreshed');
    } catch (error) {
      console.error('Failed to update role:', error);
      alert('更新角色失敗：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (userId, userName) => {
    console.log('handleRemoveMember called:', userId, userName);
    
    if (!confirm(`確定要將 ${userName} 從此團隊移除嗎？`)) {
      console.log('User cancelled removal');
      return;
    }
    
    try {
      setSaving(true);
      const token = await getToken();
      
      console.log('Removing member:', userId, 'from team:', team.id);
      
      const response = await fetch(`${API_URL}/api/users/${userId}/team-membership/${team.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Remove response status:', response.status);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Remove failed:', error);
        throw new Error(error.detail);
      }
      
      console.log('Remove successful, refreshing members...');
      await fetchMembers();
      console.log('Members refreshed');
    } catch (error) {
      console.error('handleRemoveMember error:', error);
      alert('移除成員失敗：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) {
      alert('請選擇用戶');
      return;
    }
    
    try {
      setSaving(true);
      const token = await getToken();
      
      const response = await fetch(`${API_URL}/api/users/${selectedUserId}/team-membership`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          team_id: team.id,
          role: selectedRole
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail);
      }
      
      setShowAddMember(false);
      setSelectedUserId('');
      setSelectedRole('DEVELOPER');
      await fetchMembers();
    } catch (error) {
      alert('添加成員失敗：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // 按角色分組成員
  const membersByRole = {
    'ADMIN': members.filter(m => m.role === 'ADMIN'),
    'MANAGER': members.filter(m => m.role === 'MANAGER'),
    'DEVELOPER': members.filter(m => m.role === 'DEVELOPER'),
    'VIEWER': members.filter(m => m.role === 'VIEWER')
  };

  // 可以添加的用戶（不在此團隊的用戶）
  const memberIds = members.map(m => m.id);
  const availableUsers = allUsers.filter(u => !memberIds.includes(u.id));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Users size={24} />
            編輯團隊
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* 基本信息 */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>基本信息</h3>
          <form onSubmit={handleUpdateTeamInfo}>
            {/* 團隊 ID（不可修改） */}
            <div className="form-group">
              <label>團隊 ID</label>
              <input
                type="text"
                value={team.id}
                disabled
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              />
              <small>ID 創建後不可修改</small>
            </div>

            {/* 團隊名稱 */}
            <div className="form-group">
              <label>團隊名稱 <span style={{ color: 'var(--accent-danger)' }}>*</span></label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            {/* 描述 */}
            <div className="form-group">
              <label>描述</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="2"
              />
            </div>

            {/* 顏色和圖標 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
              <div className="form-group">
                <label>顏色</label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  style={{ width: '100%', height: '40px', cursor: 'pointer' }}
                />
              </div>

              <div className="form-group">
                <label>圖標 Emoji</label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  maxLength="2"
                />
              </div>
            </div>

            <button 
              type="submit"
              className="btn"
              disabled={saving || !formData.name}
              style={{ width: '100%' }}
            >
              {saving ? '保存中...' : '保存基本信息'}
            </button>
          </form>
        </div>

        {/* 成員管理 */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', margin: 0 }}>
              成員管理 ({members.length} 人)
            </h3>
            {canManageMembers && (
              <button
                className="btn btn-secondary btn-small"
                onClick={() => setShowAddMember(true)}
                disabled={saving}
              >
                <UserPlus size={14} /> 添加成員
              </button>
            )}
          </div>

          {/* 添加成員表單 */}
          {showAddMember && (
            <div style={{
              padding: '12px',
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              marginBottom: '16px',
              border: '2px solid var(--accent-primary)'
            }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', display: 'block', marginBottom: '6px' }}>選擇用戶</label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    style={{ width: '100%', padding: '8px' }}
                  >
                    <option value="">請選擇...</option>
                    {availableUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ width: '140px' }}>
                  <label style={{ fontSize: '13px', display: 'block', marginBottom: '6px' }}>角色</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    style={{ width: '100%', padding: '8px' }}
                  >
                    {Object.values(ROLES).map(r => {
                      // MANAGER 不能分配 ADMIN/MANAGER
                      const selectable = myRoleInTeam === 'ADMIN' || !['ADMIN', 'MANAGER'].includes(r.id);
                      return (
                        <option key={r.id} value={r.id} disabled={!selectable}>
                          {r.icon} {r.name}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <button className="btn btn-secondary" onClick={() => setShowAddMember(false)}>取消</button>
                <button className="btn" onClick={handleAddMember} disabled={!selectedUserId}>添加</button>
              </div>
            </div>
          )}

          {/* 成員列表（按角色分組） */}
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              載入成員...
            </div>
          ) : members.length === 0 ? (
            <div style={{ 
              padding: '32px 20px', 
              textAlign: 'center',
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              border: '2px dashed var(--border-color)'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>👥</div>
              <div style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '15px' }}>
                此團隊還沒有成員
              </div>
              {!myRoleInTeam && (
                <button
                  className="btn"
                  onClick={async () => {
                    if (confirm('確定要認領此團隊並成為 ADMIN 嗎？')) {
                      try {
                        setSaving(true);
                        const token = await getToken();
                        const response = await fetch(`${API_URL}/api/users/${userId}/team-membership`, {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({
                            team_id: team.id,
                            role: 'ADMIN'
                          })
                        });
                        
                        if (!response.ok) {
                          const error = await response.json();
                          console.error('Claim failed:', error);
                          throw new Error(error.detail || 'Unknown error');
                        }
                        
                        const result = await response.json();
                        console.log('Claim success:', result);
                        
                        alert('認領成功！請重新整理頁面以更新你的權限。');
                        window.location.reload();
                      } catch (error) {
                        console.error('Claim error:', error);
                        alert('認領失敗：' + error.message + '\n\n請查看瀏覽器 Console 以獲取詳細錯誤信息。');
                      } finally {
                        setSaving(false);
                      }
                    }
                  }}
                  disabled={saving}
                >
                  🚀 認領此團隊（成為 ADMIN）
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {['ADMIN', 'MANAGER', 'DEVELOPER', 'VIEWER'].map(roleName => {
                const roleMembers = membersByRole[roleName];
                if (roleMembers.length === 0) return null;
                
                const roleInfo = getRoleInfo(roleName);
                
                return (
                  <div key={roleName}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: roleInfo.color,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span>{roleInfo.icon}</span>
                      <span>{roleInfo.name}</span>
                      <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-tertiary)' }}>
                        ({roleMembers.length})
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {roleMembers.map(member => (
                        <div
                          key={member.id}
                          style={{
                            padding: '12px',
                            background: 'var(--bg-secondary)',
                            borderRadius: '8px',
                            border: `1px solid ${roleInfo.color}30`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                            {member.imageUrl ? (
                              <img 
                                src={member.imageUrl}
                                alt={member.firstName}
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '6px',
                                  objectFit: 'cover'
                                }}
                              />
                            ) : (
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                background: roleInfo.color + '20',
                                color: roleInfo.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 600
                              }}>
                                {member.firstName?.charAt(0) || 'U'}
                              </div>
                            )}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: '14px' }}>
                                {member.firstName} {member.lastName}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                {member.email}
                              </div>
                            </div>
                          </div>
                          
                          {canManageMembers && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {/* 角色選擇器 */}
                              <select
                                value={member.role}
                                onChange={(e) => handleUpdateMemberRole(member.id, e.target.value)}
                                disabled={saving || (myRoleInTeam === 'MANAGER' && ['ADMIN', 'MANAGER'].includes(member.role))}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color)',
                                  fontSize: '13px',
                                  cursor: 'pointer'
                                }}
                              >
                                {Object.values(ROLES).map(r => {
                                  // MANAGER 不能設置 ADMIN/MANAGER
                                  const selectable = myRoleInTeam === 'ADMIN' || !['ADMIN', 'MANAGER'].includes(r.id);
                                  return (
                                    <option key={r.id} value={r.id} disabled={!selectable}>
                                      {r.icon} {r.name}
                                    </option>
                                  );
                                })}
                              </select>
                              
                              {/* 移除按鈕 */}
                              <button
                                className="btn btn-secondary btn-small"
                                onClick={() => handleRemoveMember(member.id, `${member.firstName} ${member.lastName}`)}
                                disabled={saving || (myRoleInTeam === 'MANAGER' && ['ADMIN', 'MANAGER'].includes(member.role))}
                                style={{
                                  padding: '6px 8px',
                                  color: 'var(--accent-danger)'
                                }}
                                title="移除成員"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 關閉按鈕 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          <button 
            className="btn btn-secondary" 
            onClick={onClose}
            disabled={saving}
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
