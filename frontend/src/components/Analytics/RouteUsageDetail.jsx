import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Activity, 
  Clock, 
  CheckCircle,
  XCircle,
  TrendingUp,
  Zap,
  Calendar,
  RefreshCw,
  BarChart3
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, parseISO } from 'date-fns';
import './RouteUsageDetail.css';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function RouteUsageDetail() {
  const [searchParams] = useSearchParams();
  const routePath = searchParams.get('path');
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (routePath) {
      loadRouteUsage();
    }
  }, [routePath]);

  const loadRouteUsage = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      
      const response = await fetch(`${API_URL}/api/usage/route?route_path=${encodeURIComponent(routePath)}&limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('載入失敗');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error loading route usage:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!routePath) {
    return (
      <div className="route-usage-detail-container">
        <div className="error-state">
          <Activity size={48} />
          <h3>缺少路由路徑</h3>
          <p>請從路由列表中選擇一個路由查看統計</p>
          <button onClick={() => navigate('/routes')} className="btn btn-primary">
            前往路由列表
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="route-usage-detail-container">
        <div className="loading-state">
          <Activity className="animate-spin" size={48} />
          <p>載入路由使用記錄...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="route-usage-detail-container">
        <div className="error-state">
          <XCircle size={48} />
          <h3>載入失敗</h3>
          <p>{error}</p>
          <button onClick={() => navigate('/routes')} className="btn btn-secondary">
            返回路由列表
          </button>
        </div>
      </div>
    );
  }

  if (!data || !data.stats) {
    return (
      <div className="route-usage-detail-container">
        <div className="empty-usage-state">
          <Activity size={64} />
          <h3>此路由還未被調用</h3>
          <p>當有 Token 通過此路由調用 API 時，統計數據會顯示在這裡</p>
        </div>
      </div>
    );
  }

  const { stats, usage_logs } = data;
  const successRate = stats.total_calls > 0 
    ? ((stats.total_calls - stats.error_count) / stats.total_calls * 100)
    : 0;

  // 使用後端返回的 token_distribution（帶名稱）
  const tokenData = data.token_distribution 
    ? data.token_distribution.map(d => ({
        id: d.token_id,
        name: d.token_name || `Token #${d.token_id}`,
        count: d.count
      }))
    : [];

  // 響應時間趨勢
  const performanceData = usage_logs
    .filter(log => log.response_time_ms)
    .slice(0, 50)
    .reverse()
    .map((log, index) => ({
      index: index + 1,
      time: log.response_time_ms,
      status: log.response_status
    }));

  return (
    <div className="route-usage-detail-container">
      {/* 頁面標題 */}
      <div className="detail-header">
        <button onClick={() => navigate('/routes')} className="btn-back">
          <ArrowLeft size={20} />
          返回
        </button>
        <div className="header-info">
          <h1>🛣️ {routePath}</h1>
          <p className="subtitle">路由使用統計與性能分析</p>
        </div>
        <button onClick={loadRouteUsage} className="btn btn-secondary" disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          刷新
        </button>
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

      <div className="charts-row">
        {/* 響應時間趨勢 */}
        {performanceData.length > 0 && (
          <div className="chart-card">
            <div className="chart-header">
              <h3>
                <TrendingUp size={20} />
                響應時間趨勢
              </h3>
              <span className="chart-subtitle">最近 50 次調用</span>
            </div>
            <div className="chart-content">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="index" stroke="var(--text-secondary)" />
                  <YAxis stroke="var(--text-secondary)" label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-primary)', 
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)'
                    }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="time" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="響應時間 (ms)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Token 使用分佈 */}
        {tokenData.length > 0 && (
          <div className="chart-card">
            <div className="chart-header">
              <h3>
                <Zap size={20} />
                調用此路由的 Token
              </h3>
              <span className="chart-subtitle">Top 5</span>
            </div>
            <div className="chart-content">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={tokenData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                    nameKey="name"
                  >
                    {tokenData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-primary)', 
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)'
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* 詳細調用記錄 */}
      <div className="usage-logs-card">
        <div className="logs-header">
          <h3>
            <Calendar size={20} />
            詳細調用記錄
          </h3>
          <span className="logs-count">最近 {usage_logs.length} 次調用</span>
        </div>
        <div className="logs-table-wrapper">
          <table className="usage-logs-table">
            <thead>
              <tr>
                <th>時間</th>
                <th>Token (hash)</th>
                <th>方法</th>
                <th>狀態</th>
                <th>響應時間</th>
                <th>IP 地址</th>
              </tr>
            </thead>
            <tbody>
              {usage_logs.map((log, index) => (
                <UsageLogRow key={log.id || index} log={log} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
      <td className="log-token">
        {log.token_hash ? `${log.token_hash.substring(0, 16)}...` : '-'}
      </td>
      <td>{getMethodBadge(log.request_method)}</td>
      <td>{getStatusBadge(log.response_status)}</td>
      <td className="log-time-ms">
        {log.response_time_ms ? `${log.response_time_ms}ms` : '-'}
      </td>
      <td className="log-ip">{log.ip_address || '-'}</td>
    </tr>
  );
}

export default RouteUsageDetail;

