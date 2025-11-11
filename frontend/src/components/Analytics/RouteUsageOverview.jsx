import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { Route as RouteIcon, TrendingUp, Activity, Clock, AlertCircle, Search, BarChart3 } from 'lucide-react';
import './RouteUsageOverview.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function RouteUsageOverview() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState([]);
  const [usageStats, setUsageStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('call_count'); // call_count, name, success_rate, avg_response_time
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterTag, setFilterTag] = useState('all');
  const [allTags, setAllTags] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = await getToken();

      // 獲取使用統計和 routes 列表
      const [statsResponse, routesResponse] = await Promise.all([
        fetch(`${API_URL}/api/usage/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/routes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (statsResponse.ok && routesResponse.ok) {
        const stats = await statsResponse.json();
        const allRoutes = await routesResponse.json();
        
        setUsageStats(stats);
        
        // 合併 route 資訊和使用統計
        const routesWithUsage = allRoutes.map(route => {
          const usage = stats.top_routes.find(r => r.route_path === route.path);
          return {
            ...route,
            call_count: usage?.call_count || 0,
            success_rate: usage?.success_rate || 0,
            avg_response_time: usage?.avg_response_time || 0,
            error_count: usage?.error_count || 0
          };
        });
        
        setRoutes(routesWithUsage);
        
        // 提取所有標籤
        const tags = new Set();
        allRoutes.forEach(route => {
          if (route.tags) {
            route.tags.forEach(tag => tags.add(tag));
          }
        });
        setAllTags(['all', ...Array.from(tags)]);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 過濾和排序
  const filteredAndSortedRoutes = routes
    .filter(route => {
      // 標籤過濾
      if (filterTag !== 'all' && (!route.tags || !route.tags.includes(filterTag))) {
        return false;
      }
      
      // 搜尋過濾
      const query = searchQuery.toLowerCase();
      return (
        route.name?.toLowerCase().includes(query) ||
        route.path.toLowerCase().includes(query) ||
        route.description?.toLowerCase().includes(query) ||
        route.backend_url?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      let aVal = a[sortBy] || 0;
      let bVal = b[sortBy] || 0;
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  if (loading) {
    return (
      <div className="route-usage-overview">
        <div className="loading-state">
          <Activity className="animate-spin" size={48} />
          <p>載入路由統計...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="route-usage-overview">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon route">
            <RouteIcon size={32} />
          </div>
          <div>
            <h1>路由調用統計</h1>
            <p className="subtitle">查看所有路由的調用統計和性能指標</p>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={loadData}>
          <Activity size={16} />
          刷新數據
        </button>
      </div>

      {/* 統計卡片 */}
      {usageStats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue">
              <RouteIcon size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">總路由數</div>
              <div className="stat-value">{routes.length}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green">
              <Activity size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">活躍路由</div>
              <div className="stat-value">{routes.filter(r => r.call_count > 0).length}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple">
              <TrendingUp size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">總調用次數</div>
              <div className="stat-value">{usageStats.overview.total_calls.toLocaleString()}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange">
              <BarChart3 size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">平均成功率</div>
              <div className="stat-value">{usageStats.overview.success_rate.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      )}

      {/* 搜尋和過濾 */}
      <div className="controls">
        <div className="search-box-large">
          <Search size={20} />
          <input
            type="text"
            placeholder="搜尋路由名稱、路徑、後端 URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-controls">
          <label>標籤：</label>
          <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
            {allTags.map(tag => (
              <option key={tag} value={tag}>
                {tag === 'all' ? '全部' : `#${tag}`}
              </option>
            ))}
          </select>
        </div>
        <div className="sort-controls">
          <label>排序：</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="call_count">調用次數</option>
            <option value="name">名稱</option>
            <option value="success_rate">成功率</option>
            <option value="avg_response_time">響應時間</option>
          </select>
          <button 
            className="btn btn-small btn-secondary"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? '↑ 升序' : '↓ 降序'}
          </button>
        </div>
      </div>

      {/* 路由列表 */}
      <div className="routes-grid">
        {filteredAndSortedRoutes.length === 0 ? (
          <div className="empty-state">
            <AlertCircle size={48} />
            <h3>沒有找到路由</h3>
            <p>試試其他搜尋關鍵字或標籤</p>
          </div>
        ) : (
          filteredAndSortedRoutes.map((route) => (
            <div
              key={route.id}
              className="route-card"
              onClick={() => navigate(`/route-usage?path=${encodeURIComponent(route.path)}`)}
            >
              <div className="route-card-header">
                <div className="route-name">
                  <RouteIcon size={20} />
                  <span>{route.name || route.path}</span>
                </div>
                {route.call_count > 0 ? (
                  <span className="badge badge-success">活躍</span>
                ) : (
                  <span className="badge badge-secondary">閒置</span>
                )}
              </div>

              <div className="route-card-body">
                <div className="route-path">
                  <code>{route.path}</code>
                </div>
                <div className="route-backend">
                  <span className="label">後端：</span>
                  <code>{route.backend_url}</code>
                </div>
                {route.description && (
                  <div className="route-description">
                    {route.description}
                  </div>
                )}
                {route.tags && route.tags.length > 0 && (
                  <div className="route-tags">
                    {route.tags.map(tag => (
                      <span key={tag} className="tag">#{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="route-card-stats">
                <div className="stat-item">
                  <TrendingUp size={16} />
                  <div>
                    <div className="stat-label">調用次數</div>
                    <div className="stat-value">{route.call_count.toLocaleString()}</div>
                  </div>
                </div>
                <div className="stat-item">
                  <Clock size={16} />
                  <div>
                    <div className="stat-label">平均響應</div>
                    <div className="stat-value">{route.avg_response_time.toFixed(0)}ms</div>
                  </div>
                </div>
              </div>

              {route.call_count > 0 && (
                <div className="route-card-footer">
                  <div className="footer-stat">
                    <span>成功率</span>
                    <span className={route.success_rate >= 95 ? 'success-rate' : 'warning-rate'}>
                      {route.success_rate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="footer-stat">
                    <span>錯誤次數</span>
                    <span className={route.error_count > 0 ? 'error-count' : ''}>
                      {route.error_count.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

