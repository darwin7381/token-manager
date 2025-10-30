"""
Pydantic 數據模型
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class TokenCreate(BaseModel):
    """創建 Token 請求模型"""
    name: str = Field(..., min_length=1, max_length=255, description="Token 名稱")
    department: str = Field(..., min_length=1, max_length=100, description="所屬部門")
    scopes: List[str] = Field(..., min_items=1, description="權限範圍")
    expires_days: Optional[int] = Field(default=90, ge=1, le=3650, description="過期天數")


class TokenResponse(BaseModel):
    """Token 響應模型(不含明文 token)"""
    id: int
    name: str
    department: str
    scopes: List[str]
    created_at: datetime
    expires_at: Optional[datetime]
    last_used: Optional[datetime]


class TokenCreateResponse(BaseModel):
    """創建 Token 響應模型(含明文 token,僅此一次)"""
    id: int
    token: str
    name: str
    department: str
    scopes: List[str]


class TokenUpdate(BaseModel):
    """更新 Token 請求模型"""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Token 名稱")
    department: Optional[str] = Field(None, min_length=1, max_length=100, description="所屬部門")
    scopes: Optional[List[str]] = Field(None, min_items=1, description="權限範圍")


class RouteCreate(BaseModel):
    """創建路由請求模型"""
    name: str = Field(..., min_length=1, max_length=255, description="路由名稱")
    path: str = Field(..., pattern=r'^/.*', description="路徑,必須以 / 開頭")
    backend_url: str = Field(..., min_length=1, description="後端 URL")
    description: Optional[str] = Field(default="", description="描述")
    tags: Optional[List[str]] = Field(default=[], description="標籤/分類")


class RouteUpdate(BaseModel):
    """更新路由請求模型"""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="路由名稱")
    backend_url: Optional[str] = Field(None, min_length=1, description="後端 URL")
    description: Optional[str] = Field(None, description="描述")
    tags: Optional[List[str]] = Field(None, description="標籤/分類")


class RouteResponse(BaseModel):
    """路由響應模型"""
    id: int
    name: Optional[str]
    path: str
    backend_url: str
    description: Optional[str]
    tags: List[str]
    created_at: datetime


class StatsResponse(BaseModel):
    """統計信息響應模型"""
    total_tokens: int
    total_routes: int
    recent_activity: List[dict]

