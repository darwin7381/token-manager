import { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Database, 
  Cloud, 
  Shield,
  Activity
} from 'lucide-react';
import './SystemHealth.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function SystemHealth() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  useEffect(() => {
    checkHealth();
    // 每 30 秒自動刷新
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 健康檢查不需要認證，直接調用
      const response = await fetch(`${API_URL}/health/detailed`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Health check failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      setHealth(result);
      setLastChecked(new Date());
    } catch (err) {
      console.error('Error checking health:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="status-icon status-healthy" size={24} />;
      case 'warning':
        return <AlertTriangle className="status-icon status-warning" size={24} />;
      case 'unhealthy':
        return <XCircle className="status-icon status-unhealthy" size={24} />;
      case 'skipped':
        return <AlertTriangle className="status-icon status-skipped" size={24} />;
      default:
        return <Activity className="status-icon status-unknown" size={24} />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'healthy':
        return '正常';
      case 'warning':
        return '警告';
      case 'unhealthy':
        return '異常';
      case 'skipped':
        return '跳過';
      default:
        return '未知';
    }
  };

  const getServiceIcon = (serviceName) => {
    switch (serviceName) {
      case 'database':
        return <Database size={20} />;
      case 'cloudflare_kv':
        return <Cloud size={20} />;
      case 'clerk':
        return <Shield size={20} />;
      default:
        return <Activity size={20} />;
    }
  };

  const getServiceName = (serviceName) => {
    switch (serviceName) {
      case 'database':
        return '數據庫';
      case 'cloudflare_kv':
        return 'Cloudflare KV';
      case 'clerk':
        return 'Clerk 認證';
      default:
        return serviceName;
    }
  };

  if (loading && !health) {
    return (
      <div className="system-health-container">
        <div className="loading-state">
          <Activity className="animate-spin" size={48} />
          <p>檢查系統狀態...</p>
        </div>
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="system-health-container">
        <div className="error-state">
          <XCircle size={48} />
          <h3>無法獲取系統狀態</h3>
          <p>{error}</p>
          <button onClick={checkHealth} className="btn-primary">
            重試
          </button>
        </div>
      </div>
    );
  }

  const overallStatus = health?.status || 'unknown';
  const checks = health?.checks || {};

  return (
    <div className="system-health-container">
      <div className="health-header">
        <div>
          <h1>🏥 系統健康監控</h1>
          <p className="subtitle">即時系統狀態與服務監控</p>
        </div>
        <button 
          onClick={checkHealth} 
          className="btn-secondary"
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {loading ? '檢查中...' : '立即檢查'}
        </button>
      </div>

      {/* 整體狀態卡片 */}
      <div className={`overall-status status-${overallStatus}`}>
        <div className="overall-status-content">
          <div className="overall-status-icon">
            {getStatusIcon(overallStatus)}
          </div>
          <div className="overall-status-info">
            <h2>系統狀態</h2>
            <div className="overall-status-text">
              {getStatusText(overallStatus)}
            </div>
            <div className="overall-status-details">
              版本: {health?.version || 'Unknown'} | 
              服務: {health?.service || 'Unknown'}
            </div>
            {lastChecked && (
              <div className="last-checked">
                最後檢查: {lastChecked.toLocaleString('zh-TW')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 服務檢查列表 */}
      <div className="services-grid">
        {Object.entries(checks).map(([serviceName, checkResult]) => (
          <ServiceCard
            key={serviceName}
            serviceName={serviceName}
            checkResult={checkResult}
            icon={getServiceIcon(serviceName)}
            displayName={getServiceName(serviceName)}
            getStatusIcon={getStatusIcon}
            getStatusText={getStatusText}
          />
        ))}
      </div>

      {/* 系統資訊 */}
      {health?.timestamp && (
        <div className="system-info">
          <h3>系統資訊</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">檢查時間:</span>
              <span className="info-value">
                {new Date(health.timestamp).toLocaleString('zh-TW')}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">服務版本:</span>
              <span className="info-value">{health.version}</span>
            </div>
            <div className="info-item">
              <span className="info-label">服務名稱:</span>
              <span className="info-value">{health.service}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceCard({ serviceName, checkResult, icon, displayName, getStatusIcon, getStatusText }) {
  const status = checkResult.status;
  
  return (
    <div className={`service-card service-${status}`}>
      <div className="service-header">
        <div className="service-icon-wrapper">
          {icon}
        </div>
        <div className="service-name">{displayName}</div>
      </div>
      <div className="service-status">
        {getStatusIcon(status)}
        <span className="service-status-text">{getStatusText(status)}</span>
      </div>
      <div className="service-message">
        {checkResult.message}
      </div>
    </div>
  );
}

export default SystemHealth;

