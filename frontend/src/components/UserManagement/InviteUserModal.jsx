import { useState, useEffect } from 'react';
import { UserPlus, Mail } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { ROLES, getRoleInfo } from '../../constants/roles';
import { usePermissions } from '../../hooks/usePermissions';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function InviteUserModal({ onClose }) {
  const { getToken } = useAuth();
  const { getAllTeamRoles } = usePermissions();
  const [email, setEmail] = useState('');
  const [teams, setTeams] = useState([]);
  const [selectedTeamRoles, setSelectedTeamRoles] = useState({});
  const [inviting, setInviting] = useState(false);

  const myTeamRoles = getAllTeamRoles();
  const myTeamsAsAdmin = Object.entries(myTeamRoles)
    .filter(([_, role]) => role === 'ADMIN' || role === 'MANAGER')
    .map(([teamId, _]) => teamId);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/teams', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTeams(data);
        
        // 預設選擇第一個我可以管理的團隊
        if (myTeamsAsAdmin.length > 0) {
          setSelectedTeamRoles({
            [myTeamsAsAdmin[0]]: 'DEVELOPER'
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  const handleToggleTeam = (teamId) => {
    setSelectedTeamRoles(prev => {
      const newRoles = { ...prev };
      if (newRoles[teamId]) {
        delete newRoles[teamId];
      } else {
        newRoles[teamId] = 'DEVELOPER';
      }
      return newRoles;
    });
  };

  const handleRoleChange = (teamId, role) => {
    setSelectedTeamRoles(prev => ({
      ...prev,
      [teamId]: role
    }));
  };

  const handleInvite = async () => {
    if (!email) {
      alert('請輸入 Email');
      return;
    }
    
    if (Object.keys(selectedTeamRoles).length === 0) {
      alert('請至少選擇一個團隊');
      return;
    }
    
    try {
      setInviting(true);
      
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/invitations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          team_roles: selectedTeamRoles
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to send invitation');
      }
      
      alert(`成功發送邀請到 ${email}\n\n用戶將收到郵件邀請，點擊連結後可以使用 Google 登入。`);
      onClose();
      
    } catch (error) {
      console.error('Failed to invite user:', error);
      alert('發送邀請失敗：' + error.message);
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <UserPlus size={24} />
            邀請用戶
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Email 輸入 */}
        <div className="form-group">
          <label>
            <Mail size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            Email <span style={{ color: 'var(--accent-danger)' }}>*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
          />
          <small>用戶將收到郵件邀請，可使用 Google 帳號登入</small>
        </div>

        {/* 選擇團隊和角色 */}
        <div className="form-group">
          <label>
            初始團隊和角色 <span style={{ color: 'var(--accent-danger)' }}>*</span>
          </label>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '12px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {teams
              .filter(team => myTeamsAsAdmin.includes(team.id))
              .map(team => {
                const isSelected = selectedTeamRoles[team.id] !== undefined;
                
                return (
                  <div 
                    key={team.id}
                    style={{
                      padding: '12px',
                      background: isSelected ? `${team.color}10` : 'transparent',
                      borderRadius: '8px',
                      border: isSelected ? `2px solid ${team.color}40` : '2px solid var(--border-color)'
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleTeam(team.id)}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: isSelected ? team.color : 'var(--text-primary)' }}>
                          {team.icon} {team.name}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                          {team.description}
                        </div>
                      </div>
                      {isSelected && (
                        <select
                          value={selectedTeamRoles[team.id]}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleRoleChange(team.id, e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            fontSize: '13px'
                          }}
                        >
                          {Object.values(ROLES).map(r => (
                            <option key={r.id} value={r.id}>
                              {r.icon} {r.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </label>
                  </div>
                );
              })}
          </div>
          
          {Object.keys(selectedTeamRoles).length > 0 && (
            <small style={{ display: 'block', marginTop: '8px', color: 'var(--text-secondary)' }}>
              已選擇 {Object.keys(selectedTeamRoles).length} 個團隊
            </small>
          )}
        </div>

        {/* 說明 */}
        <div style={{
          padding: '12px',
          background: '#3b82f615',
          borderRadius: '8px',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          marginBottom: '20px'
        }}>
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>邀請流程：</div>
          <ol style={{ margin: 0, paddingLeft: '20px' }}>
            <li>系統發送邀請郵件到此 Email</li>
            <li>用戶點擊郵件中的連結</li>
            <li>用戶使用 Google 帳號登入</li>
            <li>自動分配所選的團隊和角色</li>
          </ol>
        </div>

        {/* 按鈕 */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button 
            type="button"
            className="btn btn-secondary" 
            onClick={onClose}
            disabled={inviting}
          >
            取消
          </button>
          <button 
            type="button"
            className="btn"
            onClick={handleInvite}
            disabled={inviting || !email || Object.keys(selectedTeamRoles).length === 0}
          >
            {inviting ? '發送中...' : '發送邀請'}
          </button>
        </div>
      </div>
    </div>
  );
}

