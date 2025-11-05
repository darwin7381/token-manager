import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { 
  TrendingUp, 
  Users, 
  Shield, 
  Route, 
  AlertTriangle,
  Activity,
  Clock,
  BarChart3
} from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, parseISO } from 'date-fns';
import './Dashboard.css';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function Dashboard() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      
      const response = await fetch('/api/dashboard/overview', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load dashboard data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-state">
          <Activity className="animate-spin" size={48} />
          <p>載入 Dashboard 數據...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error-state">
          <AlertTriangle size={48} />
          <h3>載入失敗</h3>
          <p>{error}</p>
          <button onClick={loadDashboardData} className="btn-primary">
            重試
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { overview, tokens_by_team, token_trend, recent_logs, expiring_soon } = data;

  // 準備圖表數據
  const trendData = token_trend.map(item => ({
    date: format(parseISO(item.date), 'MM/dd'),
    tokens: item.count
  })).reverse();

  const teamData = tokens_by_team.slice(0, 5); // 只顯示前 5 個團隊

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>📊 系統 Dashboard</h1>
          <p className="subtitle">即時監控系統狀態與活動</p>
        </div>
        <button onClick={loadDashboardData} className="btn-secondary">
          <Activity size={16} />
          刷新數據
        </button>
      </div>

      {/* 統計卡片 */}
      <div className="stats-grid">
        <StatCard
          icon={<Shield size={24} />}
          title="活躍 Token"
          value={overview.total_tokens}
          color="blue"
          trend="+12% 本週"
        />
        <StatCard
          icon={<Route size={24} />}
          title="路由總數"
          value={overview.total_routes}
          color="green"
          trend="穩定"
        />
        <StatCard
          icon={<Users size={24} />}
          title="團隊數量"
          value={overview.total_teams}
          color="purple"
          trend="+2 本月"
        />
        <StatCard
          icon={<AlertTriangle size={24} />}
          title="即將過期"
          value={expiring_soon.length}
          color="orange"
          trend="30 天內"
        />
      </div>

      {/* 圖表區域 */}
      <div className="charts-grid">
        {/* Token 創建趨勢 */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>
              <TrendingUp size={20} />
              Token 創建趨勢
            </h3>
            <span className="chart-subtitle">最近 7 天</span>
          </div>
          <div className="chart-content">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }} 
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="tokens" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                  name="Token 數量"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 團隊分佈 */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>
              <BarChart3 size={20} />
              團隊 Token 分佈
            </h3>
            <span className="chart-subtitle">Top 5 團隊</span>
          </div>
          <div className="chart-content">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={teamData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="team_name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }} 
                />
                <Legend />
                <Bar dataKey="count" fill="#10b981" name="Token 數量" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 即將過期的 Token */}
      {expiring_soon.length > 0 && (
        <div className="expiring-section">
          <div className="section-header">
            <h3>
              <Clock size={20} />
              即將過期的 Token
            </h3>
            <span className="badge badge-warning">{expiring_soon.length} 個</span>
          </div>
          <div className="expiring-list">
            {expiring_soon.map(token => (
              <div key={token.id} className="expiring-item">
                <div className="expiring-info">
                  <strong>{token.name}</strong>
                  <span className="team-badge">{token.team_name}</span>
                </div>
                <div className="expiring-date">
                  到期時間: {format(parseISO(token.expires_at), 'yyyy-MM-dd HH:mm')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 最近活動 */}
      <div className="activity-section">
        <div className="section-header">
          <h3>
            <Activity size={20} />
            最近活動
          </h3>
        </div>
        <div className="activity-list">
          {recent_logs.map((log, index) => (
            <ActivityItem key={index} log={log} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, color, trend }) {
  return (
    <div className={`stat-card stat-card-${color}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <div className="stat-title">{title}</div>
        <div className="stat-value">{value}</div>
        {trend && <div className="stat-trend">{trend}</div>}
      </div>
    </div>
  );
}

function ActivityItem({ log }) {
  const getActionColor = (action) => {
    switch (action) {
      case 'create': return 'green';
      case 'update': return 'blue';
      case 'delete': return 'red';
      default: return 'gray';
    }
  };

  const getActionText = (action) => {
    switch (action) {
      case 'create': return '創建';
      case 'update': return '更新';
      case 'delete': return '刪除';
      default: return action;
    }
  };

  const getEntityText = (entityType) => {
    switch (entityType) {
      case 'token': return 'Token';
      case 'route': return '路由';
      case 'team': return '團隊';
      case 'user': return '用戶';
      default: return entityType;
    }
  };

  return (
    <div className="activity-item">
      <div className={`activity-badge badge-${getActionColor(log.action)}`}>
        {getActionText(log.action)}
      </div>
      <div className="activity-content">
        <span className="activity-type">{getEntityText(log.entity_type)}</span>
        {log.details && log.details.name && (
          <span className="activity-name">「{log.details.name}」</span>
        )}
      </div>
      <div className="activity-time">
        {format(parseISO(log.created_at), 'MM/dd HH:mm')}
      </div>
    </div>
  );
}

export default Dashboard;

