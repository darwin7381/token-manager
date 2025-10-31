"""
用戶管理 API 路由
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from pydantic import BaseModel
import os
from clerk_auth import verify_clerk_token, check_permission, NAMESPACE, clerk_client

router = APIRouter(prefix="/api/users", tags=["users"])

class UpdateRoleRequest(BaseModel):
    role: str
    team: str = None

@router.get("")
async def list_users(current_user: Dict[str, Any] = Depends(verify_clerk_token)):
    """
    獲取所有用戶列表
    需要 MANAGER 以上權限
    """
    # 檢查權限
    if not check_permission(current_user, "MANAGER"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    try:
        # 使用 Clerk SDK 獲取所有用戶（正確的 API 用法）
        users_response = clerk_client.users.list(request={
            "limit": 100,
            "offset": 0
        })
        
        # 轉換為字典列表（統一前端命名）
        users = []
        for user in users_response:
            # 提取主要 email
            primary_email = None
            if user.email_addresses and len(user.email_addresses) > 0:
                # email_addresses 是物件列表，需要獲取 email_address 屬性
                primary_email = user.email_addresses[0].email_address if hasattr(user.email_addresses[0], 'email_address') else str(user.email_addresses[0])
            
            users.append({
                "id": user.id,
                "email": primary_email,  # 前端用 user.email
                "firstName": user.first_name,  # 前端用 user.firstName
                "lastName": user.last_name,  # 前端用 user.lastName
                "imageUrl": user.image_url,  # 前端用 user.imageUrl
                "publicMetadata": user.public_metadata or {},  # 前端用 user.publicMetadata
                "createdAt": user.created_at
            })
        
        print(f"✅ Returning {len(users)} users")
        return users
            
    except Exception as e:
        print(f"❌ Failed to fetch users: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {str(e)}")

@router.put("/{user_id}/role")
async def update_user_role(
    user_id: str,
    data: UpdateRoleRequest,
    current_user: Dict[str, Any] = Depends(verify_clerk_token)
):
    """
    更新用戶角色
    ADMIN 可以更新所有人
    MANAGER 只能更新自己團隊的成員
    """
    # 檢查權限
    if not check_permission(current_user, "MANAGER"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # 驗證角色
    valid_roles = ["ADMIN", "MANAGER", "DEVELOPER", "VIEWER"]
    if data.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role: {data.role}")
    
    # MANAGER 和 DEVELOPER 必須有團隊
    if data.role in ["MANAGER", "DEVELOPER"] and not data.team:
        raise HTTPException(status_code=400, detail=f"{data.role} role requires a team")
    
    # 獲取目標用戶資訊
    try:
        target_user = clerk_client.users.get(user_id=user_id)
        existing_metadata = dict(target_user.public_metadata or {})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch target user: {str(e)}")
    
    # 如果不是 ADMIN，檢查是否只能管理自己團隊
    current_role = current_user.get("public_metadata", {}).get(f"{NAMESPACE}:role")
    if current_role == "MANAGER":
        current_team = current_user.get("public_metadata", {}).get(f"{NAMESPACE}:team")
        target_team = existing_metadata.get(f"{NAMESPACE}:team")
        
        # MANAGER 只能管理自己團隊的成員
        if target_team != current_team:
            raise HTTPException(
                status_code=403, 
                detail="You can only manage users in your team"
            )
    
    # 構建要更新的 metadata（合併現有的非 tokenManager 欄位）
    # 保留其他應用的 metadata，只更新 tokenManager 的欄位
    updated_metadata = existing_metadata.copy()
    updated_metadata[f"{NAMESPACE}:role"] = data.role
    updated_metadata[f"{NAMESPACE}:updatedAt"] = __import__('datetime').datetime.utcnow().isoformat() + "Z"
    
    # 設置或清除團隊
    if data.team:
        updated_metadata[f"{NAMESPACE}:team"] = data.team
    else:
        # 如果角色不需要團隊（ADMIN, VIEWER），移除團隊欄位
        updated_metadata.pop(f"{NAMESPACE}:team", None)
    
    # 更新用戶 metadata
    try:
        clerk_client.users.update_metadata(
            user_id=user_id,
            public_metadata=updated_metadata
        )
        
        print(f"✅ Successfully updated user {user_id}: role={data.role}, team={data.team}")
        
        return {"success": True, "user_id": user_id, "role": data.role, "team": data.team}
            
    except Exception as e:
        print(f"❌ Failed to update user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update user: {str(e)}")

