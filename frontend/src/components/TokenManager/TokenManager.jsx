import { useState } from 'react';
import { Plus } from 'lucide-react';
import TokenForm from './TokenForm';
import TokenList from './TokenList';

export default function TokenManager() {
  const [refresh, setRefresh] = useState(0);
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button 
          className="btn btn-success"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={18} /> {showForm ? '取消創建' : '創建新 Token'}
        </button>
      </div>
      
      {showForm && (
        <TokenForm 
          onTokenCreated={() => {
            setRefresh(r => r + 1);
            setShowForm(false);
          }} 
        />
      )}
      
      <TokenList key={refresh} onUpdate={() => setRefresh(r => r + 1)} />
    </>
  );
}
