import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '6rem', marginBottom: '1rem' }}>🔍</div>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#1e293b' }}>
        404 - 頁面不存在
      </h1>
      <p style={{ color: '#64748b', marginBottom: '2rem' }}>
        抱歉，您訪問的頁面不存在或已被移除
      </p>
      
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          onClick={() => navigate(-1)}
          className="btn btn-secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            border: '1px solid #e2e8f0',
            borderRadius: '0.5rem',
            background: 'white',
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={16} />
          返回上一頁
        </button>
        
        <button
          onClick={() => navigate('/')}
          className="btn btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            border: 'none',
            borderRadius: '0.5rem',
            background: '#3b82f6',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          <Home size={16} />
          回到首頁
        </button>
      </div>
    </div>
  );
}

