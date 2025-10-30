import { useState, useEffect } from 'react';
import { List, RefreshCw, Edit, Trash2 } from 'lucide-react';
import { listTokens, deleteToken } from '../../services/api';
import EditTokenModal from './EditTokenModal';

export default function TokenList({ onUpdate }) {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingToken, setEditingToken] = useState(null);

  const loadTokens = async () => {
    try {
      const data = await listTokens();
      setTokens(data);
    } catch (error) {
      console.error('Failed to load tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTokens();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('確定要撤銷此 Token？此操作無法撤銷。')) return;
    
    try {
      await deleteToken(id);
      loadTokens();
      if (onUpdate) onUpdate();
    } catch (error) {
      alert('刪除失敗: ' + error.message);
    }
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
            <th>部門</th>
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
                <span className="badge badge-info">{token.department}</span>
              </td>
              <td>
                {token.scopes.map((scope) => (
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
              </td>
              <td>{formatDate(token.created_at)}</td>
              <td>{token.expires_at ? formatDate(token.expires_at) : '永不過期'}</td>
              <td>
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
          onClose={() => setEditingToken(null)}
          onSaved={() => {
            setEditingToken(null);
            loadTokens();
            if (onUpdate) onUpdate();
          }}
        />
      )}
    </div>
  );
}

