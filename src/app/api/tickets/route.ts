import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureTablesExist, Ticket } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    await ensureTablesExist();
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();

    let tickets: Ticket[];

    if (q) {
      const res = await db.execute({
        sql: `SELECT DISTINCT t.id, t.ticket_code, t.customer_name, t.sj_number,
                    t.retrieval_date, t.notes, t.total_items, t.created_at
             FROM tickets t
             LEFT JOIN ticket_items ti ON ti.ticket_id = t.id
             WHERE t.customer_name LIKE ?
                OR t.sj_number LIKE ?
                OR t.ticket_code LIKE ?
                OR ti.serial_number LIKE ?
                OR ti.cylinder_number LIKE ?
             ORDER BY t.id DESC
             LIMIT 100`,
        args: [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`],
      });
      tickets = res.rows as unknown as Ticket[];
    } else {
      const res = await db.execute(
        `SELECT id, ticket_code, customer_name, sj_number,
                retrieval_date, notes, total_items, created_at
         FROM tickets
         ORDER BY id DESC
         LIMIT 100`
      );
      tickets = res.rows as unknown as Ticket[];
    }

    return NextResponse.json({ tickets });
  } catch (error: unknown) {
    console.error("GET /api/tickets error:", error);
    return NextResponse.json(
      { error: "Gagal memuat daftar tiket" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTablesExist();
    const db = getDb();
    const body = await request.json();

    const customer_name = String(body.customer_name || "").trim();
    const sj_number = String(body.sj_number || "").trim();
    const retrieval_date = String(body.retrieval_date || "").trim();
    const notes = String(body.notes || "").trim();
    const items = Array.isArray(body.items) ? body.items : [];

    if (!customer_name) {
      return NextResponse.json(
        { error: "Nama Perusahaan / Customer wajib diisi" },
        { status: 400 }
      );
    }
    if (!sj_number) {
      return NextResponse.json(
        { error: "Nomor Surat Jalan wajib diisi" },
        { status: 400 }
      );
    }
    if (!retrieval_date) {
      return NextResponse.json(
        { error: "Tanggal Pengambilan wajib diisi" },
        { status: 400 }
      );
    }
    if (items.length === 0) {
      return NextResponse.json(
        { error: "Minimal harus ada 1 tabung di dalam tiket" },
        { status: 400 }
      );
    }

    const dateCompact =
      retrieval_date.replace(/[^0-9]/g, "").slice(0, 8) || "00000000";
    const countRes = await db.execute("SELECT COUNT(*) as c FROM tickets");
    const countTotal = Number(countRes.rows[0]?.c || 0);
    const seq = String(countTotal + 1).padStart(3, "0");
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const ticket_code = `TKT-${dateCompact}-${seq}-${randomSuffix}`;

    const insertTicketRes = await db.execute({
      sql: `INSERT INTO tickets (ticket_code, customer_name, sj_number, retrieval_date, notes, total_items, created_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
      args: [
        ticket_code,
        customer_name,
        sj_number,
        retrieval_date,
        notes,
        items.length,
      ],
    });

    const createdTicketId = Number(insertTicketRes.lastInsertRowid);

    const itemStatements = [];
    for (const item of items) {
      const serial = String(item.serial_number || "").trim().toUpperCase();
      if (!serial) continue;
      const cylNo = String(item.cylinder_number || "").trim().toUpperCase();
      const gas = String(item.gas_type || "-").trim();
      const method = String(item.input_method || "MANUAL").trim();

      itemStatements.push({
        sql: `INSERT INTO ticket_items (ticket_id, serial_number, cylinder_number, gas_type, input_method, created_at)
              VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
        args: [createdTicketId, serial, cylNo, gas, method],
      });
    }

    if (itemStatements.length > 0) {
      await db.batch(itemStatements, "write");
    }

    const savedTicketRes = await db.execute({
      sql: "SELECT * FROM tickets WHERE id = ?",
      args: [createdTicketId],
    });

    return NextResponse.json({
      success: true,
      ticket: savedTicketRes.rows[0] as unknown as Ticket,
    });
  } catch (error: unknown) {
    console.error("POST /api/tickets error:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan dan mengunci tiket" },
      { status: 500 }
    );
  }
}
