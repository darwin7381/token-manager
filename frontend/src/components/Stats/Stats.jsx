import { useState, useEffect } from 'react';
import { getStats } from '../../services/api';

export default function Stats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await getStats();
        setStats(data);
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

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

  if (loading) return <div className="loading">載入中...</div>;

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats?.total_tokens || 0}</div>
          <div className="stat-label">活躍 Tokens</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.total_routes || 0}</div>
          <div className="stat-label">微服務路由</div>
        </div>
      </div>

      <div className="section">
        <h2>最近活動</h2>
        {!stats?.recent_activity || stats.recent_activity.length === 0 ? (
          <div className="empty-state">尚無活動記錄</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>時間</th>
                <th>操作</th>
                <th>類型</th>
                <th>詳情</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent_activity.map((log, index) => (
                <tr key={index}>
                  <td>{formatDate(log.created_at)}</td>
                  <td>
                    <span className="badge badge-info">{log.action}</span>
                  </td>
                  <td>{log.entity_type}</td>
                  <td><code>{log.details}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

