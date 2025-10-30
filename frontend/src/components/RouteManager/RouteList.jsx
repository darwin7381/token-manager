import { useState, useEffect } from 'react';
import { List, RefreshCw, Edit, Trash2 } from 'lucide-react';
import { listRoutes, deleteRoute } from '../../services/api';
import EditRouteModal from './EditRouteModal';

export default function RouteList({ onUpdate }) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRoute, setEditingRoute] = useState(null);

  const loadRoutes = async () => {
    try {
      const data = await listRoutes();
      setRoutes(data);
    } catch (error) {
      console.error('Failed to load routes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoutes();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('確定要刪除此路由？')) return;
    
    try {
      await deleteRoute(id);
      loadRoutes();
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
  
  if (routes.length === 0) {
    return <div className="section"><div className="empty-state">尚無路由</div></div>;
  }

  return (
    <div className="section">
      <h2><List size={20} /> 現有路由</h2>
      <button className="btn btn-secondary btn-small" onClick={loadRoutes}>
        <RefreshCw size={14} /> 刷新
      </button>
      
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>名稱</th>
            <th>路徑</th>
            <th>後端 URL</th>
            <th>標籤</th>
            <th>描述</th>
            <th>創建時間</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((route) => (
            <tr key={route.id}>
              <td>{route.id}</td>
              <td><strong>{route.name || '-'}</strong></td>
              <td><code>{route.path}</code></td>
              <td><code style={{ wordBreak: 'break-all' }}>{route.backend_url}</code></td>
              <td>
                {(route.tags || []).length > 0 ? (
                  route.tags.map(tag => (
                    <span key={tag} className="badge badge-warning">{tag}</span>
                  ))
                ) : '-'}
              </td>
              <td>{route.description || '-'}</td>
              <td>{formatDate(route.created_at)}</td>
              <td>
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => setEditingRoute(route)}
                >
                  <Edit size={14} /> 編輯
                </button>
                <button
                  className="btn btn-danger btn-small"
                  onClick={() => handleDelete(route.id)}
                >
                  <Trash2 size={14} /> 刪除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingRoute && (
        <EditRouteModal
          route={editingRoute}
          onClose={() => setEditingRoute(null)}
          onSaved={() => {
            setEditingRoute(null);
            loadRoutes();
            if (onUpdate) onUpdate();
          }}
        />
      )}
    </div>
  );
}

