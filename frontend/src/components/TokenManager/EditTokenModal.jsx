import { useState } from 'react';
import { updateToken } from '../../services/api';
import ScopeSelector from './ScopeSelector';

export default function EditTokenModal({ token, onClose, onSaved }) {
  const [name, setName] = useState(token.name);
  const [department, setDepartment] = useState(token.department);
  const [scopes, setScopes] = useState(token.scopes);
  const [loading, setLoading] = useState(false);
  const [showScopeSelector, setShowScopeSelector] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateToken(token.id, { name, department, scopes });
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
            <label>部門 *</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
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

