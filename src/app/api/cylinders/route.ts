import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureTablesExist, Cylinder } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    await ensureTablesExist();
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const gas = (searchParams.get("gas") || "").trim();
    const limitParam = parseInt(searchParams.get("limit") || "50", 10);
    const offsetParam = parseInt(searchParams.get("offset") || "0", 10);
    const limit = Math.min(Math.max(limitParam, 1), 200);
    const offset = Math.max(offsetParam, 0);

    const totalMasterRes = await db.execute("SELECT COUNT(*) as total FROM cylinders");
    const totalMaster = Number(totalMasterRes.rows[0]?.total || 0);

    const whereClauses: string[] = [];
    const params: (string | number)[] = [];

    if (q) {
      whereClauses.push(
        "(serial_number LIKE ? OR cylinder_number LIKE ? OR gas_type LIKE ?)"
      );
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    if (gas && gas !== "ALL") {
      whereClauses.push("gas_type = ?");
      params.push(gas);
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countRes = await db.execute({
      sql: `SELECT COUNT(*) as count FROM cylinders ${whereSql}`,
      args: params,
    });
    const matchedCount = Number(countRes.rows[0]?.count || 0);

    const itemsRes = await db.execute({
      sql: `SELECT id, serial_number, cylinder_number, gas_type, updated_at
         FROM cylinders
         ${whereSql}
         ORDER BY
           CASE
             WHEN serial_number LIKE ? THEN 0
             WHEN cylinder_number LIKE ? THEN 1
             ELSE 2
           END,
           serial_number ASC
         LIMIT ? OFFSET ?`,
      args: [...params, `${q}%`, `${q}%`, limit, offset],
    });

    const gasTypesRes = await db.execute(
      "SELECT DISTINCT gas_type FROM cylinders WHERE gas_type != '' ORDER BY gas_type ASC"
    );

    return NextResponse.json({
      items: itemsRes.rows as unknown as Cylinder[],
      matchedCount,
      totalMaster,
      gasTypes: gasTypesRes.rows.map((r) => String(r.gas_type)),
    });
  } catch (error: unknown) {
    console.error("GET /api/cylinders error:", error);
    return NextResponse.json(
      { error: "Gagal memuat data master tabung" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTablesExist();
    const db = getDb();
    const body = await request.json();

    // Case 1: Bulk Import array of items (supports 6,500+ rows)
    if (Array.isArray(body.items)) {
      const mode: "upsert" | "replace" =
        body.mode === "replace" ? "replace" : "upsert";
      const rawItems = body.items as Array<{
        serial_number?: string;
        cylinder_number?: string;
        gas_type?: string;
      }>;

      if (rawItems.length === 0) {
        return NextResponse.json(
          { error: "Data import kosong" },
          { status: 400 }
        );
      }

      if (mode === "replace") {
        await db.execute("DELETE FROM cylinders");
      }

      let importedCount = 0;
      let skippedCount = 0;

      // Batch statements into chunks of 250 for optimal HTTP payload and transaction safety
      const CHUNK_SIZE = 250;
      let currentChunk: Array<{
        sql: string;
        args: [string, string, string];
      }> = [];

      for (const row of rawItems) {
        const serial = String(row.serial_number ?? "").trim().toUpperCase();
        if (!serial) {
          skippedCount++;
          continue;
        }
        const cylNo = String(row.cylinder_number ?? "").trim().toUpperCase();
        const gas = String(row.gas_type ?? "").trim() || "-";

        currentChunk.push({
          sql: `INSERT INTO cylinders (serial_number, cylinder_number, gas_type, updated_at)
                VALUES (?, ?, ?, datetime('now', 'localtime'))
                ON CONFLICT(serial_number) DO UPDATE SET
                  cylinder_number = excluded.cylinder_number,
                  gas_type = excluded.gas_type,
                  updated_at = datetime('now', 'localtime')`,
          args: [serial, cylNo, gas],
        });
        importedCount++;

        if (currentChunk.length >= CHUNK_SIZE) {
          await db.batch(currentChunk, "write");
          currentChunk = [];
        }
      }

      if (currentChunk.length > 0) {
        await db.batch(currentChunk, "write");
      }

      const totalMasterRes = await db.execute("SELECT COUNT(*) as total FROM cylinders");
      const totalMaster = Number(totalMasterRes.rows[0]?.total || 0);

      return NextResponse.json({
        success: true,
        importedCount,
        skippedCount,
        totalMaster,
      });
    }

    // Case 2: Single Cylinder creation/update
    const serial_number = String(body.serial_number || "")
      .trim()
      .toUpperCase();
    const cylinder_number = String(body.cylinder_number || "")
      .trim()
      .toUpperCase();
    const gas_type = String(body.gas_type || "-").trim();

    if (!serial_number) {
      return NextResponse.json(
        { error: "Serial Number wajib diisi" },
        { status: 400 }
      );
    }

    await db.execute({
      sql: `INSERT INTO cylinders (serial_number, cylinder_number, gas_type, updated_at)
            VALUES (?, ?, ?, datetime('now', 'localtime'))
            ON CONFLICT(serial_number) DO UPDATE SET
              cylinder_number = excluded.cylinder_number,
              gas_type = excluded.gas_type,
              updated_at = datetime('now', 'localtime')`,
      args: [serial_number, cylinder_number, gas_type],
    });

    const cylinderRes = await db.execute({
      sql: "SELECT id, serial_number, cylinder_number, gas_type, updated_at FROM cylinders WHERE serial_number = ?",
      args: [serial_number],
    });

    return NextResponse.json({
      success: true,
      cylinder: cylinderRes.rows[0] as unknown as Cylinder,
    });
  } catch (error: unknown) {
    console.error("POST /api/cylinders error:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan data tabung" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTablesExist();
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const all = searchParams.get("all");

    if (all === "true") {
      await db.execute("DELETE FROM cylinders");
      return NextResponse.json({ success: true });
    }

    if (!id) {
      return NextResponse.json(
        { error: "ID tabung diperlukan" },
        { status: 400 }
      );
    }

    await db.execute({
      sql: "DELETE FROM cylinders WHERE id = ?",
      args: [Number(id)],
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("DELETE /api/cylinders error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus data tabung" },
      { status: 500 }
    );
  }
}
