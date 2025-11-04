import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { updateToken } from '../../services/api';
import ScopeSelector from './ScopeSelector';

export default function EditTokenModal({ token, teams = [], onClose, onSaved }) {
  const { getToken } = useAuth();
  const [name, setName] = useState(token.name);
  const [description, setDescription] = useState(token.description || '');
  const [scopes, setScopes] = useState(token.scopes);
  const [loading, setLoading] = useState(false);
  const [showScopeSelector, setShowScopeSelector] = useState(false);

  const getTeamDisplay = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return teamId || '未設定';
    return `${team.icon} ${team.name} (${team.id})`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const authToken = await getToken();
      await updateToken(token.id, { name, description, scopes }, authToken);
      onSaved();
    } catch (error) {
      alert('更新失敗: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>編輯 Token</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>名稱 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>團隊</label>
            <input
              type="text"
              value={getTeamDisplay(token.team_id)}
              disabled
              style={{ backgroundColor: '#f5f5f5' }}
            />
            <small>團隊無法更改</small>
          </div>

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
                    scope === '*' ? 'badge-success' :
                    scope.startsWith('tag:') ? 'badge-warning' : 'badge-info'
                  }`}
                >
                  {scope}
                </span>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? '保存中...' : '保存'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              取消
            </button>
          </div>
        </form>

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

