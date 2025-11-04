import { useState, useEffect } from 'react';
import { Shield, Plus } from 'lucide-react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { createToken, fetchTeams } from '../../services/api';
import ScopeSelector from './ScopeSelector';

export default function TokenForm({ onTokenCreated }) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [name, setName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [teams, setTeams] = useState([]);
  const [scopes, setScopes] = useState(['*']);
  const [expiresDays, setExpiresDays] = useState(90);
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
        scopes,
        expires_days: expiresDays || 90,
      }, token);
      
      setNewToken(data.token);
      setName('');
      setTeamId(teams.length === 1 ? teams[0].id : '');
      setScopes(['*']);
      setExpiresDays(90);
      
      if (onTokenCreated) onTokenCreated();
    } catch (error) {
      alert('錯誤: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section">
      <h2><Plus size={20} /> 創建新 Token</h2>
      <form onSubmit={handleSubmit}>
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
          <label>過期天數 (留空表示 90 天)</label>
          <input
            type="number"
            value={expiresDays}
            onChange={(e) => setExpiresDays(parseInt(e.target.value) || 90)}
            placeholder="90"
            min="1"
            max="3650"
          />
        </div>

        <button type="submit" className="btn" disabled={loading}>
          {loading ? '創建中...' : '創建 Token'}
        </button>
      </form>

      {newToken && (
        <div className="token-display">
          <p className="warning">⚠️ 請立即保存此 Token！它只會顯示一次。</p>
          <div className="token-value" style={{ userSelect: 'all', cursor: 'text' }}>{newToken}</div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              className="btn btn-success btn-small"
              onClick={() => {
                navigator.clipboard.writeText(newToken);
                alert('✅ Token 已複製到剪貼簿！');
              }}
            >
              📋 複製 Token
            </button>
            <button
              className="btn btn-secondary btn-small"
              onClick={() => setNewToken(null)}
            >
              關閉
            </button>
          </div>
          <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f0f9ff', borderRadius: '6px', fontSize: '13px' }}>
            <strong>💡 使用方式：</strong>
            <ol style={{ margin: '5px 0 0 0', paddingLeft: '20px' }}>
              <li>複製上方的 Token</li>
              <li>在 n8n 中設定 HTTP Request Header: <code>X-API-Key: {newToken.substring(0, 20)}...</code></li>
              <li>調用路由，例如: <code>https://your-worker.workers.dev/api/image/upload</code></li>
            </ol>
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
  );
}
