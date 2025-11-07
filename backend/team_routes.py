"""
團隊管理 API 路由
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from pydantic import BaseModel
from datetime import datetime
from clerk_auth import verify_clerk_token, get_highest_role, get_user_role_in_team, NAMESPACE
from database import db

router = APIRouter(prefix="/api/teams", tags=["teams"])

class TeamCreate(BaseModel):
    id: str
    name: str
    description: str = ""
    color: str = "#3b82f6"
    icon: str = ""

class TeamUpdate(BaseModel):
    name: str = None
    description: str = None
    color: str = None
    icon: str = None

class TeamResponse(BaseModel):
    id: str
    name: str
    description: str
    color: str
    icon: str
    created_at: datetime
    created_by: str
    member_count: int = 0

@router.get("", response_model=List[TeamResponse])
async def list_teams(current_user: Dict[str, Any] = Depends(verify_clerk_token)):
    """
    列出所有團隊
    所有登入用戶都可以查看
    """
    async with db.pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, name, description, color, icon, created_at, created_by
            FROM teams
            ORDER BY created_at DESC
        """)
    
    # 獲取所有用戶以統計成員數
    from clerk_auth import clerk_client
    
    try:
        users_response = clerk_client.users.list(request={"limit": 100})
        
        # 統計每個團隊的成員數
        team_member_counts = {}
        for user in users_response:
            team_roles = (user.public_metadata or {}).get(f"{NAMESPACE}:teamRoles", {})
            for team_id in team_roles.keys():
                team_member_counts[team_id] = team_member_counts.get(team_id, 0) + 1
        
        teams = []
        for row in rows:
            team_id = row['id']
            teams.append(TeamResponse(
                **dict(row),
                member_count=team_member_counts.get(team_id, 0)
            ))
        
        return teams
        
    except Exception as e:
        print(f"❌ Failed to count team members: {e}")
        # 如果統計失敗，仍返回團隊列表但成員數為 0
        teams = []
        for row in rows:
            teams.append(TeamResponse(**dict(row), member_count=0))
        return teams

@router.post("", response_model=TeamResponse)
async def create_team(
    data: TeamCreate,
    current_user: Dict[str, Any] = Depends(verify_clerk_token)
):
    """
    創建新團隊
    只有 ADMIN 可以創建
    創建者自動成為該團隊的 ADMIN
    """
    # 檢查權限：必須是 ADMIN（在任一團隊）
    highest_role = get_highest_role(current_user)
    if highest_role != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Only ADMIN can create teams"
        )
    
    # 驗證 team_id 格式
    if not data.id or ' ' in data.id:
        raise HTTPException(
            status_code=400,
            detail="Team ID must not be empty or contain spaces"
        )
    
    async with db.pool.acquire() as conn:
        try:
            # 插入新團隊
            await conn.execute("""
                INSERT INTO teams (id, name, description, color, icon, created_by)
                VALUES ($1, $2, $3, $4, $5, $6)
            """, data.id, data.name, data.description, data.color, data.icon, current_user["id"])
            
            print(f"✅ Created team: {data.id}")
            
        except Exception as e:
            if 'unique' in str(e).lower() or 'duplicate' in str(e).lower():
                raise HTTPException(
                    status_code=400,
                    detail=f"Team ID '{data.id}' already exists"
                )
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create team: {str(e)}"
            )
    
    # 自動將創建者加為該團隊的 ADMIN
    from clerk_auth import clerk_client, get_all_user_team_roles
    
    try:
        import json
        # 獲取創建者的當前 teamRoles
        creator = clerk_client.users.get(user_id=current_user["id"])
        # 安全地轉換 public_metadata
        if creator.public_metadata:
            if isinstance(creator.public_metadata, dict):
                creator_metadata = dict(creator.public_metadata)
            else:
                creator_metadata = json.loads(json.dumps(creator.public_metadata))
        else:
            creator_metadata = {}
        
        team_roles = dict(creator_metadata.get(f"{NAMESPACE}:teamRoles", {}))  # 複製一份！
        
        # 添加新團隊的 ADMIN 角色
        team_roles[data.id] = "ADMIN"
        
        # 更新 metadata
        updated_metadata = creator_metadata.copy()
        updated_metadata[f"{NAMESPACE}:teamRoles"] = team_roles
        
        clerk_client.users.update_metadata(
            user_id=current_user["id"],
            public_metadata=updated_metadata
        )
        
        print(f"✅ Added creator as ADMIN of team {data.id}")
        
    except Exception as e:
        print(f"⚠️ Failed to add creator as ADMIN: {e}")
        # 不拋錯，團隊已創建
    
    # 獲取創建的團隊
    async with db.pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT id, name, description, color, icon, created_at, created_by
            FROM teams
            WHERE id = $1
        """, data.id)
    
    return TeamResponse(**dict(row), member_count=1)  # 創建者算一個成員

@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: str,
    current_user: Dict[str, Any] = Depends(verify_clerk_token)
):
    """
    獲取團隊詳情
    所有登入用戶都可以查看
    """
    async with db.pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT id, name, description, color, icon, created_at, created_by
            FROM teams
            WHERE id = $1
        """, team_id)
    
    if not row:
        raise HTTPException(status_code=404, detail="Team not found")
    
    return TeamResponse(**dict(row), member_count=0)

