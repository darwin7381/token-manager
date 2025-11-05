import { useState, useEffect } from 'react';
import { List, RefreshCw, Edit, Trash2, Copy } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { listTokens, deleteToken, fetchTeams, revealToken, listRoutes, listTags } from '../../services/api';
import EditTokenModal from './EditTokenModal';

export default function TokenList({ onUpdate }) {
  const { getToken } = useAuth();
  const [tokens, setTokens] = useState([]);
  const [teams, setTeams] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingToken, setEditingToken] = useState(null);
  const [revealedToken, setRevealedToken] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const loadTokens = async () => {
    try {
      const token = await getToken();
      const [tokensData, teamsData, routesData, tagsData] = await Promise.all([
        listTokens(token),
        fetchTeams(token),
        listRoutes(token),
        listTags(token)
      ]);
      setTokens(tokensData);
      setTeams(teamsData);
      setRoutes(routesData);
      setAvailableTags(tagsData.tags || []);
    } catch (error) {
      console.error('Failed to load tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  // 檢查 scope 是否有效
  const isScopeValid = (scope) => {
    if (scope === '*') return true;
    
    if (scope.startsWith('tag:')) {
      const tagName = scope.substring(4);
      return availableTags.includes(tagName);
    }
    
    // 檢查是否是有效的路由路徑（如 'openai' 匹配 '/api/openai'）
    const matchingRoute = routes.find(r => {
      const pathParts = r.path.split('/').filter(p => p);
      // /api/openai -> ['api', 'openai']
      // scope 'openai' 應該匹配第二部分
      return pathParts.length >= 2 && pathParts[1] === scope;
    });
    return !!matchingRoute;
  };

  const getTeamDisplay = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return teamId || '未設定';
    return `${team.icon} ${team.name} (${team.id})`;
  };

  useEffect(() => {
    loadTokens();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('確定要撤銷此 Token？此操作無法撤銷。')) return;
    
    try {
      const token = await getToken();
      await deleteToken(id, token);
      loadTokens();
      if (onUpdate) onUpdate();
    } catch (error) {
      alert('刪除失敗: ' + error.message);
    }
  };

  const handleCopyToken = async (tokenId, tokenName) => {
    // 先打開彈窗（顯示 loading）
    setRevealedToken({ id: tokenId, name: tokenName, token: null, loading: true });
    
    try {
      const authToken = await getToken();
      const data = await revealToken(tokenId, authToken);
      
      // 更新彈窗狀態（顯示 Token）
      setRevealedToken({ id: tokenId, name: tokenName, token: data.token, loading: false });
    } catch (err) {
      console.error('獲取 Token 失敗:', err);
      alert('獲取 Token 失敗: ' + err.message);
      setRevealedToken(null);
    }
  };

  const maskToken = (token) => {
    if (!token || token.length < 20) return token;
    // 顯示前12個字符 + ... + 後6個字符
    return `${token.substring(0, 12)}...${token.substring(token.length - 6)}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) return <div className="section"><div className="loading">載入中...</div></div>;
  
  if (tokens.length === 0) {
    return <div className="section"><div className="empty-state">尚無 Token</div></div>;
  }

  return (
    <div className="section">
      <h2><List size={20} /> 現有 Tokens</h2>
      <button className="btn btn-secondary btn-small" onClick={loadTokens}>
        <RefreshCw size={14} /> 刷新
      </button>
      
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>名稱</th>
            <th>團隊</th>
            <th>權限</th>
            <th>創建時間</th>
            <th>過期時間</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => (
            <tr key={token.id}>
              <td>{token.id}</td>
              <td><strong>{token.name}</strong></td>
              <td>
                <span className="badge badge-info">{getTeamDisplay(token.team_id)}</span>
              </td>
              <td>
                {token.scopes.map((scope) => {
                  const isValid = isScopeValid(scope);
                  return (
                  <span
                    key={scope}
                    className={`badge ${
                      scope === '*'
                        ? 'badge-success'
                        : scope.startsWith('tag:')
                        ? 'badge-warning'
                        : 'badge-info'
                    }`}
                      style={!isValid ? { 
                        border: '2px solid #ef4444'
                      } : {}}
                      title={!isValid ? '⚠️ 此路由或標籤不存在' : ''}
                  >
                      {!isValid && '⚠️ '}{scope}
                  </span>
                  );
                })}
              </td>
              <td>{formatDate(token.created_at)}</td>
              <td>{token.expires_at ? formatDate(token.expires_at) : '永不過期'}</td>
              <td>
                <button
                  className="btn btn-small"
                  onClick={() => handleCopyToken(token.id, token.name)}
                  title="複製 Token"
                >
                  <Copy size={14} /> 複製
                </button>
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => setEditingToken(token)}
                >
                  <Edit size={14} /> 編輯
                </button>
                <button
                  className="btn btn-danger btn-small"
                  onClick={() => handleDelete(token.id)}
                >
                  <Trash2 size={14} /> 撤銷
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingToken && (
        <EditTokenModal
          token={editingToken}
          teams={teams}
          onClose={() => setEditingToken(null)}
          onSaved={() => {
            setEditingToken(null);
            loadTokens();
            if (onUpdate) onUpdate();
          }}
        />
      )}

      {revealedToken && (
        <div className="modal-overlay" onClick={() => setRevealedToken(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Token: {revealedToken.name}</h2>
              <button className="modal-close" onClick={() => setRevealedToken(null)}>&times;</button>
            </div>
            
            {revealedToken.loading ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <div className="loading">載入中...</div>
              </div>
            ) : (
              <>
                <div style={{ 
                  backgroundColor: '#fef3c7', 
                  border: '2px solid #f59e0b', 
                  padding: '15px', 
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}>
                  <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#92400e' }}>
                    ⚠️ 點擊複製按鈕將 Token 複製到剪貼簿
                  </p>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ 
                      flex: 1,
                      backgroundColor: '#1f2937', 
                      color: '#10b981', 
                      padding: '12px 15px', 
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      fontSize: '14px',
                      wordBreak: 'break-all',
                      userSelect: 'none',
                      cursor: 'default'
                    }}>
                      {maskToken(revealedToken.token)}
                    </div>
                    <button
                      className="btn btn-success"
                      onClick={() => {
                        navigator.clipboard.writeText(revealedToken.token);
                        setCopySuccess(true);
                        setTimeout(() => setCopySuccess(false), 2000);
                      }}
                      style={{ flexShrink: 0 }}
                    >
                      {copySuccess ? '✅ 已複製' : '📋 複製'}
                    </button>
                  </div>
                </div>

                <div style={{ 
                  backgroundColor: '#f0f9ff', 
                  padding: '15px', 
                  borderRadius: '8px',
                  marginBottom: '20px',
                  fontSize: '14px'
                }}>
                  <strong>💡 使用方式：</strong>
                  <ol style={{ margin: '10px 0 0 0', paddingLeft: '20px' }}>
                    <li>點擊上方「複製」按鈕</li>
                    <li>在 n8n 中設定 HTTP Request Header: <code>X-API-Key</code></li>
                    <li>Header 值貼上此 Token</li>
                  </ol>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn" onClick={() => {
                    setRevealedToken(null);
                    setCopySuccess(false);
                  }}>
                    完成
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

