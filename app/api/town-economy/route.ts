import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTownPlayerCoins, earnTownCoins, spendTownCoins } from "@/lib/db";

async function getUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string };
}

export async function GET(req: NextRequest) {
  const u = await getUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const action = new URL(req.url).searchParams.get("action");
  if (action === "get") {
    const coins = await getTownPlayerCoins(u.id).catch(() => 0);
    return NextResponse.json({ coins });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const u = await getUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action, amount } = body;

  if (action === "add") {
    const result = await earnTownCoins(u.id, Math.max(0, Number(amount) || 0)).catch(() => null);
    return NextResponse.json(result ?? { ok: false, error: "DB error" });
  }

  if (action === "spend") {
    const result = await spendTownCoins(u.id, Math.max(0, Number(amount) || 0)).catch(() => null);
    return NextResponse.json(result ?? { ok: false, error: "DB error" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
