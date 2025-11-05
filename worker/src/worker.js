/**
 * Cloudflare Worker - API Gateway
 * 
 * 職責:
 * 1. 驗證 API Key
 * 2. 路由轉發
 * 3. 返回響應
 * 
 * 注意: 此代碼幾乎永遠不需要修改!
 * 所有配置都在 KV 中,由管理系統動態更新。
 */

export default {
  async fetch(request, env, ctx) {
    try {
      // 1. 提取 API Key
      const apiKey = request.headers.get('X-API-Key');
      
      if (!apiKey) {
        return jsonResponse({
          error: 'Missing API Key',
          message: 'Please provide X-API-Key header'
        }, 401);
      }
      
      // 2. 計算 token hash (與後端一致的算法)
      const tokenHash = await sha256(apiKey);
      
      // 3. 從 KV 查詢 token
      const tokenData = await env.TOKENS.get(`token:${tokenHash}`, { type: 'json' });
      
      if (!tokenData) {
        return jsonResponse({
          error: 'Invalid API Key',
          message: 'The provided API Key is invalid or has been revoked'
        }, 401);
      }
      
      // 4. 檢查過期
      if (tokenData.expires_at) {
        const expiresAt = new Date(tokenData.expires_at);
        if (expiresAt < new Date()) {
          return jsonResponse({
            error: 'Token Expired',
            message: 'The API Key has expired'
          }, 401);
        }
      }
      
      // 5. 獲取路由映射
      const routes = await env.TOKENS.get('routes', { type: 'json' });
      
      if (!routes || Object.keys(routes).length === 0) {
        return jsonResponse({
          error: 'Routes Not Configured',
          message: 'No routes have been configured'
        }, 500);
      }
      
      // 6. 匹配路由
      const url = new URL(request.url);
      let backend = null;
      let matchedPath = null;
      let routeTags = [];
      
      // 按路徑長度降序排序,確保最具體的路徑優先匹配
      const sortedPaths = Object.keys(routes).sort((a, b) => b.length - a.length);
      
      let routeAuth = null;
      
      for (const path of sortedPaths) {
        if (url.pathname.startsWith(path)) {
          const routeData = routes[path];
          // 支持新舊兩種格式
          if (typeof routeData === 'string') {
            // 舊格式: {path: "url"}
            backend = routeData;
            routeTags = [];
            routeAuth = null;
          } else {
            // 新格式: {path: {url: "url", tags: [...], auth: {...}}}
            backend = routeData.url;
            routeTags = routeData.tags || [];
            routeAuth = routeData.auth || null;
          }
          matchedPath = path;
          break;
        }
      }
      
      if (!backend) {
        return jsonResponse({
          error: 'Route Not Found',
          message: `No route configured for ${url.pathname}`
        }, 404);
      }
      
      // 7. 檢查權限範圍 (Scopes)
      // 支持三種權限模式:
      // 1. '*' - 全部權限
      // 2. 具體路徑 (如 'image') - 匹配 /api/image
      // 3. 標籤權限 (如 'tag:media') - 匹配所有包含該標籤的路由
      
      const scopes = tokenData.scopes || [];
      
      // 如果有 * 權限，直接通過
      if (scopes.includes('*')) {
        // 有全部權限，通過
      } else {
        // 提取服務名稱 (例如 /api/image -> image)
        const pathParts = matchedPath.split('/').filter(s => s);
        const serviceName = pathParts.length >= 2 ? pathParts[1] : null;
        
        let hasPermission = false;
        
        // 檢查具體路徑權限
        if (serviceName && scopes.includes(serviceName)) {
          hasPermission = true;
        }
        
        // 檢查標籤權限
        if (!hasPermission && routeTags.length > 0) {
          // 獲取所有 tag: 開頭的 scopes
          const tagScopes = scopes
            .filter(s => s.startsWith('tag:'))
            .map(s => s.substring(4)); // 移除 'tag:' 前綴
          
          // 檢查路由的 tags 是否包含任一 token scope
          const hasTagMatch = tagScopes.some(tagScope => routeTags.includes(tagScope));
          
          if (hasTagMatch) {
            hasPermission = true;
          }
        }
        
        if (!hasPermission) {
          return jsonResponse({
            error: 'Permission Denied',
            message: `Token does not have permission for '${serviceName}'. Available scopes: ${scopes.join(', ')}`
          }, 403);
        }
      }
      
      // 8. 構建後端 URL
      // 移除匹配的路徑前綴
      const backendPath = url.pathname.substring(matchedPath.length);
      const backendUrl = backend + backendPath + url.search;
      
      // 9. 準備後端請求的 headers（添加後端認證）
      const backendHeaders = new Headers(request.headers);
      
      // 添加後端微服務認證
      if (routeAuth && routeAuth.type && routeAuth.type !== 'none') {
        const authType = routeAuth.type;
        const authConfig = routeAuth.config || {};
        
        try {
          switch (authType) {
            case 'bearer':
              // Bearer Token 認證
              // 先嘗試從 env 讀取（wrangler secret），再從 KV 讀取（UI 設定）
              let bearerToken = env[authConfig.token_ref];
              if (!bearerToken && authConfig.token_ref) {
                const secretData = await env.TOKENS.get(`secret:${authConfig.token_ref}`, { type: 'json' });
                bearerToken = secretData?.value;
              }
              if (bearerToken) {
                backendHeaders.set('Authorization', `Bearer ${bearerToken}`);
              }
              break;
            
            case 'api-key':
              // API Key 認證
              let apiKey = env[authConfig.key_ref];
              if (!apiKey && authConfig.key_ref) {
                const secretData = await env.TOKENS.get(`secret:${authConfig.key_ref}`, { type: 'json' });
                apiKey = secretData?.value;
              }
              if (apiKey) {
                const headerName = authConfig.header_name || 'X-API-Key';
                backendHeaders.set(headerName, apiKey);
              }
              break;
            
            case 'basic':
              // Basic Auth 認證
              let username = env[authConfig.username_ref];
              let password = env[authConfig.password_ref];
              
              if (!username && authConfig.username_ref) {
                const secretData = await env.TOKENS.get(`secret:${authConfig.username_ref}`, { type: 'json' });
                username = secretData?.value;
              }
              if (!password && authConfig.password_ref) {
                const secretData = await env.TOKENS.get(`secret:${authConfig.password_ref}`, { type: 'json' });
                password = secretData?.value;
              }
              
              if (username && password) {
                const credentials = btoa(`${username}:${password}`);
                backendHeaders.set('Authorization', `Basic ${credentials}`);
              }
              break;
          }
        } catch (error) {
          console.error('Backend auth error:', error);
          // 繼續轉發，但沒有後端認證
        }
      }
      
      // 10. 轉發請求
      const backendRequest = new Request(backendUrl, {
        method: request.method,
        headers: backendHeaders,
        body: request.body,
        redirect: 'follow'
      });
      
      // 11. 發送請求並計時
      const startTime = Date.now();
      const response = await fetch(backendRequest);
      const responseTime = Date.now() - startTime;
      
      // 12. 記錄 Token 使用情況（異步，不阻塞響應）
      // 使用 ctx.waitUntil 確保在響應返回後繼續執行
      ctx.waitUntil(
        logTokenUsage({
          tokenHash,
          routePath: matchedPath,
          responseStatus: response.status,
          responseTime,
          ipAddress: request.headers.get('cf-connecting-ip'),
          userAgent: request.headers.get('user-agent'),
          requestMethod: request.method,
          errorMessage: response.ok ? null : `HTTP ${response.status}`
        }, env)
      );
      
      return response;
      
    } catch (error) {
      return jsonResponse({
        error: 'Internal Server Error',
        message: error.message,
        stack: error.stack
      }, 500);
    }
  }
};

/**
 * 計算 SHA256 hash
 */
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * 返回 JSON 響應
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    }
  });
}

/**
 * 記錄 Token 使用情況到後端
 * 使用異步方式，不阻塞主請求
 */
async function logTokenUsage(usageData, env) {
  try {
    // 從環境變數獲取後端 URL
    // 生產環境: https://token.blocktempo.ai
    // 開發環境: http://localhost:8000
    const backendUrl = env.TOKEN_MANAGER_BACKEND || 'https://token.blocktempo.ai';
    
    const payload = {
      token_hash: usageData.tokenHash,
      route: usageData.routePath,
      timestamp: Date.now(),
      response_status: usageData.responseStatus,
      response_time_ms: usageData.responseTime,
      ip_address: usageData.ipAddress,
      user_agent: usageData.userAgent,
      request_method: usageData.requestMethod,
      error_message: usageData.errorMessage
    };
    
    const response = await fetch(`${backendUrl}/api/usage-log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      // 5 秒超時，避免阻塞太久
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      console.error('Usage log failed:', response.status, await response.text());
    }
  } catch (error) {
    // 記錄失敗不影響主流程
    console.error('Failed to log token usage:', error.message);
  }
}

