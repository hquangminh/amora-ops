import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

type Body = { orderId: string };

export async function POST(req: Request) {
  const { orderId } = (await req.json()) as Body;
  if (!orderId)
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

  const { data: order, error: oErr } = await supabaseAdmin
    .from("orders")
    .select("id,status")
    .eq("id", orderId)
    .single();

  if (oErr || !order)
    return NextResponse.json(
      { error: oErr?.message ?? "Order not found" },
      { status: 404 }
    );

  if (order.status !== "completed") {
    return NextResponse.json(
      { error: "Only completed orders can be cancelled (restocked)." },
      { status: 400 }
    );
  }

  // lấy allocations theo orderId (join order_items)
  const { data: allocs, error: aErr } = await supabaseAdmin
    .from("cogs_allocations")
    .select("id,batch_id,qty_allocated,order_items!inner(order_id)")
    .eq("order_items.order_id", orderId);

  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  // trả lại vào batch
  for (const a of (allocs ?? []) as any[]) {
    const qty = Number(a.qty_allocated);

    // lấy qty_remaining hiện tại
    const { data: batch, error: bErr } = await supabaseAdmin
      .from("inventory_batches")
      .select("id,qty_remaining")
      .eq("id", a.batch_id)
      .single();

    if (bErr || !batch)
      return NextResponse.json(
        { error: bErr?.message ?? "Batch not found" },
        { status: 500 }
      );

    const newRemain = Number(batch.qty_remaining) + qty;

    const { error: updErr } = await supabaseAdmin
      .from("inventory_batches")
      .update({ qty_remaining: newRemain })
      .eq("id", a.batch_id);

    if (updErr)
      return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // xoá allocations
  const { error: delErr } = await supabaseAdmin
    .from("cogs_allocations")
    .delete()
    .in(
      "id",
      (allocs ?? []).map((x: any) => x.id)
    );

  if (delErr)
    return NextResponse.json({ error: delErr.message }, { status: 500 });

  // update order
  const { error: updOrderErr } = await supabaseAdmin
    .from("orders")
    .update({ status: "cancelled", cogs_total: 0, gross_profit: 0 })
    .eq("id", orderId);

  if (updOrderErr)
    return NextResponse.json({ error: updOrderErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
