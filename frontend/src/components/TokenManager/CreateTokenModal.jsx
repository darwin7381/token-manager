import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { createToken, fetchTeams } from '../../services/api';
import ScopeSelector from './ScopeSelector';

export default function CreateTokenModal({ onClose, onCreated }) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [name, setName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [description, setDescription] = useState('');
  const [teams, setTeams] = useState([]);
  const [scopes, setScopes] = useState(['*']);
  const [expiresDays, setExpiresDays] = useState(90);
  const [neverExpires, setNeverExpires] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [showScopeSelector, setShowScopeSelector] = useState(false);

  // 獲取用戶所屬的團隊
  useEffect(() => {
    const loadTeams = async () => {
      try {
        const token = await getToken();
        const allTeams = await fetchTeams(token);
        const userTeamRoles = user?.publicMetadata?.['tokenManager:teamRoles'] || {};
        
        // 篩選用戶所屬的團隊
        const userTeams = allTeams.filter(team => userTeamRoles[team.id]);
        setTeams(userTeams);
        
        // 如果只有一個團隊，自動選擇
        if (userTeams.length === 1) {
          setTeamId(userTeams[0].id);
        }
      } catch (error) {
        console.error('Failed to load teams:', error);
      }
    };
    
    if (user) {
      loadTeams();
    }
  }, [user, getToken]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await getToken();
      const data = await createToken({
        name,
        team_id: teamId,
        description,
        scopes,
        expires_days: neverExpires ? null : (expiresDays || 90),
      }, token);
      
      setNewToken(data.token);
    } catch (error) {
      alert('錯誤: ' + error.message);
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (newToken) {
      if (confirm('Token 已創建，確定要關閉嗎？請確保已複製 Token。')) {
        onCreated();
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>{newToken ? '✅ Token 創建成功' : '創建新 Token'}</h2>
          <button className="modal-close" onClick={handleClose}>&times;</button>
        </div>

        {!newToken ? (
          <form onSubmit={handleSubmit} style={{ maxHeight: '70vh', overflowY: 'auto', padding: '5px' }}>
            <div className="form-group">
              <label>名稱 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如: Marketing-API-Key"
                required
              />
            </div>

            <div className="form-group">
              <label>所屬團隊 *</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                required
              >
                <option value="">選擇團隊</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.icon} {team.name} ({team.id})
                  </option>
                ))}
              </select>
              <small>Token 將屬於此團隊，該團隊的 ADMIN/MANAGER 可以管理它</small>
            </div>

            <div className="form-group">
              <label>權限範圍 *</label>
              <div style={{ marginBottom: '10px' }}>
                <button
                  type="button"
                  className={`btn btn-small ${scopes.length === 1 && scopes[0] === '*' ? '' : 'btn-secondary'}`}
                  onClick={() => setScopes(['*'])}
                >
                  全部權限 (*)
                </button>
                <button
                  type="button"
                  className={`btn btn-small ${scopes.length === 1 && scopes[0] === '*' ? 'btn-secondary' : ''}`}
                  onClick={() => setShowScopeSelector(true)}
                >
                  選擇路由/標籤
                </button>
              </div>
              <div className="tags-display">
                {scopes.map((scope) => (
                  <span
                    key={scope}
                    className={`badge ${
                      scope === '*'
                        ? 'badge-success'
                        : scope.startsWith('tag:')
                        ? 'badge-warning'
                        : 'badge-info'
                    }`}
                  >
                    {scope}
                  </span>
                ))}
              </div>
              <small>可以選擇具體路徑 (如: image) 或標籤 (如: tag:media)</small>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  checked={neverExpires}
                  onChange={(e) => setNeverExpires(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                永不過期
              </label>
            </div>

            {!neverExpires && (
              <div className="form-group">
                <label>過期天數</label>
                <input
                  type="number"
                  value={expiresDays}
                  onChange={(e) => setExpiresDays(parseInt(e.target.value) || 90)}
                  placeholder="90"
                  min="1"
                  max="3650"
                />
                <small>留空或設為 90 天</small>
              </div>
            )}

            <div className="form-group">
              <label>描述或筆記（可選）</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例如：用於 n8n 自動化工作流程的圖片處理服務"
                rows="3"
                maxLength="500"
              />
              <small>可以記錄此 Token 的用途、使用場景等資訊</small>
            </div>

            <div style={{ marginTop: '20px' }}>
              <button type="submit" className="btn" disabled={loading}>
                {loading ? '創建中...' : '創建 Token'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleClose}>
                取消
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div 
              className="token-warning-box"
              style={{ 
                backgroundColor: 'var(--bg-secondary)', 
                border: '2px solid var(--accent-warning)', 
                padding: '15px', 
                borderRadius: '8px',
                marginBottom: '20px'
              }}
            >
              <p style={{ 
                margin: '0 0 10px 0', 
                fontWeight: 'bold', 
                color: 'var(--accent-warning)' 
              }}>
                ⚠️ 請立即複製此 Token！
              </p>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div 
                  className="token-display-box"
                  style={{ 
                    flex: 1,
                    backgroundColor: 'var(--bg-tertiary)', 
                    color: 'var(--accent-success)', 
                    padding: '12px 15px', 
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    wordBreak: 'break-all',
                    userSelect: 'all',
                    cursor: 'text',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  {newToken}
                </div>
                <button
                  className="btn btn-success"
                  onClick={() => {
                    navigator.clipboard.writeText(newToken);
                    alert('✅ Token 已複製到剪貼簿！');
                  }}
                  style={{ flexShrink: 0 }}
                >
                  📋 複製
                </button>
              </div>
            </div>

            <div 
              className="token-usage-info"
              style={{ 
                backgroundColor: 'var(--bg-tertiary)', 
                padding: '15px', 
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '14px',
                border: '1px solid var(--border-color)'
              }}
            >
              <strong style={{ color: 'var(--text-primary)' }}>💡 使用方式：</strong>
              <ol style={{ 
                margin: '10px 0 0 0', 
                paddingLeft: '20px',
                color: 'var(--text-secondary)'
              }}>
                <li>點擊上方「複製」按鈕複製 Token</li>
                <li>在 n8n 中設定 HTTP Request Header: <code style={{ 
                  backgroundColor: 'var(--bg-primary)',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  color: 'var(--accent-primary)',
                  fontSize: '13px'
                }}>X-API-Key</code></li>
                <li>Header 值貼上剛才複製的 Token</li>
                <li>調用路由，例如: <code style={{ 
                  backgroundColor: 'var(--bg-primary)',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  color: 'var(--accent-success)',
                  fontSize: '12px'
                }}>https://your-worker.workers.dev/api/image/upload</code></li>
              </ol>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn"
                onClick={handleClose}
              >
                完成
              </button>
            </div>
          </div>
        )}

        {showScopeSelector && (
          <ScopeSelector
            selectedScopes={scopes}
            onSave={(newScopes) => {
              setScopes(newScopes);
              setShowScopeSelector(false);
            }}
            onClose={() => setShowScopeSelector(false)}
          />
        )}
      </div>
    </div>
  );
}