@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: str,
    data: TeamUpdate,
    current_user: Dict[str, Any] = Depends(verify_clerk_token)
):
    """
    更新團隊信息
    規則：
    - 該團隊的 ADMIN 可以更新
    - 如果團隊沒有成員，任何 ADMIN（在其他團隊）可以認領並更新
    """
    # 檢查權限
    my_role_in_team = get_user_role_in_team(current_user, team_id)
    highest_role = get_highest_role(current_user)
    
    # 如果不是該團隊的 ADMIN
    if my_role_in_team != "ADMIN":
        # 檢查是否可以認領空團隊
        if highest_role == "ADMIN":
            # 檢查團隊是否為空
            from clerk_auth import clerk_client
            users_response = clerk_client.users.list(request={"limit": 100})
            
            team_members = []
            for user in users_response:
                team_roles = (user.public_metadata or {}).get(f"{NAMESPACE}:teamRoles", {})
                if team_id in team_roles:
                    team_members.append(user.id)
            
            if len(team_members) == 0:
                # 空團隊，允許認領
                print(f"✅ Empty team {team_id} can be claimed by ADMIN {current_user['id']}")
            else:
                raise HTTPException(
                    status_code=403,
                    detail="Only team ADMIN can update team information"
                )
        else:
            raise HTTPException(
                status_code=403,
                detail="Only team ADMIN can update team information"
            )
    
    # 構建更新語句
    updates = []
    params = []
    param_count = 1
    
    if data.name is not None:
        updates.append(f"name = ${param_count}")
        params.append(data.name)
        param_count += 1
    
    if data.description is not None:
        updates.append(f"description = ${param_count}")
        params.append(data.description)
        param_count += 1
    
    if data.color is not None:
        updates.append(f"color = ${param_count}")
        params.append(data.color)
        param_count += 1
    
    if data.icon is not None:
        updates.append(f"icon = ${param_count}")
        params.append(data.icon)
        param_count += 1
    
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    updates.append(f"updated_at = NOW()")
    params.append(team_id)
    
    async with db.pool.acquire() as conn:
        query = f"UPDATE teams SET {', '.join(updates)} WHERE id = ${param_count}"
        await conn.execute(query, *params)
        
        row = await conn.fetchrow("""
            SELECT id, name, description, color, icon, created_at, created_by
            FROM teams
            WHERE id = $1
        """, team_id)
    
    if not row:
        raise HTTPException(status_code=404, detail="Team not found")
    
    return TeamResponse(**dict(row), member_count=0)

@router.delete("/{team_id}")
async def delete_team(
    team_id: str,
    current_user: Dict[str, Any] = Depends(verify_clerk_token)
):
    """
    刪除團隊
    只有系統 ADMIN 可以刪除
    必須先移除所有成員
    """
    # 檢查權限：必須是系統 ADMIN
    highest_role = get_highest_role(current_user)
    if highest_role != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Only ADMIN can delete teams"
        )
    
    # 檢查是否有成員
    from clerk_auth import clerk_client
    
    try:
        users_response = clerk_client.users.list(request={"limit": 100})
        
        members = []
        for user in users_response:
            team_roles = (user.public_metadata or {}).get(f"{NAMESPACE}:teamRoles", {})
            if team_id in team_roles:
                members.append({
                    "id": user.id,
                    "email": user.email_addresses[0].email_address if user.email_addresses else "Unknown"
                })
        
        if members:
            member_emails = [m["email"] for m in members[:5]]  # 最多顯示 5 個
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete team with {len(members)} members. Please remove all members first. Members: {', '.join(member_emails)}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"⚠️ Failed to check members: {e}")
        # 如果檢查失敗，為安全起見拒絕刪除
        raise HTTPException(
            status_code=500,
            detail="Failed to verify team members. Cannot delete team."
        )
    
    # 刪除團隊
    async with db.pool.acquire() as conn:
        result = await conn.execute("""
            DELETE FROM teams WHERE id = $1
        """, team_id)
        
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Team not found")
    
    print(f"✅ Deleted team: {team_id}")
    
    return {"success": True, "team_id": team_id}

@router.get("/{team_id}/members")
async def get_team_members(
    team_id: str,
    current_user: Dict[str, Any] = Depends(verify_clerk_token)
):
    """
    獲取團隊成員列表
    該團隊的成員或 ADMIN 可以查看
    """
    # 檢查團隊是否存在
    async with db.pool.acquire() as conn:
        team = await conn.fetchrow("SELECT id FROM teams WHERE id = $1", team_id)
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # 檢查權限
    my_role_in_team = get_user_role_in_team(current_user, team_id)
    highest_role = get_highest_role(current_user)
    
    if not my_role_in_team and highest_role != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="You must be a team member or ADMIN to view team members"
        )
    
    # 獲取所有用戶並過濾出該團隊的成員
    from clerk_auth import clerk_client
    
    try:
        users_response = clerk_client.users.list(request={"limit": 100})
        
        members = []
        for user in users_response:
            team_roles = (user.public_metadata or {}).get(f"{NAMESPACE}:teamRoles", {})
            
            if team_id in team_roles:
                primary_email = None
                if user.email_addresses and len(user.email_addresses) > 0:
                    primary_email = user.email_addresses[0].email_address if hasattr(user.email_addresses[0], 'email_address') else str(user.email_addresses[0])
                
                members.append({
                    "id": user.id,
                    "email": primary_email,
                    "firstName": user.first_name,
                    "lastName": user.last_name,
                    "imageUrl": user.image_url,
                    "role": team_roles[team_id],
                    "lastSignInAt": user.last_sign_in_at
                })
        
        print(f"✅ Found {len(members)} members in team {team_id}")
        return members
        
    except Exception as e:
        print(f"❌ Failed to get team members: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get team members: {str(e)}")

