import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
import json
from app.core.database import async_session
from sqlalchemy.future import select
from app.models.activos import VwRegistroActivosDetalle
from app.schemas.activos import ActivoPublicoDTO

async def main():
    async with async_session() as session:
        query = select(VwRegistroActivosDetalle)
        result = await session.execute(query)
        items = result.scalars().all()

        serialized_data = [
            ActivoPublicoDTO.model_validate(item).model_dump(mode="json")
            for item in items
        ]

        out_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "public_dashboard", "activos.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(serialized_data, f, ensure_ascii=False, indent=2)

        print(f"Successfully exported {len(serialized_data)} records to {out_path}")

if __name__ == "__main__":
    asyncio.run(main())
