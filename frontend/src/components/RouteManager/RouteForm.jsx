import { useState } from 'react';
import { Plus, Shield } from 'lucide-react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { createRoute } from '../../services/api';
import TagInput from './TagInput';

export default function RouteForm({ onRouteCreated }) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [backendUrl, setBackendUrl] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState([]);
  const [backendAuthType, setBackendAuthType] = useState('none');
  const [authConfig, setAuthConfig] = useState({});
  const [loading, setLoading] = useState(false);

  // 檢查用戶是否有 Core Team 權限
  const teamRoles = user?.publicMetadata?.['tokenManager:teamRoles'] || {};
  const globalRole = user?.publicMetadata?.['tokenManager:globalRole'];
  const coreRole = teamRoles['core-team'];
  
  const canCreate = globalRole === 'ADMIN' || 
                    (coreRole && ['ADMIN', 'MANAGER', 'DEVELOPER'].includes(coreRole));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await getToken();
      
      // 分離配置和實際密鑰
      const authSecrets = {};
      const authConfigToSend = {};
      
      if (backendAuthType === 'bearer' && authConfig.token_ref && authConfig.token_value) {
        authConfigToSend.token_ref = authConfig.token_ref;
        authSecrets[authConfig.token_ref] = authConfig.token_value;
      } else if (backendAuthType === 'api-key' && authConfig.key_ref && authConfig.key_value) {
        authConfigToSend.key_ref = authConfig.key_ref;
        if (authConfig.header_name) authConfigToSend.header_name = authConfig.header_name;
        authSecrets[authConfig.key_ref] = authConfig.key_value;
      } else if (backendAuthType === 'basic' && authConfig.username_ref && authConfig.password_ref &&
                 authConfig.username_value && authConfig.password_value) {
        authConfigToSend.username_ref = authConfig.username_ref;
        authConfigToSend.password_ref = authConfig.password_ref;
        authSecrets[authConfig.username_ref] = authConfig.username_value;
        authSecrets[authConfig.password_ref] = authConfig.password_value;
      }
      
      await createRoute({
        name,
        path,
        backend_url: backendUrl,
        description,
        tags,
        backend_auth_type: backendAuthType,
        backend_auth_config: backendAuthType !== 'none' ? authConfigToSend : null,
        backend_auth_secrets: Object.keys(authSecrets).length > 0 ? authSecrets : null,
      }, token);
      
      setName('');
      setPath('');
      setBackendUrl('');
      setDescription('');
      setTags([]);
      setBackendAuthType('none');
      setAuthConfig({});
      
      if (onRouteCreated) onRouteCreated();
    } catch (error) {
      alert('錯誤: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!canCreate) {
    return (
      <div className="section">
        <div className="alert" style={{ 
          backgroundColor: '#fff3cd', 
          border: '1px solid #ffc107', 
          padding: '15px', 
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Shield size={20} color="#856404" />
          <div>
            <strong>需要 Core Team 權限</strong>
            <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#856404' }}>
              只有 Core Team 的 ADMIN, MANAGER 或 DEVELOPER 可以創建路由。
              請聯繫系統管理員將你加入 Core Team。
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <h2><Plus size={20} /> 新增微服務路由</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>名稱 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如: 圖片處理服務"
            required
          />
        </div>

        <div className="form-group">
          <label>路徑 * (必須以 / 開頭)</label>
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="例如: /api/image"
            pattern="^/.*"
            required
          />
        </div>

        <div className="form-group">
          <label>後端 URL *</label>
          <input
            type="text"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="例如: https://image-service.railway.app"
            required
          />
        </div>

        <div className="form-group">
          <label>描述</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例如: 圖片處理服務"
          />
        </div>

        <div className="form-group">
          <label>標籤/分類</label>
          <TagInput tags={tags} onChange={setTags} />
          <small>用於權限分組管理，例如: media, premium, internal</small>
        </div>

        <div className="form-group">
          <label>後端服務認證方式</label>
          <select value={backendAuthType} onChange={(e) => setBackendAuthType(e.target.value)}>
            <option value="none">無需認證</option>
            <option value="bearer">Bearer Token</option>
            <option value="api-key">API Key</option>
            <option value="basic">Basic Auth</option>
          </select>
          <small>選擇後端微服務需要的認證方式</small>
        </div>

        {backendAuthType === 'bearer' && (
          <>
            <div className="form-group">
              <label>環境變數名稱（代號）*</label>
              <input
                type="text"
                value={authConfig.token_ref || ''}
                onChange={(e) => setAuthConfig({...authConfig, token_ref: e.target.value})}
                placeholder="例如: OPENAI_API_KEY"
                required
              />
              <small>這個名稱會儲存在資料庫中，用於引用實際的 Key</small>
            </div>
            
            <div className="form-group">
              <label>實際的 API Token *</label>
              <input
                type="password"
                value={authConfig.token_value || ''}
                onChange={(e) => setAuthConfig({...authConfig, token_value: e.target.value})}
                placeholder="例如: sk-proj-xxxxxxxxxxxxx"
                required
              />
              <small style={{ color: '#059669' }}>
                ✅ 這個值會直接儲存到 Cloudflare KV（加密），不會進入資料庫
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
              <small>自訂 API Key 的 Header 名稱，留空使用預設值</small>
            </div>
            
            <div className="form-group">
              <label>環境變數名稱（代號）*</label>
              <input
                type="text"
                value={authConfig.key_ref || ''}
                onChange={(e) => setAuthConfig({...authConfig, key_ref: e.target.value})}
                placeholder="例如: BACKEND_API_KEY"
                required
              />
              <small>這個名稱會儲存在資料庫中</small>
            </div>
            
            <div className="form-group">
              <label>實際的 API Key *</label>
              <input
                type="password"
                value={authConfig.key_value || ''}
                onChange={(e) => setAuthConfig({...authConfig, key_value: e.target.value})}
                placeholder="實際的 API Key"
                required
              />
              <small style={{ color: '#059669' }}>
                ✅ 這個值會直接儲存到 Cloudflare KV（加密），不會進入資料庫
              </small>
            </div>
          </>
        )}

        {backendAuthType === 'basic' && (
          <>
            <div className="form-group">
              <label>Username 環境變數名稱 *</label>
              <input
                type="text"
                value={authConfig.username_ref || ''}
                onChange={(e) => setAuthConfig({...authConfig, username_ref: e.target.value})}
                placeholder="例如: SERVICE_USERNAME"
                required
              />
            </div>
            
            <div className="form-group">
              <label>實際的 Username *</label>
              <input
                type="text"
                value={authConfig.username_value || ''}
                onChange={(e) => setAuthConfig({...authConfig, username_value: e.target.value})}
                placeholder="實際的用戶名"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Password 環境變數名稱 *</label>
              <input
                type="text"
                value={authConfig.password_ref || ''}
                onChange={(e) => setAuthConfig({...authConfig, password_ref: e.target.value})}
                placeholder="例如: SERVICE_PASSWORD"
                required
              />
            </div>
            
            <div className="form-group">
              <label>實際的 Password *</label>
              <input
                type="password"
                value={authConfig.password_value || ''}
                onChange={(e) => setAuthConfig({...authConfig, password_value: e.target.value})}
                placeholder="實際的密碼"
                required
              />
              <small style={{ color: '#059669' }}>
                ✅ 這些值會直接儲存到 Cloudflare KV（加密），不會進入資料庫
              </small>
            </div>
          </>
        )}

        <button type="submit" className="btn" disabled={loading}>
          {loading ? '新增中...' : '新增路由'}
        </button>
      </form>
    </div>
  );
}

