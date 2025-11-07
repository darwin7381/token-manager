import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Activity, 
  Clock, 
  CheckCircle,
  XCircle,
  TrendingUp,
  BarChart3,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import './TokenUsageDetail.css';

function TokenUsageDetail() {
  const { tokenId } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTokenUsage();
  }, [tokenId]);

  const loadTokenUsage = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      
      const response = await fetch(`${API_URL}/api/usage/token/${tokenId}?limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Token 不存在');
        } else if (response.status === 403) {
          throw new Error('沒有權限查看此 Token 的使用記錄');
        }
        throw new Error('載入失敗');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error loading token usage:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="token-usage-detail-container">
        <div className="loading-state">
          <Activity className="animate-spin" size={48} />
          <p>載入 Token 使用記錄...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="token-usage-detail-container">
        <div className="error-state">
          <XCircle size={48} />
          <h3>載入失敗</h3>
          <p>{error}</p>
          <button onClick={() => navigate('/tokens')} className="btn btn-secondary">
            返回 Token 列表
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { token: tokenInfo, stats, recent_usage, route_distribution } = data;
  const successRate = stats.total_calls > 0 
    ? ((stats.total_calls - stats.error_count) / stats.total_calls * 100)
    : 0;

  // 準備時間序列數據（按小時分組）
  const hourlyData = {};
  recent_usage.forEach(log => {
    const hour = format(parseISO(log.used_at), 'MM/dd HH:00');
    if (!hourlyData[hour]) {
      hourlyData[hour] = { hour, count: 0, errors: 0 };
    }
    hourlyData[hour].count++;
    if (log.response_status >= 400) {
      hourlyData[hour].errors++;
    }
  });
  
  const timelineData = Object.values(hourlyData).reverse();

  // 使用後端返回的 route_distribution（帶名稱和路徑）
  const routeData = route_distribution 
    ? route_distribution.map(d => ({
        id: d.route_id,
        name: d.route_name || d.route_path,
        path: d.route_path,
        count: d.count
      }))
    : [];

  return (
    <div className="token-usage-detail-container">
      {/* 頁面標題 */}
      <div className="detail-header">
        <button onClick={() => navigate('/tokens')} className="btn-back">
          <ArrowLeft size={20} />
          返回
        </button>
        <div className="header-info">
          <h1>🔑 {tokenInfo.name}</h1>
          <p className="subtitle">Token 使用詳情與統計分析</p>
        </div>
        <button onClick={loadTokenUsage} className="btn btn-secondary" disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          刷新
        </button>
      </div>

      {/* Token 基本資訊 */}
      <div className="token-info-card">
        <div className="info-row">
          <span className="info-label">Token ID:</span>
          <span className="info-value">#{tokenInfo.id}</span>
        </div>
        <div className="info-row">
          <span className="info-label">所屬團隊:</span>
          <span className="info-value">{tokenInfo.team_id}</span>
        </div>
      </div>

      {/* 統計卡片 */}
      <div className="usage-stats-grid">
        <StatCard
          icon={<Activity size={24} />}
          title="總調用次數"
          value={stats.total_calls || 0}
          color="blue"
        />
        <StatCard
          icon={<CheckCircle size={24} />}
          title="成功率"
          value={`${successRate.toFixed(1)}%`}
          color="green"
        />
        <StatCard
          icon={<Clock size={24} />}
          title="平均響應時間"
          value={`${Math.round(stats.avg_response_time || 0)}ms`}
          color="purple"
        />
        <StatCard
          icon={<XCircle size={24} />}
          title="錯誤次數"
          value={stats.error_count || 0}
          color="red"
        />
      </div>

      {/* 使用時間線 */}
      {timelineData.length > 0 && (
        <div className="chart-card">
          <div className="chart-header">
            <h3>
              <TrendingUp size={20} />
              使用時間線
            </h3>
            <span className="chart-subtitle">最近 100 次調用</span>
          </div>
          <div className="chart-content">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="hour" stroke="var(--text-secondary)" fontSize={12} />
                <YAxis stroke="var(--text-secondary)" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--bg-primary)', 
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }} 
                />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} name="調用次數" />
                <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} name="錯誤次數" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 路由分佈 */}
      {routeData.length > 0 && (
        <div className="chart-card">
          <div className="chart-header">
            <h3>
              <BarChart3 size={20} />
              調用的路由分佈
            </h3>
            <span className="chart-subtitle">最近 100 次</span>
          </div>
          <div className="chart-content">
              <ResponsiveContainer width="100%" height={250}>
              <BarChart data={routeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} />
                <YAxis stroke="var(--text-secondary)" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--bg-primary)', 
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }}
                  formatter={(value, name, props) => {
                    if (name === '調用次數') return [value, name];
                    return [value, `${props.payload.name} (${props.payload.path})`];
                  }}
                />
                <Bar dataKey="count" fill="#10b981" name="調用次數" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 詳細使用記錄 */}
      <div className="usage-logs-card">
        <div className="logs-header">
          <h3>
            <Calendar size={20} />
            詳細使用記錄
          </h3>
          <span className="logs-count">最近 {recent_usage.length} 次調用</span>
        </div>
        <div className="logs-table-wrapper">
          <table className="usage-logs-table">
            <thead>
              <tr>
                <th>時間</th>
                <th>路由</th>
                <th>方法</th>
                <th>狀態</th>
                <th>響應時間</th>
                <th>IP 地址</th>
              </tr>
            </thead>
            <tbody>
              {recent_usage.map((log, index) => (
                <UsageLogRow key={log.id || index} log={log} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 空狀態 */}
      {stats.total_calls === 0 && (
        <div className="empty-usage-state">
          <Activity size={64} />
          <h3>此 Token 還未被使用</h3>
          <p>當此 Token 通過 Cloudflare Worker 調用 API 時，使用記錄會顯示在這裡</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, title, value, color }) {
  return (
    <div className={`usage-stat-card stat-${color}`}>
      <div className="stat-icon-wrapper">{icon}</div>
      <div className="stat-info">
        <div className="stat-label">{title}</div>
        <div className="stat-number">{value}</div>
      </div>
    </div>
  );
}

function UsageLogRow({ log }) {
  const getStatusBadge = (status) => {
    if (status >= 200 && status < 300) {
      return <span className="status-badge status-success">{status}</span>;
    } else if (status >= 400 && status < 500) {
      return <span className="status-badge status-error">{status}</span>;
    } else if (status >= 500) {
      return <span className="status-badge status-critical">{status}</span>;
    }
    return <span className="status-badge status-info">{status || '-'}</span>;
  };

  const getMethodBadge = (method) => {
    const colors = {
      'GET': 'blue',
      'POST': 'green',
      'PUT': 'orange',
      'DELETE': 'red'
    };
    return (
      <span className={`method-badge method-${colors[method] || 'gray'}`}>
        {method || '-'}
      </span>
    );
  };

  return (
    <tr className="usage-log-row">
      <td className="log-time">
        {log.used_at ? format(parseISO(log.used_at), 'MM/dd HH:mm:ss') : '-'}
      </td>
      <td className="log-route">{log.route_path || '-'}</td>
      <td>{getMethodBadge(log.request_method)}</td>
      <td>{getStatusBadge(log.response_status)}</td>
      <td className="log-time-ms">
        {log.response_time_ms ? `${log.response_time_ms}ms` : '-'}
      </td>
      <td className="log-ip">{log.ip_address || '-'}</td>
    </tr>
  );
}

export default TokenUsageDetail;

