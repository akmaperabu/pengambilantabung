import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureTablesExist, Cylinder } from "@/lib/db";

function extractSerialCandidate(raw: string): string {
  const cleaned = raw.trim();
  if (/^https?:\/\//i.test(cleaned)) {
    try {
      const url = new URL(cleaned);
      const snParam =
        url.searchParams.get("sn") ||
        url.searchParams.get("serial") ||
        url.searchParams.get("code") ||
        url.searchParams.get("id");
      if (snParam) return snParam.trim().toUpperCase();
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 0) {
        return decodeURIComponent(parts[parts.length - 1]).trim().toUpperCase();
      }
    } catch {
      // ignore URL parse error
    }
  }

  const kvMatch = cleaned.match(
    /(?:sn|serial|no|kode)\s*[:=]\s*([A-Za-z0-9\-_./]+)/i
  );
  if (kvMatch && kvMatch[1]) {
    return kvMatch[1].trim().toUpperCase();
  }

  return cleaned.toUpperCase();
}

export async function GET(request: NextRequest) {
  try {
    await ensureTablesExist();
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const rawCode = (searchParams.get("code") || "").trim();

    if (!rawCode) {
      return NextResponse.json(
        { error: "Kode QR tidak boleh kosong" },
        { status: 400 }
      );
    }

    const candidate = extractSerialCandidate(rawCode);

    // 1. Exact match on serial_number or cylinder_number (case-insensitive)
    let res = await db.execute({
      sql: `SELECT id, serial_number, cylinder_number, gas_type, updated_at
            FROM cylinders
            WHERE serial_number = ? COLLATE NOCASE
               OR (cylinder_number != '' AND cylinder_number = ? COLLATE NOCASE)
            LIMIT 1`,
      args: [candidate, candidate],
    });

    let cylinder = res.rows[0] as unknown as Cylinder | undefined;

    // 2. Fallback: rawCode exact match
    if (!cylinder && candidate !== rawCode.toUpperCase()) {
      const rawTrimmed = rawCode.trim();
      res = await db.execute({
        sql: `SELECT id, serial_number, cylinder_number, gas_type, updated_at
              FROM cylinders
              WHERE serial_number = ? COLLATE NOCASE
                 OR (cylinder_number != '' AND cylinder_number = ? COLLATE NOCASE)
              LIMIT 1`,
        args: [rawTrimmed, rawTrimmed],
      });
      cylinder = res.rows[0] as unknown as Cylinder | undefined;
    }

    // 3. Fallback: stripped hyphens/spaces match
    if (!cylinder) {
      const alnumOnly = candidate.replace(/[^A-Z0-9]/gi, "");
      if (alnumOnly.length >= 3) {
        res = await db.execute({
          sql: `SELECT id, serial_number, cylinder_number, gas_type, updated_at
                FROM cylinders
                WHERE REPLACE(REPLACE(serial_number, '-', ''), ' ', '') = ? COLLATE NOCASE
                   OR (cylinder_number != '' AND REPLACE(REPLACE(cylinder_number, '-', ''), ' ', '') = ? COLLATE NOCASE)
                LIMIT 1`,
          args: [alnumOnly, alnumOnly],
        });
        cylinder = res.rows[0] as unknown as Cylinder | undefined;
      }
    }

    if (cylinder) {
      return NextResponse.json({
        found: true,
        cylinder,
        scannedCode: candidate,
      });
    }

    return NextResponse.json({
      found: false,
      cylinder: null,
      scannedCode: candidate,
    });
  } catch (error: unknown) {
    console.error("GET /api/cylinders/lookup error:", error);
    return NextResponse.json(
      { error: "Gagal memeriksa kode QR" },
      { status: 500 }
    );
  }
}
