import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DEBUG_FILE = path.join(process.cwd(), "outbreak_debug.json");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Load existing history
    let history: unknown[] = [];
    try {
      history = JSON.parse(fs.readFileSync(DEBUG_FILE, "utf-8"));
    } catch {}

    // Prepend latest run, keep last 20
    history.unshift({ ...body, savedAt: new Date().toISOString() });
    if (history.length > 20) history = history.slice(0, 20);

    fs.writeFileSync(DEBUG_FILE, JSON.stringify(history, null, 2));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const data = fs.readFileSync(DEBUG_FILE, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json([]);
  }
}
