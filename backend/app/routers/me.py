from fastapi import APIRouter, Depends

from app.deps import current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/me/tenant")
async def my_tenant(user: User = Depends(current_active_user)) -> dict[str, str]:
    return {"tenant_id": str(user.tenant_id), "email": user.email, "role": user.role}
