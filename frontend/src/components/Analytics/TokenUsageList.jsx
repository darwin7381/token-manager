import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { Key, TrendingUp, Activity, Search, ArrowUpRight, Calendar } from 'lucide-react';
import './TokenUsageDetail.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function TokenUsageList() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [tokens, setTokens] = useState([]);
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

      // 並行獲取 tokens 和使用統計
      const [tokensResponse, usageResponse] = await Promise.all([
        fetch(`${API_URL}/api/tokens`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/usage/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (tokensResponse.ok && usageResponse.ok) {
        const tokensData = await tokensResponse.json();
        const usageData = await usageResponse.json();

        // 合併數據
        const mergedData = tokensData.map(t => {
          const usage = usageData.top_tokens.find(u => u.id === t.id) || {};
          return {
            ...t,
            usage_count: usage.usage_count || 0,
            success_rate: usage.success_rate || 100,
            avg_response_time: usage.avg_response_time || 0,
            last_used: usage.last_used || null
          };
        });

        // 按使用次數排序
        mergedData.sort((a, b) => b.usage_count - a.usage_count);

        setTokens(tokensData);
        setUsageStats(mergedData);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStats = usageStats.filter(stat =>
    stat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (stat.description && stat.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalCalls = usageStats.reduce((sum, stat) => sum + stat.usage_count, 0);
  const activeTokens = usageStats.filter(stat => stat.usage_count > 0).length;

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
            <Key size={32} style={{ color: 'var(--accent-primary)' }} />
            Token 使用詳情總覽
          </h1>
          <p className="subtitle">查看所有 Token 的使用情況和性能指標</p>
        </div>
      </div>

      {/* 統計卡片 */}
      <div className="stats-grid">
        <div className="stat-card stat-card-blue">
          <div className="stat-icon">
            <Key size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-title">總 Token 數</div>
            <div className="stat-value">{tokens.length}</div>
            <div className="stat-trend">{activeTokens} 個活躍中</div>
          </div>
        </div>

        <div className="stat-card stat-card-green">
          <div className="stat-icon">
            <Activity size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-title">總調用次數</div>
            <div className="stat-value">{totalCalls.toLocaleString()}</div>
            <div className="stat-trend">所有 Token 累計</div>
          </div>
        </div>

        <div className="stat-card stat-card-purple">
          <div className="stat-icon">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-title">活躍 Token</div>
            <div className="stat-value">{activeTokens}</div>
            <div className="stat-trend">有調用記錄</div>
          </div>
        </div>

        <div className="stat-card stat-card-cyan">
          <div className="stat-icon">
            <Calendar size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-title">閒置 Token</div>
            <div className="stat-value">{tokens.length - activeTokens}</div>
            <div className="stat-trend">未使用</div>
          </div>
        </div>
      </div>

      {/* 搜尋框 */}
      <div className="search-section">
        <div className="search-box-large">
          <Search size={20} />
          <input
            type="text"
            placeholder="搜尋 Token 名稱或描述..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Token 列表 */}
      <div className="token-usage-list">
        {filteredStats.length === 0 ? (
          <div className="empty-state">
            <Key size={64} style={{ opacity: 0.3 }} />
            <h3>沒有找到 Token</h3>
            <p>試試調整搜尋關鍵字</p>
          </div>
        ) : (
          <div className="token-cards-grid">
            {filteredStats.map((stat, index) => (
              <div
                key={stat.id}
                className="token-usage-card"
                onClick={() => navigate(`/token-usage/${stat.id}`)}
              >
                <div className="token-card-header">
                  <div className="token-card-rank">#{index + 1}</div>
                  <div className="token-card-title">
                    <h3>{stat.name}</h3>
                    {stat.status === 'active' && (
                      <span className="status-badge active">活躍</span>
                    )}
                    {stat.usage_count === 0 && (
                      <span className="status-badge inactive">未使用</span>
                    )}
                  </div>
                  <ArrowUpRight size={20} className="token-card-arrow" />
                </div>

                {stat.description && (
                  <p className="token-card-description">{stat.description}</p>
                )}

                <div className="token-card-stats">
                  <div className="token-card-stat">
                    <span className="label">調用次數</span>
                    <span className="value">{stat.usage_count.toLocaleString()}</span>
                  </div>
                  <div className="token-card-stat">
                    <span className="label">成功率</span>
                    <span className="value success">{stat.success_rate.toFixed(1)}%</span>
                  </div>
                  <div className="token-card-stat">
                    <span className="label">平均響應</span>
                    <span className="value">{stat.avg_response_time.toFixed(0)}ms</span>
                  </div>
                </div>

                {stat.last_used && (
                  <div className="token-card-footer">
                    <Calendar size={14} />
                    最後使用: {new Date(stat.last_used).toLocaleString('zh-TW')}
                  </div>
                )}

                {stat.scopes && stat.scopes.length > 0 && (
                  <div className="token-card-scopes">
                    {stat.scopes.slice(0, 3).map((scope, i) => (
                      <span key={i} className="scope-badge">{scope}</span>
                    ))}
                    {stat.scopes.length > 3 && (
                      <span className="scope-badge">+{stat.scopes.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

