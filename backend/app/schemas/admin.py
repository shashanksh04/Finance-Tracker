from pydantic import BaseModel
from typing import List
from datetime import datetime


class DailyLoginCount(BaseModel):
    date: str
    count: int


class AdminStatsResponse(BaseModel):
    total_users: int
    today_logins: int
    daily_logins: List[DailyLoginCount]
