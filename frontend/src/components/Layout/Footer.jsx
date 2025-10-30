export default function Footer() {
  return (
    <div className="footer">
      <div>
        © 2025 Token Manager System | 
        <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
          由 AI 開發團隊打造
        </span>
      </div>
      
      <div className="footer-links">
        <a href="https://github.com" className="footer-link" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        <a href="http://localhost:8000/docs" className="footer-link" target="_blank" rel="noopener noreferrer">
          API 文檔
        </a>
        <a href="https://api-gateway.cryptoxlab.workers.dev" className="footer-link" target="_blank" rel="noopener noreferrer">
          Worker Gateway
        </a>
        <span className="footer-link" style={{ cursor: 'default' }}>
          狀態: <span style={{ color: 'var(--accent-success)' }}>● 運行中</span>
        </span>
      </div>
    </div>
  );
}
