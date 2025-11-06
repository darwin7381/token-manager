"""
Cloudflare KV 同步模塊
"""
import httpx
import os
from typing import Dict, Any


class CloudflareKV:
    def __init__(self):
        self.account_id = os.getenv("CF_ACCOUNT_ID", "dummy")
        self.api_token = os.getenv("CF_API_TOKEN", "dummy")
        self.namespace_id = os.getenv("CF_KV_NAMESPACE_ID", "dummy")
        
        # 允許 dummy 憑證用於本地測試
        self.is_dummy = (self.account_id == "dummy" or self.api_token == "dummy")
        
        if self.is_dummy:
            print("⚠️  Warning: Using dummy Cloudflare credentials. KV sync will be skipped.")
        
        self.base_url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/storage/kv/namespaces/{self.namespace_id}"
        self.headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
    
    async def put_token(self, token_hash: str, data: Dict[str, Any]):
        """
        將 Token 數據寫入 KV
        Key: token:{hash}
        """
        if self.is_dummy:
            print(f"🔸 [DUMMY] Would sync token {token_hash[:8]}... to KV")
            return
        
        url = f"{self.base_url}/values/token:{token_hash}"
        
        async with httpx.AsyncClient() as client:
            response = await client.put(
                url,
                headers=self.headers,
                json=data,
                timeout=30.0
            )
            
            if response.status_code not in [200, 201]:
                raise Exception(f"Failed to sync token to Cloudflare KV: {response.text}")
    
    async def delete_token(self, token_hash: str):
        """
        從 KV 刪除 Token
        """
        if self.is_dummy:
            print(f"🔸 [DUMMY] Would delete token {token_hash[:8]}... from KV")
            return
        
        url = f"{self.base_url}/values/token:{token_hash}"
        
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                url,
                headers=self.headers,
                timeout=30.0
            )
            
            # 刪除時即使 key 不存在也返回成功
            if response.status_code not in [200, 204]:
                raise Exception(f"Failed to delete token from Cloudflare KV: {response.text}")
    
    async def put_routes(self, routes: Dict[str, str]):
        """
        更新所有路由映射
        Key: routes
        Value: {path: backend_url}
        """
        if self.is_dummy:
            print(f"🔸 [DUMMY] Would sync {len(routes)} routes to KV")
            return
        
        url = f"{self.base_url}/values/routes"
        
        async with httpx.AsyncClient() as client:
            response = await client.put(
                url,
                headers=self.headers,
                json=routes,
                timeout=30.0
            )
            
            if response.status_code not in [200, 201]:
                raise Exception(f"Failed to sync routes to Cloudflare KV: {response.text}")

    async def put_secret(self, secret_name: str, secret_value: str):
        """
        將實際的密鑰儲存到 KV (作為加密環境變數)
        Key: secret:{name}
        Value: {encrypted_value}
        """
        if self.is_dummy:
            print(f"🔸 [DUMMY] Would store secret {secret_name} to KV")
            return
        
        url = f"{self.base_url}/values/secret:{secret_name}"
        
        async with httpx.AsyncClient() as client:
            response = await client.put(
                url,
                headers=self.headers,
                json={"value": secret_value},  # Cloudflare KV 會加密儲存
                timeout=30.0
            )
            
            if response.status_code not in [200, 201]:
                raise Exception(f"Failed to store secret to Cloudflare KV: {response.text}")
    
    async def list_keys(self, prefix: str = "", limit: int = 1000, cursor: str = None):
        """
        列出 KV 中的 keys
        
        Args:
            prefix: Key 前綴（如 "token:" 或 "route:"）
            limit: 每頁數量（最大 1000）
            cursor: 分頁游標
        
        Returns:
            {
                "keys": [...],
                "cursor": "next_cursor" or None,
                "list_complete": True/False
            }
        """
        if self.is_dummy:
            print(f"🔸 [DUMMY] Would list keys with prefix '{prefix}'")
            return {"keys": [], "cursor": None, "list_complete": True}
        
        url = f"{self.base_url}/keys"
        params = {"limit": limit}
        if prefix:
            params["prefix"] = prefix
        if cursor:
            params["cursor"] = cursor
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers=self.headers,
                params=params,
                timeout=30.0
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to list KV keys: {response.text}")
            
            data = response.json()
            result = data.get("result", [])
            result_info = data.get("result_info", {})
            
            return {
                "keys": result,  # result 是 list of {name: "key"}
                "cursor": result_info.get("cursor"),
                "list_complete": result_info.get("cursor") is None
            }
    
    async def get_value(self, key: str):
        """
        從 KV 讀取值
        
        Args:
            key: 完整的 key（如 "token:abc123" 或 "routes"）
        
        Returns:
            dict or None
        """
        if self.is_dummy:
            print(f"🔸 [DUMMY] Would get value for key '{key}'")
            return None
        
        url = f"{self.base_url}/values/{key}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers=self.headers,
                timeout=30.0
            )
            
            if response.status_code == 404:
                return None
            
            if response.status_code != 200:
                raise Exception(f"Failed to get KV value: {response.text}")
            
            try:
                return response.json()
            except:
                return response.text


# 全局 Cloudflare KV 實例 (懶加載)
cf_kv = None

def get_cf_kv():
    global cf_kv
    if cf_kv is None:
        cf_kv = CloudflareKV()
    return cf_kv

