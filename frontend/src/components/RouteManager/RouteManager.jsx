import { useState } from 'react';
import { Plus } from 'lucide-react';
import RouteForm from './RouteForm';
import RouteList from './RouteList';

export default function RouteManager() {
  const [refresh, setRefresh] = useState(0);
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button 
          className="btn btn-success"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={18} /> {showForm ? '取消新增' : '新增路由'}
        </button>
      </div>
      
      {showForm && (
        <RouteForm 
          onRouteCreated={() => {
            setRefresh(r => r + 1);
            setShowForm(false);
          }} 
        />
      )}
      
      <RouteList key={refresh} onUpdate={() => setRefresh(r => r + 1)} />
    </>
  );
}
