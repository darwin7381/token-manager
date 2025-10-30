/**
 * API 客戶端工具
 * 自動處理認證 token
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * 創建帶認證的 fetch 請求
 * @param {string} getToken - Clerk 的 getToken 函數
 */
export const createAuthenticatedFetch = (getToken) => {
  return async (endpoint, options = {}) => {
    try {
      // 獲取 Clerk session token
      const token = await getToken();
      
      // 合併 headers
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
      };
      
      // 如果有 token，加入 Authorization header
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // 發送請求
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });
      
      // 處理錯誤
      if (!response.ok) {
        let errorMessage = 'Request failed';
        try {
          const error = await response.json();
          errorMessage = error.detail || error.message || errorMessage;
        } catch {
          errorMessage = `Request failed with status ${response.status}`;
        }
        throw new Error(errorMessage);
      }
      
      // 如果是 DELETE 且沒有內容，返回空對象
      if (response.status === 204) {
        return {};
      }
      
      return response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };
};

