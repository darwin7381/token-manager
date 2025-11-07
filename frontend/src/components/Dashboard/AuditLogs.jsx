import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Search, Filter, Download, RefreshCw, FileText, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import './AuditLogs.css';

function AuditLogs() {
  const { getToken } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 篩選狀態
  const [filters, setFilters] = useState({
    action: '',
    entity_type: '',
  });
  
  // 分頁狀態
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0
  });

  useEffect(() => {
    loadLogs();
  }, [filters, pagination.offset]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
      });
      
      if (filters.action) params.append('action', filters.action);
      if (filters.entity_type) params.append('entity_type', filters.entity_type);
      
      const response = await fetch(`${API_URL}/api/dashboard/audit-logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load audit logs');
      }

      const result = await response.json();
      setLogs(result.data);
      setPagination(prev => ({ ...prev, total: result.total }));
    } catch (err) {
      console.error('Error loading audit logs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, offset: 0 })); // 重置到第一頁
  };

  const handlePageChange = (newOffset) => {
    setPagination(prev => ({ ...prev, offset: newOffset }));
  };

  const exportLogs = () => {
    const csv = [
      ['時間', '操作', '實體類型', '實體 ID', '詳情'],
      ...logs.map(log => [
        format(parseISO(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        log.action,
        log.entity_type,
        log.entity_id || '',
        JSON.stringify(log.details || {})
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div className="audit-logs-container">
      <div className="audit-logs-header">
        <div>
          <h1>📋 審計日誌</h1>
          <p className="subtitle">查看所有系統操作記錄</p>
        </div>
        <div className="header-actions">
          <button onClick={loadLogs} className="btn-secondary">
            <RefreshCw size={16} />
            刷新
          </button>
          <button onClick={exportLogs} className="btn-secondary" disabled={logs.length === 0}>
            <Download size={16} />
            匯出 CSV
          </button>
        </div>
      </div>

      {/* 篩選器 */}
      <div className="filters-section">
        <div className="filter-group">
          <label>
            <Filter size={16} />
            操作類型
          </label>
          <select 
            value={filters.action} 
            onChange={(e) => handleFilterChange('action', e.target.value)}
          >
            <option value="">全部</option>
            <option value="create">創建</option>
            <option value="update">更新</option>
            <option value="delete">刪除</option>
          </select>
        </div>

        <div className="filter-group">
          <label>
            <Filter size={16} />
            實體類型
          </label>
          <select 
            value={filters.entity_type} 
            onChange={(e) => handleFilterChange('entity_type', e.target.value)}
          >
            <option value="">全部</option>
            <option value="token">Token</option>
            <option value="route">路由</option>
            <option value="team">團隊</option>
            <option value="user">用戶</option>
          </select>
        </div>

        {(filters.action || filters.entity_type) && (
          <button 
            onClick={() => {
              setFilters({ action: '', entity_type: '' });
              setPagination(prev => ({ ...prev, offset: 0 }));
            }}
            className="btn-text"
          >
            清除篩選
          </button>
        )}
      </div>

      {/* 統計資訊 */}
      <div className="logs-stats">
        <span>共 {pagination.total} 條記錄</span>
        {filters.action || filters.entity_type ? (
          <span className="filtered-badge">已篩選</span>
        ) : null}
      </div>

      {/* 日誌列表 */}
      {loading ? (
        <div className="loading-state">
          <RefreshCw className="animate-spin" size={32} />
          <p>載入中...</p>
        </div>
      ) : error ? (
        <div className="error-state">
          <AlertCircle size={48} />
          <h3>載入失敗</h3>
          <p>{error}</p>
          <button onClick={loadLogs} className="btn-primary">
            重試
          </button>
        </div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} />
          <h3>沒有找到記錄</h3>
          <p>嘗試調整篩選條件</p>
        </div>
      ) : (
        <>
          <div className="logs-table-wrapper">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>時間</th>
                  <th>操作</th>
                  <th>實體類型</th>
                  <th>實體 ID</th>
                  <th>詳情</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <LogRow key={log.id || index} log={log} />
                ))}
              </tbody>
            </table>
          </div>

          {/* 分頁 */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => handlePageChange(Math.max(0, pagination.offset - pagination.limit))}
                disabled={currentPage === 1}
                className="btn-secondary"
              >
                上一頁
              </button>
              <span className="pagination-info">
                第 {currentPage} 頁 / 共 {totalPages} 頁
              </span>
              <button
                onClick={() => handlePageChange(pagination.offset + pagination.limit)}
                disabled={currentPage === totalPages}
                className="btn-secondary"
              >
                下一頁
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LogRow({ log }) {
  const getActionBadge = (action) => {
    const classes = {
      create: 'badge-green',
      update: 'badge-blue',
      delete: 'badge-red'
    };
    const labels = {
      create: '創建',
      update: '更新',
      delete: '刪除'
    };
    return <span className={`log-badge ${classes[action] || 'badge-gray'}`}>{labels[action] || action}</span>;
  };

  const getEntityTypeBadge = (entityType) => {
    const labels = {
      token: 'Token',
      route: '路由',
      team: '團隊',
      user: '用戶'
    };
    return <span className="entity-badge">{labels[entityType] || entityType}</span>;
  };

  const formatDetails = (details) => {
    if (!details) return '-';
    if (details.name) return details.name;
    return JSON.stringify(details, null, 2);
  };

  return (
    <tr className="log-row">
      <td className="log-time">
        {format(parseISO(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
      </td>
      <td>{getActionBadge(log.action)}</td>
      <td>{getEntityTypeBadge(log.entity_type)}</td>
      <td className="log-id">{log.entity_id || '-'}</td>
      <td className="log-details">
        <code>{formatDetails(log.details)}</code>
      </td>
    </tr>
  );
}

export default AuditLogs;

