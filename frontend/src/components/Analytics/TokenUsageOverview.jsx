import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { Key, TrendingUp, Activity, Clock, AlertCircle, Search } from 'lucide-react';
import './TokenUsageOverview.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function TokenUsageOverview() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState([]);
  const [usageStats, setUsageStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('usage_count'); // usage_count, name, last_used
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = await getToken();

      // 獲取使用統計和 tokens 列表
      const [statsResponse, tokensResponse] = await Promise.all([
        fetch(`${API_URL}/api/usage/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/tokens`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (statsResponse.ok && tokensResponse.ok) {
        const stats = await statsResponse.json();
        const allTokens = await tokensResponse.json();
        
        setUsageStats(stats);
        
        // 合併 token 資訊和使用統計
        const tokensWithUsage = allTokens.map(token => {
          const usage = stats.top_tokens.find(t => t.id === token.id);
          return {
            ...token,
            usage_count: usage?.usage_count || 0,
            last_used: usage?.last_used || null,
            success_rate: usage?.success_rate || 0,
            avg_response_time: usage?.avg_response_time || 0
          };
        });
        
        setTokens(tokensWithUsage);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 過濾和排序
  const filteredAndSortedTokens = tokens
    .filter(token => {
      const query = searchQuery.toLowerCase();
      return (
        token.name.toLowerCase().includes(query) ||
        token.description?.toLowerCase().includes(query) ||
        token.team_name?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      if (sortBy === 'last_used') {
        aVal = aVal ? new Date(aVal) : new Date(0);
        bVal = bVal ? new Date(bVal) : new Date(0);
      }
      
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

  const formatDate = (dateString) => {
    if (!dateString) return '從未使用';
    return new Date(dateString).toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="token-usage-overview">
        <div className="loading-state">
          <Activity className="animate-spin" size={48} />
          <p>載入使用統計...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="token-usage-overview">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon">
            <Key size={32} />
          </div>
          <div>
            <h1>Token 使用詳情</h1>
            <p className="subtitle">查看所有 Token 的使用統計和調用記錄</p>
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
              <Key size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">總 Token 數</div>
              <div className="stat-value">{tokens.length}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green">
              <Activity size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">活躍 Token</div>
              <div className="stat-value">{tokens.filter(t => t.usage_count > 0).length}</div>
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
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">平均響應時間</div>
              <div className="stat-value">{usageStats.overview.avg_response_time.toFixed(0)}ms</div>
            </div>
          </div>
        </div>
      )}

      {/* 搜尋和排序 */}
      <div className="controls">
        <div className="search-box-large">
          <Search size={20} />
          <input
            type="text"
            placeholder="搜尋 Token 名稱、團隊..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="sort-controls">
          <label>排序：</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="usage_count">使用次數</option>
            <option value="name">名稱</option>
            <option value="last_used">最後使用</option>
            <option value="success_rate">成功率</option>
          </select>
          <button 
            className="btn btn-small btn-secondary"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? '↑ 升序' : '↓ 降序'}
          </button>
        </div>
      </div>

      {/* Token 列表 */}
      <div className="tokens-grid">
        {filteredAndSortedTokens.length === 0 ? (
          <div className="empty-state">
            <AlertCircle size={48} />
            <h3>沒有找到 Token</h3>
            <p>試試其他搜尋關鍵字</p>
          </div>
        ) : (
          filteredAndSortedTokens.map((token) => (
            <div
              key={token.id}
              className="token-card"
              onClick={() => navigate(`/token-usage/${token.id}`)}
            >
              <div className="token-card-header">
                <div className="token-name">
                  <Key size={20} />
                  <span>{token.name}</span>
                </div>
                {token.usage_count > 0 ? (
                  <span className="badge badge-success">活躍</span>
                ) : (
                  <span className="badge badge-secondary">閒置</span>
                )}
              </div>

              <div className="token-card-body">
                <div className="token-info">
                  <span className="label">團隊</span>
                  <span className="value">{token.team_name || '-'}</span>
                </div>
                <div className="token-info">
                  <span className="label">描述</span>
                  <span className="value">{token.description || '無描述'}</span>
                </div>
              </div>

              <div className="token-card-stats">
                <div className="stat-item">
                  <TrendingUp size={16} />
                  <div>
                    <div className="stat-label">調用次數</div>
                    <div className="stat-value">{token.usage_count.toLocaleString()}</div>
                  </div>
                </div>
                <div className="stat-item">
                  <Clock size={16} />
                  <div>
                    <div className="stat-label">最後使用</div>
                    <div className="stat-value">{formatDate(token.last_used)}</div>
                  </div>
                </div>
              </div>

              {token.usage_count > 0 && (
                <div className="token-card-footer">
                  <div className="footer-stat">
                    <span>成功率</span>
                    <span className="success-rate">{token.success_rate.toFixed(1)}%</span>
                  </div>
                  <div className="footer-stat">
                    <span>平均響應</span>
                    <span>{token.avg_response_time.toFixed(0)}ms</span>
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

