import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

type CompleteBody = { orderId: string };

export async function POST(req: Request) {
  const body = (await req.json()) as CompleteBody;
  const orderId = body.orderId;

  if (!orderId)
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

  // 1) Load order + items
  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderErr || !order)
    return NextResponse.json(
      { error: orderErr?.message ?? "Order not found" },
      { status: 404 }
    );

  if (order.status === "completed") {
    return NextResponse.json({ ok: true, message: "Order already completed" });
  }

  const { data: items, error: itemsErr } = await supabaseAdmin
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  if (itemsErr)
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  if (!items || items.length === 0)
    return NextResponse.json({ error: "Order has no items" }, { status: 400 });

  let cogsTotal = 0;

  // 2) FIFO allocation for each order item
  for (const oi of items) {
    let remaining = Number(oi.qty);

    // fetch FIFO batches
    const { data: batches, error: bErr } = await supabaseAdmin
      .from("inventory_batches")
      .select("*")
      .eq("item_id", oi.item_id)
      .gt("qty_remaining", 0)
      .order("received_date", { ascending: true });

    if (bErr)
      return NextResponse.json({ error: bErr.message }, { status: 500 });

    if (!batches || batches.length === 0) {
      return NextResponse.json(
        { error: `Out of stock for item_id=${oi.item_id}` },
        { status: 400 }
      );
    }

    for (const b of batches) {
      if (remaining <= 0) break;

      const canTake = Math.min(remaining, Number(b.qty_remaining));
      const newRemain = Number(b.qty_remaining) - canTake;

      // update batch remaining
      const { error: updErr } = await supabaseAdmin
        .from("inventory_batches")
        .update({ qty_remaining: newRemain })
        .eq("id", b.id);

      if (updErr)
        return NextResponse.json({ error: updErr.message }, { status: 500 });

      const unitCost = Number(b.unit_cost);
      const totalCost = canTake * unitCost;

      // insert allocation record
      const { error: insErr } = await supabaseAdmin
        .from("cogs_allocations")
        .insert({
          order_item_id: oi.id,
          batch_id: b.id,
          qty_allocated: canTake,
          unit_cost: unitCost,
          total_cost: totalCost,
        });

      if (insErr)
        return NextResponse.json({ error: insErr.message }, { status: 500 });

      cogsTotal += totalCost;
      remaining -= canTake;
    }

    if (remaining > 0) {
      return NextResponse.json(
        { error: `Not enough stock (FIFO) for item_id=${oi.item_id}` },
        { status: 400 }
      );
    }
  }

  // 3) update order totals
  const total = Number(order.total);
  const grossProfit = total - cogsTotal;

  const { error: updOrderErr } = await supabaseAdmin
    .from("orders")
    .update({
      status: "completed",
      cogs_total: cogsTotal,
      gross_profit: grossProfit,
    })
    .eq("id", orderId);

  if (updOrderErr)
    return NextResponse.json({ error: updOrderErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, cogsTotal, grossProfit });
}
