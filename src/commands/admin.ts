import { assertDate, getSession } from "../lib/actions.ts";

export async function adminOrders(opts: { date?: string; json?: boolean }) {
	if (!opts.date) throw new Error("--date is required");
	assertDate(opts.date);

	const { client } = await getSession();

	const orders = await client.getLocationOrders(opts.date);

	if (opts.json) {
		console.log(JSON.stringify({ date: opts.date, orders }, null, 2));
	} else {
		console.log(`Orders for ${opts.date}\n`);
		if (orders.length === 0) {
			console.log("  No orders found.");
			return;
		}
		for (const o of orders) {
			console.log(`  ${o.Name || o.Email || o.UserId} — ${o.RestaurantName}`);
		}
	}
}
