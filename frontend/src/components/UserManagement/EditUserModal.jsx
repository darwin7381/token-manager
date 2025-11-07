import { useState, useEffect } from 'react';
import { Shield, Users as UsersIcon, Plus, X } from 'lucide-react';
import { ROLES, getRoleInfo } from '../../constants/roles';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '@clerk/clerk-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function EditUserModal({ user, onClose, onSave }) {
  const { getToken } = useAuth();
  const { getUserRoleInTeam, canEditUserInTeam, canRemoveUserFromTeam } = usePermissions();
  
  // 獲取用戶的團隊角色
  const userTeamRoles = user.publicMetadata?.['tokenManager:teamRoles'] || {};
  const userTeams = Object.keys(userTeamRoles);
  
  const [saving, setSaving] = useState(false);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeamId, setNewTeamId] = useState('');
  const [newTeamRole, setNewTeamRole] = useState('DEVELOPER');
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkRole, setBulkRole] = useState('DEVELOPER');

  // 獲取當前用戶可以管理的團隊
  const myTeams = usePermissions().getUserTeams();
  const myTeamRoles = usePermissions().getAllTeamRoles();
  
  // 動態獲取所有團隊
  const [allTeams, setAllTeams] = useState([]);
  
  useEffect(() => {
    fetchAllTeams();
  }, []);
  
  const fetchAllTeams = async () => {
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
        setAllTeams(data);
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };
  
  const getTeamById = (teamId) => {
    return allTeams.find(t => t.id === teamId);
  };

  const handleUpdateRole = async (teamId, newRole) => {
    try {
      setSaving(true);
      await onSave(user.id, {
        action: 'update',
        teamId,
        role: newRole
      });
    } catch (error) {
      console.error('Failed to update role:', error);
      alert('更新失敗：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFromTeam = async (teamId) => {
    const teamInfo = getTeamById(teamId);
    const teamName = teamInfo?.name || teamId;
    
    if (!confirm(`確定要將此用戶從 ${teamName} 移除嗎？`)) {
      return;
    }
    
    try {
      setSaving(true);
      console.log('Removing user from team:', user.id, teamId);
      await onSave(user.id, {
        action: 'remove',
        teamId
      });
      console.log('Remove completed successfully');
    } catch (error) {
      console.error('Failed to remove from team:', error);
      alert('移除失敗：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddToTeam = async () => {
    if (!newTeamId) {
      alert('請選擇團隊');
      return;
    }
    
    try {
      setSaving(true);
      await onSave(user.id, {
        action: 'add',
        teamId: newTeamId,
        role: newTeamRole
      });
      setShowAddTeam(false);
      setNewTeamId('');
      setNewTeamRole('DEVELOPER');
    } catch (error) {
      console.error('Failed to add to team:', error);
      alert('添加失敗：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSetRole = async () => {
    if (!confirm(`確定要將此用戶設置為所有團隊的 ${bulkRole} 嗎？這將更新 ${availableTeamsToAdd.length + userTeams.length} 個團隊。`)) {
      return;
    }
    
    try {
      setSaving(true);
      
      // 獲取所有我可以管理的團隊（包括用戶已在的和可以添加的）
      const allManageableTeams = [...new Set([...userTeams.filter(t => {
        const myRole = myTeamRoles[t];
        return myRole === 'ADMIN' || myRole === 'MANAGER';
      }), ...availableTeamsToAdd])];
      
      // 批量設置
      for (const teamId of allManageableTeams) {
        const isNewTeam = !userTeams.includes(teamId);
        await onSave(user.id, {
          action: isNewTeam ? 'add' : 'update',
          teamId,
          role: bulkRole
        });
      }
      
      setShowBulkActions(false);
      alert(`成功將用戶設置為 ${allManageableTeams.length} 個團隊的 ${bulkRole}`);
    } catch (error) {
      console.error('Failed to bulk set role:', error);
      // 改進錯誤訊息顯示
      let errorMsg = '未知錯誤';
      if (error.message) {
        errorMsg = typeof error.message === 'string' ? error.message : JSON.stringify(error.message);
      } else if (error.detail) {
        errorMsg = typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail);
      } else {
        errorMsg = JSON.stringify(error);
      }
      alert('批量設置失敗：' + errorMsg);
    } finally {
      setSaving(false);
    }
  };

  // 獲取可以添加的團隊（存在於 DB 的團隊 + 我有權限 + 用戶還不在）
  const availableTeamsToAdd = allTeams.filter(team => {
    const myRole = myTeamRoles[team.id];
    // 只有 ADMIN 或 MANAGER 可以邀請人加入團隊
    return ['ADMIN', 'MANAGER'].includes(myRole) && !userTeams.includes(team.id);
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Shield size={24} />
            編輯用戶權限
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* 用戶信息 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          padding: '16px',
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          marginBottom: '24px'
        }}>
          <div className="user-avatar" style={{ width: '48px', height: '48px' }}>
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
            <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>
              {user.firstName} {user.lastName}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
              {user.email}
            </div>
          </div>
        </div>

        {/* 批量操作 */}
        {myTeams.length > 1 && (
          <div style={{ marginBottom: '16px' }}>
            {!showBulkActions ? (
              <button
                className="btn btn-secondary"
                onClick={() => setShowBulkActions(true)}
                disabled={saving}
                style={{ 
                  width: '100%', 
                  fontSize: '13px',
                  padding: '8px'
                }}
              >
                🌐 批量設置所有團隊角色
              </button>
            ) : (
              <div style={{
                padding: '12px',
                background: '#8b5cf615',
                borderRadius: '8px',
                border: '2px solid #8b5cf640'
              }}>
                <div style={{ fontSize: '13px', marginBottom: '8px', fontWeight: 600 }}>
                  批量設置為所有團隊的：
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    value={bulkRole}
                    onChange={(e) => setBulkRole(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      fontSize: '13px'
                    }}
                  >
                    <option value="DEVELOPER">💻 開發者</option>
                    <option value="MANAGER">⭐ 團隊管理者</option>
                    <option value="ADMIN">👑 系統管理員</option>
                    <option value="VIEWER">👁️ 檢視者</option>
                  </select>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowBulkActions(false)}
                    disabled={saving}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    取消
                  </button>
                  <button
                    className="btn"
                    onClick={handleBulkSetRole}
                    disabled={saving}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    {saving ? '設置中...' : '批量設置'}
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                  將更新你有權限管理的所有團隊
                </div>
              </div>
            )}
          </div>
        )}

        {/* 團隊角色列表 */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UsersIcon size={18} />
            團隊角色
          </h3>
          
          {userTeams.length === 0 ? (
            <div style={{
              padding: '24px',
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              textAlign: 'center',
              color: 'var(--text-tertiary)'
            }}>
              此用戶尚未加入任何團隊
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {userTeams
                .filter(teamId => {
                  // 只顯示存在於 DB 的團隊（過濾孤兒數據）
                  return getTeamById(teamId) !== undefined;
                })
                .map(teamId => {
                  const teamInfo = getTeamById(teamId);
                  const currentRole = userTeamRoles[teamId];
                  const canEdit = canEditUserInTeam(user, teamId);
                  const canRemove = canRemoveUserFromTeam(user, teamId);
                  const myRoleInTeam = getUserRoleInTeam(teamId);
                
                return (
                  <div 
                    key={teamId}
                    style={{
                      padding: '16px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '12px',
                      border: `2px solid ${canEdit ? teamInfo.color + '40' : 'var(--border-color)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: teamInfo.color, marginBottom: '4px', fontSize: '15px' }}>
                          {teamInfo.name}
                        </div>
                        {myRoleInTeam && (
                          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                            你的角色：{getRoleInfo(myRoleInTeam).name}
                          </div>
                        )}
                      </div>
                      
                      {canRemove && (
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={() => handleRemoveFromTeam(teamId)}
                          disabled={saving}
                          style={{ padding: '4px 8px' }}
                          title="從此團隊移除"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ fontSize: '14px', color: 'var(--text-secondary)', minWidth: '80px' }}>
                        角色：
                      </label>
                      <select
                        value={currentRole}
                        onChange={(e) => handleUpdateRole(teamId, e.target.value)}
                        disabled={!canEdit || saving}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: canEdit ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                          cursor: canEdit ? 'pointer' : 'not-allowed',
                          opacity: canEdit ? 1 : 0.6
                        }}
                      >
                        {Object.values(ROLES).map(r => {
                          // ADMIN 可以選任何角色
                          // MANAGER 不能設置 ADMIN/MANAGER
                          const selectable = !myRoleInTeam || myRoleInTeam === 'ADMIN' || !['ADMIN', 'MANAGER'].includes(r.id);
                          
                          return (
                            <option key={r.id} value={r.id} disabled={!selectable}>
                              {r.icon} {r.name} {!selectable ? '(無權限)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    
                    {!canEdit && (
                      <div style={{ 
                        marginTop: '8px', 
                        fontSize: '12px', 
                        color: 'var(--accent-danger)',
                        fontStyle: 'italic'
                      }}>
                        {!myRoleInTeam ? '你不在此團隊' : '權限不足'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 添加到新團隊 */}
        {availableTeamsToAdd.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            {!showAddTeam ? (
              <button
                className="btn btn-secondary"
                onClick={() => setShowAddTeam(true)}
                disabled={saving}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Plus size={18} />
                添加到新團隊
              </button>
            ) : (
              <div style={{
                padding: '16px',
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '2px solid var(--accent-primary)'
              }}>
                <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>添加到新團隊</h4>
                
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '13px', marginBottom: '6px', display: 'block' }}>選擇團隊</label>
                  <select
                    value={newTeamId}
                    onChange={(e) => setNewTeamId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <option value="">請選擇團隊...</option>
                    {availableTeamsToAdd.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.icon} {team.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '13px', marginBottom: '6px', display: 'block' }}>分配角色</label>
                  <select
                    value={newTeamRole}
                    onChange={(e) => setNewTeamRole(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    {Object.values(ROLES).map(r => {
                      const myRoleInSelectedTeam = newTeamId ? getUserRoleInTeam(newTeamId) : null;
                      // MANAGER 不能分配 ADMIN/MANAGER
                      const selectable = !myRoleInSelectedTeam || myRoleInSelectedTeam === 'ADMIN' || !['ADMIN', 'MANAGER'].includes(r.id);
                      
                      return (
                        <option key={r.id} value={r.id} disabled={!selectable}>
                          {r.icon} {r.name} {!selectable ? '(無權限)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowAddTeam(false);
                      setNewTeamId('');
                      setNewTeamRole('DEVELOPER');
                    }}
                    disabled={saving}
                    style={{ flex: 1 }}
                  >
                    取消
                  </button>
                  <button
                    className="btn"
                    onClick={handleAddToTeam}
                    disabled={saving || !newTeamId}
                    style={{ flex: 1 }}
                  >
                    {saving ? '添加中...' : '添加'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 關閉按鈕 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            className="btn btn-secondary" 
            onClick={onClose}
            disabled={saving}
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
