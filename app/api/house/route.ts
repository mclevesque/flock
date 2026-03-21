import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getHouseConfig, saveHouseConfig, getDistrictHouses } from "@/lib/db";

// GET /api/house?userId=xxx  → single house config
// GET /api/house?district=1  → all district slots for current user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);

  if (searchParams.get("district") === "1") {
    const partyId = searchParams.get("partyId") ?? null;
    const houses = await getDistrictHouses(session.user.id, partyId);
    return NextResponse.json({ houses });
  }

  const targetId = searchParams.get("userId") ?? session.user.id;
  const config = await getHouseConfig(targetId);
  return NextResponse.json({ config: config ?? null });
}

// POST /api/house  → save own house config
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { exteriorStyle, wallpaper, floorType, furniture, pets } = body;

  // Validate pets (max 3)
  if (Array.isArray(pets) && pets.length > 3) {
    return NextResponse.json({ error: "Max 3 pets allowed" }, { status: 400 });
  }

  await saveHouseConfig(session.user.id, { exteriorStyle, wallpaper, floorType, furniture, pets });
  return NextResponse.json({ ok: true });
}
