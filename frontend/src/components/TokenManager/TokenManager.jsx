import { useState } from 'react';
import { Plus } from 'lucide-react';
import CreateTokenModal from './CreateTokenModal';
import TokenList from './TokenList';

export default function TokenManager() {
  const [refresh, setRefresh] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button 
          className="btn btn-success"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={18} /> 創建新 Token
        </button>
      </div>
      
      <TokenList key={refresh} onUpdate={() => setRefresh(r => r + 1)} />

      {showCreateModal && (
        <CreateTokenModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setRefresh(r => r + 1);
            setShowCreateModal(false);
          }}
        />
      )}
    </>
  );
}
