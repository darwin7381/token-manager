import { useState } from 'react';
import { Shield, Plus } from 'lucide-react';
import { createToken } from '../../services/api';
import ScopeSelector from './ScopeSelector';

export default function TokenForm({ onTokenCreated }) {
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [scopes, setScopes] = useState(['*']);
  const [expiresDays, setExpiresDays] = useState(90);
  const [loading, setLoading] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [showScopeSelector, setShowScopeSelector] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await createToken({
        name,
        department,
        scopes,
        expires_days: expiresDays || 90,
      });
      
      setNewToken(data.token);
      setName('');
      setDepartment('');
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
            placeholder="例如: Marketing-John"
            required
          />
        </div>

        <div className="form-group">
          <label>部門 *</label>
          <input
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="例如: marketing"
            required
          />
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
          <div className="token-value">{newToken}</div>
          <button
            className="btn btn-secondary btn-small"
            style={{ marginTop: '10px' }}
            onClick={() => setNewToken(null)}
          >
            關閉
          </button>
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

