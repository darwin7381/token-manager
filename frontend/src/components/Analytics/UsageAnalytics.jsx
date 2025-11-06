import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { 
  Activity, 
  TrendingUp, 
  Zap, 
  AlertCircle,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { format, parseISO } from 'date-fns';
import './UsageAnalytics.css';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function UsageAnalytics() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadUsageStats();
    // 每 30 秒自動刷新
    const interval = setInterval(loadUsageStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadUsageStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      
      const response = await fetch('/api/usage/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load usage statistics');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error loading usage stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="usage-analytics-container">
        <div className="loading-state">
          <Activity className="animate-spin" size={48} />
          <p>載入使用統計數據...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="usage-analytics-container">
        <div className="error-state">
          <AlertCircle size={48} />
          <h3>載入失敗</h3>
          <p>{error}</p>
          <button onClick={loadUsageStats} className="btn btn-primary">
            重試
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { overview, hourly_usage, top_tokens, top_routes, recent_logs = [] } = data;

  // 準備圖表數據
  const hourlyData = hourly_usage.map(item => ({
    time: format(parseISO(item.hour), 'HH:00'),
    calls: item.call_count,
    avgTime: Math.round(item.avg_response_time)
  })).reverse();

  const routePieData = top_routes.slice(0, 5).map(route => ({
    id: route.route_id,
    name: route.route_name || route.route_path,
    path: route.route_path,
    value: route.call_count
  }));

  return (
    <div className="usage-analytics-container">
      <div className="analytics-header">
        <div>
          <h1>📊 API 使用分析</h1>
          <p className="subtitle">實時 API 調用統計與性能監控</p>
        </div>
        <button 
          onClick={loadUsageStats} 
          className="btn btn-secondary"
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          刷新數據
        </button>
      </div>

      {/* 核心指標卡片 */}
      <div className="metrics-grid">
        <MetricCard
          icon={<Activity size={24} />}
          title="總調用次數"
          value={overview.total_calls.toLocaleString()}
          color="blue"
          subtitle="歷史總計"
        />
        <MetricCard
          icon={<CheckCircle size={24} />}
          title="成功率"
          value={`${overview.success_rate.toFixed(1)}%`}
          color="green"
          subtitle={`${overview.total_calls - overview.total_errors} 次成功`}
        />
        <MetricCard
          icon={<Clock size={24} />}
          title="平均響應時間"
          value={`${overview.avg_response_time.toFixed(0)}ms`}
          color="purple"
          subtitle="所有請求平均"
        />
        <MetricCard
          icon={<XCircle size={24} />}
          title="錯誤次數"
          value={overview.total_errors.toLocaleString()}
          color="red"
          subtitle={`${((overview.total_errors / overview.total_calls) * 100).toFixed(1)}% 錯誤率`}
        />
      </div>

      {/* 圖表區域 */}
      <div className="charts-section">
        {/* 第一行：24 小時調用趨勢（2/3）+ 路由使用分佈（1/3） */}
        <div className="charts-row">
          {/* 24 小時調用趨勢 */}
          <div className="chart-card" style={{ flex: '2' }}>
            <div className="chart-header">
              <h3>
                <TrendingUp size={20} />
                24 小時調用趨勢
              </h3>
              <span className="chart-subtitle">每小時統計</span>
            </div>
            <div className="chart-content">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="time" stroke="var(--text-secondary)" />
                  <YAxis yAxisId="left" stroke="var(--text-secondary)" />
                  <YAxis yAxisId="right" orientation="right" stroke="var(--text-tertiary)" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-primary)', 
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)'
                    }} 
                  />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="calls" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 4 }}
                    name="調用次數"
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="avgTime" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    dot={{ fill: '#8b5cf6', r: 4 }}
                    name="平均響應時間 (ms)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 路由使用分佈（餅圖） */}
          {routePieData.length > 0 && (
            <div className="chart-card" style={{ flex: '1' }}>
              <div className="chart-header">
                <h3>
                  <PieChartIcon size={20} />
                  路由使用分佈
                </h3>
                <span className="chart-subtitle">Top 5 路由</span>
              </div>
              <div className="chart-content">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={routePieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {routePieData.map((entry, index) => (
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

        {/* Top Token 和 Top 路由 */}
        <div className="charts-row">
          {/* Top 10 Token */}
          <div className="chart-card">
            <div className="chart-header">
              <h3>
                <Zap size={20} />
                最活躍 Token
              </h3>
              <span className="chart-subtitle">最近 7 天</span>
            </div>
            <div className="chart-content">
              <div className="top-list">
                {top_tokens.map((token, index) => (
                  <div 
                    key={index} 
                    className="top-item clickable"
                    onClick={() => navigate(`/token-usage/${token.id || index + 1}`)}
                    title={`點擊查看 Token 使用詳情`}
                  >
                    <div className="top-rank">#{index + 1}</div>
                    <div className="top-info">
                      <div className="top-name">{token.name}</div>
                      <div className="top-meta">{token.team_id}</div>
                    </div>
                    <div className="top-count">{token.usage_count.toLocaleString()} 次</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top 10 路由 */}
          <div className="chart-card">
            <div className="chart-header">
              <h3>
                <BarChart3 size={20} />
                最熱門路由
              </h3>
              <span className="chart-subtitle">最近 7 天</span>
            </div>
            <div className="chart-content">
              <div className="top-list">
                {top_routes.map((route, index) => (
                  <div 
                    key={index} 
                    className="top-item clickable"
                    onClick={() => navigate(`/route-usage?path=${encodeURIComponent(route.route_path)}`)}
                    title={`點擊查看路由統計 - ${route.route_path}`}
                  >
                    <div className="top-rank">#{index + 1}</div>
                    <div className="top-info">
                      <div className="top-name">{route.route_name || route.route_path}</div>
                      <div className="top-meta">
                        平均: {route.avg_response_time.toFixed(0)}ms | 
                        成功率: {route.success_rate.toFixed(1)}%
                      </div>
                    </div>
                    <div className="top-count">{route.call_count.toLocaleString()} 次</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* API 調用記錄列表（全寬） */}
        {recent_logs.length > 0 && (
          <div className="chart-card chart-full">
            <div className="chart-header">
              <h3>
                <Activity size={20} />
                詳細調用記錄
              </h3>
              <span className="chart-subtitle">最近 100 次調用</span>
            </div>
            <div className="chart-content">
              <div className="usage-logs-table">
                <table>
                  <thead>
                    <tr>
                      <th>時間</th>
                      <th>Token</th>
                      <th>路由</th>
                      <th>方法</th>
                      <th>狀態</th>
                      <th>響應時間</th>
                      <th>IP 地址</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent_logs.map((log, index) => (
                      <tr key={index}>
                        <td>{new Date(log.used_at).toLocaleString('zh-TW')}</td>
                        <td>
                          {log.token_id ? (
                            <span 
                              className="clickable-link"
                              onClick={() => navigate(`/token-usage/${log.token_id}`)}
                              title="點擊查看 Token 使用詳情"
                              style={{ cursor: 'pointer', color: 'var(--accent-primary)' }}
                            >
                              {log.token_name || log.token_hash?.substring(0, 12) + '...'}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-tertiary)' }}>
                              {log.token_hash?.substring(0, 12) + '...' || 'N/A'}
                            </span>
                          )}
                        </td>
                        <td>
                          <span 
                            className="clickable-link"
                            onClick={() => navigate(`/route-usage?path=${encodeURIComponent(log.route_path)}`)}
                            title="點擊查看路由統計"
                            style={{ cursor: 'pointer', color: 'var(--accent-primary)' }}
                          >
                            {log.route_path}
                          </span>
                        </td>
                        <td><span className="badge badge-info">{log.request_method}</span></td>
                        <td>
                          <span className={`badge ${log.response_status >= 200 && log.response_status < 300 ? 'badge-success' : 'badge-danger'}`}>
                            {log.response_status}
                          </span>
                        </td>
                        <td>{log.response_time_ms}ms</td>
                        <td>{log.ip_address || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 提示：如果沒有數據 */}
      {overview.total_calls === 0 && (
        <div className="empty-usage-state">
          <Activity size={64} />
          <h3>還沒有使用記錄</h3>
          <p>當 Token 通過 Cloudflare Worker 調用 API 時，使用記錄會自動顯示在這裡</p>
          <div className="empty-usage-tips">
            <h4>📝 測試步驟：</h4>
            <ol>
              <li>創建一個測試 Token</li>
              <li>使用 Token 調用 Worker API</li>
              <li>等待 5-10 秒（異步記錄）</li>
              <li>刷新此頁面查看統計</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon, title, value, color, subtitle }) {
  return (
    <div className={`metric-card metric-${color}`}>
      <div className="metric-icon">{icon}</div>
      <div className="metric-content">
        <div className="metric-title">{title}</div>
        <div className="metric-value">{value}</div>
        {subtitle && <div className="metric-subtitle">{subtitle}</div>}
      </div>
    </div>
  );
}

export default UsageAnalytics;

