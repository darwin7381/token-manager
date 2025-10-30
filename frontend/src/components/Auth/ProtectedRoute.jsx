import { useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth();

  // 等待 Clerk 載入
  if (!isLoaded) {
    return (
      <div className="loading">
        載入中...
      </div>
    );
  }

  // 未登入則導向登入頁
  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return children;
}

