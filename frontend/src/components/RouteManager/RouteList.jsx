import { useState, useEffect } from 'react';
import { List, RefreshCw, Edit, Trash2, Copy, Check, Lock, Unlock } from 'lucide-react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { listRoutes, deleteRoute, listTokens, revealToken } from '../../services/api';
import EditRouteModal from './EditRouteModal';

export default function RouteList({ onUpdate }) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [routes, setRoutes] = useState([]);
  const [filteredRoutes, setFilteredRoutes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingRoute, setEditingRoute] = useState(null);
  const [copiedCurl, setCopiedCurl] = useState(null);
  const [copiedPath, setCopiedPath] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(null);

  // 檢查用戶權限
  const teamRoles = user?.publicMetadata?.['tokenManager:teamRoles'] || {};
  const globalRole = user?.publicMetadata?.['tokenManager:globalRole'];
  const coreRole = teamRoles['core-team'];
  
  const canEdit = globalRole === 'ADMIN' || (coreRole && ['ADMIN', 'MANAGER'].includes(coreRole));
  const canDelete = globalRole === 'ADMIN' || (coreRole === 'ADMIN');

  const loadRoutes = async () => {
    try {
      setError(null);
      const token = await getToken();
      const data = await listRoutes(token);
      setRoutes(data);
      setFilteredRoutes(data);
    } catch (error) {
      console.error('Failed to load routes:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoutes();
  }, []);

  // 搜尋和排序
  useEffect(() => {
    let filtered = [...routes];
    
    // 搜尋過濾
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(route => 
        (route.name && route.name.toLowerCase().includes(query)) ||
        route.path.toLowerCase().includes(query) ||
        (route.description && route.description.toLowerCase().includes(query)) ||
        (route.tags && route.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }
    
    // 排序
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (sortField === 'created_at') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    setFilteredRoutes(filtered);
  }, [routes, searchQuery, sortField, sortOrder]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('確定要刪除此路由？')) return;
    
    try {
      const token = await getToken();
      await deleteRoute(id, token);
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
  
  if (error) {
    return (
      <div className="section">
        <h2><List size={20} /> 現有路由</h2>
        <div className="empty-state">
          <p>載入失敗: {error}</p>
          <button className="btn btn-secondary btn-small" onClick={loadRoutes} style={{ marginTop: '10px' }}>
            <RefreshCw size={14} /> 重試
          </button>
        </div>
      </div>
    );
  }
  
  if (routes.length === 0) {
    return <div className="section"><div className="empty-state">尚無路由</div></div>;
  }

  return (
    <div className="section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}><List size={20} /> 現有路由</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="搜尋路由、名稱、標籤..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              width: '250px'
            }}
          />
          <button className="btn btn-secondary btn-small" onClick={loadRoutes}>
            <RefreshCw size={14} /> 刷新
          </button>
        </div>
      </div>
      
      <div className="table-container">
        <table style={{ minWidth: '1400px' }}>
        <thead>
          <tr>
            <th 
              style={{ width: '60px', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => handleSort('id')}
            >
              ID {sortField === 'id' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th 
              style={{ width: '140px', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => handleSort('name')}
            >
              名稱 {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th 
              style={{ width: '150px', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => handleSort('path')}
            >
              路徑 {sortField === 'path' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th 
              style={{ width: '200px', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => handleSort('backend_url')}
            >
              後端 URL {sortField === 'backend_url' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th 
              style={{ width: '110px', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => handleSort('backend_auth_type')}
            >
              認證 {sortField === 'backend_auth_type' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th style={{ width: '150px' }}>標籤</th>
            <th 
              style={{ width: '150px', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => handleSort('description')}
            >
              描述 {sortField === 'description' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th 
              style={{ width: '140px', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => handleSort('created_at')}
            >
              創建時間 {sortField === 'created_at' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th style={{ width: '200px' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {filteredRoutes.map((route) => (
            <tr key={route.id}>
              <td>{route.id}</td>
              <td>
                <strong style={{ fontSize: '14px' }}>{route.name || '-'}</strong>
              </td>
              <td>
                <div
                  style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    backgroundColor: copiedPath === route.id ? '#d1fae5' : '#f3f4f6',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'background-color 0.3s, color 0.3s'
                  }}
                  onClick={() => {
                    navigator.clipboard.writeText(route.path);
                    setCopiedPath(route.id);
                    setTimeout(() => setCopiedPath(null), 1500);
                  }}
                  title="點擊複製"
                >
                  {copiedPath === route.id ? (
                    <><Check size={12} style={{ color: '#059669' }} /> <span style={{ color: '#059669' }}>Copied!</span></>
                  ) : (
                    <code style={{ fontSize: '12px' }}>{route.path}</code>
                  )}
                </div>
              </td>
              <td>
                <div 
                  style={{ 
                    maxWidth: '200px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    backgroundColor: copiedUrl === route.id ? '#d1fae5' : 'transparent',
                    padding: '2px 4px',
                    borderRadius: '3px',
                    transition: 'background-color 0.3s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  onClick={() => {
                    navigator.clipboard.writeText(route.backend_url);
                    setCopiedUrl(route.id);
                    setTimeout(() => setCopiedUrl(null), 1500);
                  }}
                  title={copiedUrl === route.id ? 'Copied!' : `點擊複製：${route.backend_url}`}
                >
                  {copiedUrl === route.id ? (
                    <><Check size={12} style={{ color: '#059669' }} /> <span style={{ fontSize: '11px', color: '#059669' }}>Copied!</span></>
                  ) : (
                    <code style={{ fontSize: '11px', color: '#6b7280' }}>
                      {route.backend_url}
                    </code>
                  )}
                </div>
              </td>
              <td>
                {route.backend_auth_type && route.backend_auth_type !== 'none' ? (
                  <span className="badge" style={{ 
                    backgroundColor: '#8b5cf6', 
                    color: 'white',
                    fontSize: '11px',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Lock size={12} /> {route.backend_auth_type}
                  </span>
                ) : (
                  <span className="badge" style={{ 
                    backgroundColor: '#10b981', 
                    color: 'white',
                    fontSize: '11px',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Unlock size={12} /> 無
                  </span>
                )}
              </td>
              <td>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {(route.tags || []).length > 0 ? (
                    route.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="badge badge-warning" style={{ fontSize: '11px' }}>
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: '#999', fontSize: '12px' }}>-</span>
                  )}
                  {route.tags && route.tags.length > 3 && (
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>
                      +{route.tags.length - 3}
                    </span>
                  )}
                </div>
              </td>
              <td style={{ fontSize: '12px', color: '#6b7280', maxWidth: '150px', wordWrap: 'break-word' }}>
                {route.description || '-'}
              </td>
              <td style={{ fontSize: '12px' }}>{formatDate(route.created_at)}</td>
              <td>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button
                    className="btn btn-small"
                    onClick={() => {
                      const curl = `curl -X POST https://api-gateway.cryptoxlab.workers.dev${route.path} -H "X-API-Key: ntk_YOUR_TOKEN" -H "Content-Type: application/json" -d '{}'`;
                      navigator.clipboard.writeText(curl);
                      setCopiedCurl(route.id);
                      setTimeout(() => setCopiedCurl(null), 2000);
                    }}
                    style={{ whiteSpace: 'nowrap', width: '100%', justifyContent: 'center' }}
                    title="複製 cURL 命令"
                  >
                    {copiedCurl === route.id ? (
                      <><Check size={14} /> 已複製</>
                    ) : (
                      <><Copy size={14} /> Copy cURL</>
                    )}
                  </button>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {canEdit && (
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => setEditingRoute(route)}
                      >
                        <Edit size={14} /> 編輯
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className="btn btn-danger btn-small"
                        onClick={() => handleDelete(route.id)}
                      >
                        <Trash2 size={14} /> 刪除
                      </button>
                    )}
                    {!canEdit && !canDelete && (
                      <span style={{ color: '#999', fontSize: '12px' }}>唯讀</span>
                    )}
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      
      {filteredRoutes.length === 0 && searchQuery && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          color: '#6b7280',
          fontSize: '14px'
        }}>
          找不到符合「{searchQuery}」的路由
        </div>
      )}

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

