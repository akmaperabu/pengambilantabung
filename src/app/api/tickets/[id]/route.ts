import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureTablesExist, Ticket, TicketItem } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTablesExist();
    const db = getDb();
    const { id } = await context.params;
    const ticketId = Number(id);

    if (!ticketId || isNaN(ticketId)) {
      return NextResponse.json(
        { error: "ID tiket tidak valid" },
        { status: 400 }
      );
    }

    const ticketRes = await db.execute({
      sql: "SELECT id, ticket_code, customer_name, sj_number, retrieval_date, notes, total_items, created_at FROM tickets WHERE id = ?",
      args: [ticketId],
    });

    const ticket = ticketRes.rows[0] as unknown as Ticket | undefined;

    if (!ticket) {
      return NextResponse.json(
        { error: "Tiket tidak ditemukan" },
        { status: 404 }
      );
    }

    const itemsRes = await db.execute({
      sql: "SELECT id, ticket_id, serial_number, cylinder_number, gas_type, input_method, created_at FROM ticket_items WHERE ticket_id = ? ORDER BY id ASC",
      args: [ticketId],
    });

    return NextResponse.json({
      ticket,
      items: itemsRes.rows as unknown as TicketItem[],
    });
  } catch (error: unknown) {
    console.error("GET /api/tickets/[id] error:", error);
    return NextResponse.json(
      { error: "Gagal memuat detail tiket" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTablesExist();
    const db = getDb();
    const { id } = await context.params;
    const ticketId = Number(id);

    if (!ticketId || isNaN(ticketId)) {
      return NextResponse.json(
        { error: "ID tiket tidak valid" },
        { status: 400 }
      );
    }

    await db.batch(
      [
        {
          sql: "DELETE FROM ticket_items WHERE ticket_id = ?",
          args: [ticketId],
        },
        {
          sql: "DELETE FROM tickets WHERE id = ?",
          args: [ticketId],
        },
      ],
      "write"
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("DELETE /api/tickets/[id] error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus tiket" },
      { status: 500 }
    );
  }
}
