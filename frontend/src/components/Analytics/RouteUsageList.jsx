import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { Route as RouteIcon, TrendingUp, Activity, Search, ArrowUpRight, Tag } from 'lucide-react';
import './RouteUsageDetail.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function RouteUsageList() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [routes, setRoutes] = useState([]);
  const [usageStats, setUsageStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = await getToken();

      // 並行獲取 routes 和使用統計
      const [routesResponse, usageResponse] = await Promise.all([
        fetch(`${API_URL}/api/routes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/usage/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (routesResponse.ok && usageResponse.ok) {
        const routesData = await routesResponse.json();
        const usageData = await usageResponse.json();

        // 合併數據
        const mergedData = routesData.map(r => {
          const usage = usageData.top_routes.find(u => u.route_path === r.path) || {};
          return {
            ...r,
            call_count: usage.call_count || 0,
            success_rate: usage.success_rate || 100,
            avg_response_time: usage.avg_response_time || 0,
            error_count: usage.error_count || 0
          };
        });

        // 按調用次數排序
        mergedData.sort((a, b) => b.call_count - a.call_count);

        setRoutes(routesData);
        setUsageStats(mergedData);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStats = usageStats.filter(stat =>
    stat.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (stat.name && stat.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (stat.description && stat.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (stat.tags && stat.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const totalCalls = usageStats.reduce((sum, stat) => sum + stat.call_count, 0);
  const activeRoutes = usageStats.filter(stat => stat.call_count > 0).length;
  const totalErrors = usageStats.reduce((sum, stat) => sum + stat.error_count, 0);
  const avgSuccessRate = usageStats.length > 0
    ? usageStats.reduce((sum, stat) => sum + stat.success_rate, 0) / usageStats.length
    : 100;

  if (loading) {
    return (
      <div className="usage-detail-container">
        <div className="loading-state">
          <Activity className="animate-spin" size={48} />
          <p>載入使用數據...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="usage-detail-container">
      {/* Header */}
      <div className="usage-detail-header">
        <div>
          <h1>
            <RouteIcon size={32} style={{ color: 'var(--accent-success)' }} />
            路由調用統計總覽
          </h1>
          <p className="subtitle">查看所有路由的調用情況和性能指標</p>
        </div>
      </div>

      {/* 統計卡片 */}
      <div className="stats-grid">
        <div className="stat-card stat-card-blue">
          <div className="stat-icon">
            <RouteIcon size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-title">總路由數</div>
            <div className="stat-value">{routes.length}</div>
            <div className="stat-trend">{activeRoutes} 個活躍中</div>
          </div>
        </div>

        <div className="stat-card stat-card-green">
          <div className="stat-icon">
            <Activity size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-title">總調用次數</div>
            <div className="stat-value">{totalCalls.toLocaleString()}</div>
            <div className="stat-trend">所有路由累計</div>
          </div>
        </div>

        <div className="stat-card stat-card-purple">
          <div className="stat-icon">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-title">平均成功率</div>
            <div className="stat-value">{avgSuccessRate.toFixed(1)}%</div>
            <div className="stat-trend">整體表現良好</div>
          </div>
        </div>

        <div className="stat-card stat-card-red">
          <div className="stat-icon">
            <Activity size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-title">錯誤總數</div>
            <div className="stat-value">{totalErrors.toLocaleString()}</div>
            <div className="stat-trend">需要關注</div>
          </div>
        </div>
      </div>

      {/* 搜尋框 */}
      <div className="search-section">
        <div className="search-box-large">
          <Search size={20} />
          <input
            type="text"
            placeholder="搜尋路由路徑、名稱、標籤..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 路由列表 */}
      <div className="route-usage-list">
        {filteredStats.length === 0 ? (
          <div className="empty-state">
            <RouteIcon size={64} style={{ opacity: 0.3 }} />
            <h3>沒有找到路由</h3>
            <p>試試調整搜尋關鍵字</p>
          </div>
        ) : (
          <div className="route-cards-grid">
            {filteredStats.map((stat, index) => (
              <div
                key={stat.id}
                className="route-usage-card"
                onClick={() => navigate(`/route-usage?path=${encodeURIComponent(stat.path)}`)}
              >
                <div className="route-card-header">
                  <div className="route-card-rank">#{index + 1}</div>
                  <div className="route-card-title">
                    <h3>{stat.name || stat.path}</h3>
                    {stat.call_count > 0 ? (
                      <span className="status-badge active">活躍</span>
                    ) : (
                      <span className="status-badge inactive">未使用</span>
                    )}
                  </div>
                  <ArrowUpRight size={20} className="route-card-arrow" />
                </div>

                <div className="route-card-path">
                  <code>{stat.path}</code>
                </div>

                {stat.description && (
                  <p className="route-card-description">{stat.description}</p>
                )}

                <div className="route-card-stats">
                  <div className="route-card-stat">
                    <span className="label">調用次數</span>
                    <span className="value">{stat.call_count.toLocaleString()}</span>
                  </div>
                  <div className="route-card-stat">
                    <span className="label">成功率</span>
                    <span className={`value ${stat.success_rate >= 95 ? 'success' : 'warning'}`}>
                      {stat.success_rate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="route-card-stat">
                    <span className="label">平均響應</span>
                    <span className="value">{stat.avg_response_time.toFixed(0)}ms</span>
                  </div>
                </div>

                {stat.error_count > 0 && (
                  <div className="route-card-errors">
                    ⚠️ {stat.error_count} 個錯誤
                  </div>
                )}

                {stat.tags && stat.tags.length > 0 && (
                  <div className="route-card-tags">
                    <Tag size={14} />
                    {stat.tags.slice(0, 3).map((tag, i) => (
                      <span key={i} className="tag-badge">{tag}</span>
                    ))}
                    {stat.tags.length > 3 && (
                      <span className="tag-badge">+{stat.tags.length - 3}</span>
                    )}
                  </div>
                )}

                <div className="route-card-footer">
                  <span className="route-method">{stat.backend_url ? '已配置後端' : '無後端'}</span>
                  {stat.backend_auth_type && stat.backend_auth_type !== 'none' && (
                    <span className="auth-badge">🔒 {stat.backend_auth_type}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

