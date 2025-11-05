import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { updateRoute } from '../../services/api';
import TagInput from './TagInput';

export default function EditRouteModal({ route, onClose, onSaved }) {
  const { getToken } = useAuth();
  const [name, setName] = useState(route.name || '');
  const [backendUrl, setBackendUrl] = useState(route.backend_url);
  const [description, setDescription] = useState(route.description || '');
  const [tags, setTags] = useState(route.tags || []);
  const [backendAuthType, setBackendAuthType] = useState(route.backend_auth_type || 'none');
  const [authConfig, setAuthConfig] = useState(route.backend_auth_config || {});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await getToken();
      
      // 分離配置和實際密鑰（與 RouteForm 相同邏輯）
      const authSecrets = {};
      const authConfigToSend = {};
      
      if (backendAuthType === 'bearer' && authConfig.token_ref) {
        authConfigToSend.token_ref = authConfig.token_ref;
        if (authConfig.token_value) {
          authSecrets[authConfig.token_ref] = authConfig.token_value;
        }
      } else if (backendAuthType === 'api-key' && authConfig.key_ref) {
        authConfigToSend.key_ref = authConfig.key_ref;
        if (authConfig.header_name) authConfigToSend.header_name = authConfig.header_name;
        if (authConfig.key_value) {
          authSecrets[authConfig.key_ref] = authConfig.key_value;
        }
      } else if (backendAuthType === 'basic' && authConfig.username_ref && authConfig.password_ref) {
        authConfigToSend.username_ref = authConfig.username_ref;
        authConfigToSend.password_ref = authConfig.password_ref;
        if (authConfig.username_value && authConfig.password_value) {
          authSecrets[authConfig.username_ref] = authConfig.username_value;
          authSecrets[authConfig.password_ref] = authConfig.password_value;
        }
      }
      
      await updateRoute(route.id, {
        name,
        backend_url: backendUrl,
        description,
        tags,
        backend_auth_type: backendAuthType,
        backend_auth_config: backendAuthType !== 'none' ? authConfigToSend : null,
        backend_auth_secrets: Object.keys(authSecrets).length > 0 ? authSecrets : null,
      }, token);
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
          <h2>編輯路由</h2>
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
            <label>路徑 (不可修改)</label>
            <input type="text" value={route.path} disabled />
          </div>

          <div className="form-group">
            <label>後端 URL *</label>
            <input
              type="text"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>描述</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>標籤/分類</label>
            <TagInput tags={tags} onChange={setTags} />
          </div>

          <div className="form-group">
            <label>後端服務認證方式</label>
            <select value={backendAuthType} onChange={(e) => setBackendAuthType(e.target.value)}>
              <option value="none">無需認證</option>
              <option value="bearer">Bearer Token</option>
              <option value="api-key">API Key</option>
              <option value="basic">Basic Auth</option>
            </select>
          </div>

          {backendAuthType === 'bearer' && (
            <>
              <div className="form-group">
                <label>環境變數名稱（代號）</label>
                <input
                  type="text"
                  value={authConfig.token_ref || ''}
                  disabled
                  style={{ backgroundColor: '#f5f5f5' }}
                />
                <small>環境變數名稱不可修改</small>
              </div>
              
              <div className="form-group">
                <label>更新實際的 API Token（可選）</label>
                <input
                  type="password"
                  value={authConfig.token_value || ''}
                  onChange={(e) => setAuthConfig({...authConfig, token_value: e.target.value})}
                  placeholder="留空表示保持原有值"
                />
                <small style={{ color: '#6b7280' }}>
                  如需更新實際的 Token 值，請填入新值
                </small>
              </div>
            </>
          )}

          {backendAuthType === 'api-key' && (
            <>
              <div className="form-group">
                <label>Header 名稱（可選）</label>
                <input
                  type="text"
                  value={authConfig.header_name || ''}
                  onChange={(e) => setAuthConfig({...authConfig, header_name: e.target.value})}
                  placeholder="預設: X-API-Key"
                />
              </div>
              <div className="form-group">
                <label>環境變數名稱（代號）</label>
                <input
                  type="text"
                  value={authConfig.key_ref || ''}
                  disabled
                  style={{ backgroundColor: '#f5f5f5' }}
                />
                <small>環境變數名稱不可修改</small>
              </div>
              <div className="form-group">
                <label>更新實際的 API Key（可選）</label>
                <input
                  type="password"
                  value={authConfig.key_value || ''}
                  onChange={(e) => setAuthConfig({...authConfig, key_value: e.target.value})}
                  placeholder="留空表示保持原有值"
                />
              </div>
            </>
          )}

          {backendAuthType === 'basic' && (
            <>
              <div className="form-group">
                <label>Username 環境變數名稱</label>
                <input
                  type="text"
                  value={authConfig.username_ref || ''}
                  disabled
                  style={{ backgroundColor: '#f5f5f5' }}
                />
                <small>環境變數名稱不可修改</small>
              </div>
              <div className="form-group">
                <label>更新實際的 Username（可選）</label>
                <input
                  type="text"
                  value={authConfig.username_value || ''}
                  onChange={(e) => setAuthConfig({...authConfig, username_value: e.target.value})}
                  placeholder="留空表示保持原有值"
                />
              </div>
              <div className="form-group">
                <label>Password 環境變數名稱</label>
                <input
                  type="text"
                  value={authConfig.password_ref || ''}
                  disabled
                  style={{ backgroundColor: '#f5f5f5' }}
                />
                <small>環境變數名稱不可修改</small>
              </div>
              <div className="form-group">
                <label>更新實際的 Password（可選）</label>
                <input
                  type="password"
                  value={authConfig.password_value || ''}
                  onChange={(e) => setAuthConfig({...authConfig, password_value: e.target.value})}
                  placeholder="留空表示保持原有值"
                />
              </div>
            </>
          )}

          <div style={{ marginTop: '20px' }}>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? '保存中...' : '保存'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

