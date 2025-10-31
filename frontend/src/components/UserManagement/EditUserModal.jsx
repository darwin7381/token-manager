import { useState } from 'react';
import { Shield, Users as UsersIcon } from 'lucide-react';
import { ROLES, TEAMS, getRoleInfo, getTeamInfo } from '../../constants/roles';
import { usePermissions } from '../../hooks/usePermissions';

export default function EditUserModal({ user, onClose, onSave }) {
  const { isAdmin } = usePermissions();
  
  const currentRole = user.publicMetadata?.['tokenManager:role'] || 'VIEWER';
  const currentTeam = user.publicMetadata?.['tokenManager:team'] || '';
  
  const [role, setRole] = useState(currentRole);
  const [team, setTeam] = useState(currentTeam);
  const [saving, setSaving] = useState(false);

  const roleInfo = getRoleInfo(role);
  const requiresTeam = ['MANAGER', 'DEVELOPER'].includes(role);

  const handleSave = async () => {
    // 驗證
    if (requiresTeam && !team) {
      alert(`${role} 角色必須指定團隊`);
      return;
    }

    try {
      setSaving(true);
      await onSave(user.id, {
        role,
        team: requiresTeam ? team : null
      });
    } catch (error) {
      console.error('Failed to save user:', error);
      alert('保存失敗：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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

        {/* 角色選擇 */}
        <div className="form-group">
          <label>
            <Shield size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            角色
          </label>
          <select 
            value={role} 
            onChange={(e) => {
              setRole(e.target.value);
              // 如果選擇不需要團隊的角色，清空團隊
              if (!['MANAGER', 'DEVELOPER'].includes(e.target.value)) {
                setTeam('');
              }
            }}
            disabled={!isAdmin && role === 'ADMIN'} // 非 Admin 不能設定 Admin
          >
            {Object.values(ROLES).map(r => (
              <option key={r.id} value={r.id}>
                {r.icon} {r.name}
              </option>
            ))}
          </select>
          <small>
            {roleInfo.description}
          </small>
        </div>

        {/* 團隊選擇 */}
        {requiresTeam && (
          <div className="form-group">
            <label>
              <UsersIcon size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              團隊 <span style={{ color: 'var(--accent-danger)' }}>*</span>
            </label>
            <select 
              value={team} 
              onChange={(e) => setTeam(e.target.value)}
              required
            >
              <option value="">請選擇團隊</option>
              {Object.values(TEAMS).map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <small>
              {role} 角色必須指定團隊
            </small>
          </div>
        )}

        {/* 角色功能說明 */}
        <div style={{
          background: 'var(--bg-secondary)',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '24px'
        }}>
          <div style={{ 
            fontWeight: 600, 
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '20px' }}>{roleInfo.icon}</span>
            <span>{roleInfo.name}可以：</span>
          </div>
          <ul style={{ 
            margin: 0, 
            paddingLeft: '20px',
            color: 'var(--text-secondary)',
            fontSize: '14px'
          }}>
            {roleInfo.features.map((feature, index) => (
              <li key={index} style={{ marginBottom: '6px' }}>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* 按鈕 */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button 
            className="btn btn-secondary" 
            onClick={onClose}
            disabled={saving}
          >
            取消
          </button>
          <button 
            className="btn"
            onClick={handleSave}
            disabled={saving || (requiresTeam && !team)}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}


