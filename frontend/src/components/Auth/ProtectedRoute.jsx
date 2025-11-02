import { useAuth } from '@clerk/clerk-react';
import { Navigate, useLocation } from 'react-router-dom';

export default function ProtectedRoute({ children, requiredPermission }) {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();

  // 等待 Clerk 載入
  if (!isLoaded) {
    return (
      <div className="loading">
        載入中...
      </div>
    );
  }

  // 未登入則導向登入頁，並記錄原本要去的位置
  if (!isSignedIn) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  // TODO: 如果有 requiredPermission，這裡可以加入權限檢查邏輯
  // 目前權限檢查在各個組件內部處理

  return children;
}
