"""
用戶邀請 API 路由
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from pydantic import BaseModel
from clerk_auth import verify_clerk_token, get_highest_role, clerk_client, NAMESPACE
from database import db

router = APIRouter(prefix="/api/invitations", tags=["invitations"])

class InviteUserRequest(BaseModel):
    email: str  # Email address
    team_roles: Dict[str, str]  # {team_id: role}

@router.post("")
async def invite_user(
    data: InviteUserRequest,
    current_user: Dict[str, Any] = Depends(verify_clerk_token)
):
    """
    邀請新用戶並分配團隊角色
    
    使用 Clerk Invitations API
    只有 ADMIN 可以邀請用戶
    """
    
    # === 1. 權限檢查 ===
    highest_role = get_highest_role(current_user)
    if highest_role != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Only ADMIN can invite users"
        )
    
    # === 2. 驗證團隊存在 ===
    async with db.pool.acquire() as conn:
        for team_id in data.team_roles.keys():
            team = await conn.fetchrow("SELECT id FROM teams WHERE id = $1", team_id)
            if not team:
                raise HTTPException(
                    status_code=400,
                    detail=f"Team does not exist: {team_id}"
                )
    
    # === 3. 驗證角色 ===
    valid_roles = ["ADMIN", "MANAGER", "DEVELOPER", "VIEWER"]
    for role in data.team_roles.values():
        if role not in valid_roles:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid role: {role}"
            )
    
    # === 4. 使用 Clerk Invitations API ===
    try:
        # 創建邀請，帶上團隊角色 metadata
        invitation = clerk_client.invitations.create(
            request={
                "email_address": data.email,
                "redirect_url": os.getenv("FRONTEND_URL", "http://localhost:5173"),  # 從環境變數讀取
                "public_metadata": {
                    f"{NAMESPACE}:teamRoles": data.team_roles,
                    f"{NAMESPACE}:invitedBy": current_user["id"],
                    f"{NAMESPACE}:invitedAt": datetime.utcnow().isoformat() + "Z"
                }
            }
        )
        
        print(f"✅ Created invitation for {data.email}")
        print(f"   Team roles: {data.team_roles}")
        
        return {
            "success": True,
            "invitation_id": invitation.id,
            "email": data.email,
            "team_roles": data.team_roles,
            "status": invitation.status
        }
        
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Failed to create invitation: {error_msg}")
        
        # 處理常見錯誤
        if 'already exists' in error_msg.lower() or 'duplicate' in error_msg.lower():
            raise HTTPException(
                status_code=400,
                detail=f"User with email {data.email} already exists or has a pending invitation"
            )
        
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create invitation: {error_msg}"
        )

@router.get("")
async def list_invitations(current_user: Dict[str, Any] = Depends(verify_clerk_token)):
    """
    列出所有待處理的邀請
    只有 ADMIN 可以查看
    """
    highest_role = get_highest_role(current_user)
    if highest_role != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Only ADMIN can view invitations"
        )
    
    try:
        # 獲取所有待處理的邀請
        invitations = clerk_client.invitations.list()
        
        result = []
        for inv in invitations:
            team_roles = (inv.public_metadata or {}).get(f"{NAMESPACE}:teamRoles", {})
            invited_by = (inv.public_metadata or {}).get(f"{NAMESPACE}:invitedBy")
            invited_at = (inv.public_metadata or {}).get(f"{NAMESPACE}:invitedAt")
            
            result.append({
                "id": inv.id,
                "email": inv.email_address,
                "status": inv.status,
                "team_roles": team_roles,
                "invited_by": invited_by,
                "invited_at": invited_at,
                "created_at": inv.created_at
            })
        
        return result
        
    except Exception as e:
        print(f"❌ Failed to list invitations: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list invitations: {str(e)}"
        )

@router.delete("/{invitation_id}")
async def revoke_invitation(
    invitation_id: str,
    current_user: Dict[str, Any] = Depends(verify_clerk_token)
):
    """
    撤銷邀請
    只有 ADMIN 可以撤銷
    """
    highest_role = get_highest_role(current_user)
    if highest_role != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Only ADMIN can revoke invitations"
        )
    
    try:
        clerk_client.invitations.revoke(invitation_id=invitation_id)
        
        print(f"✅ Revoked invitation: {invitation_id}")
        
        return {"success": True, "invitation_id": invitation_id}
        
    except Exception as e:
        print(f"❌ Failed to revoke invitation: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to revoke invitation: {str(e)}"
        )

