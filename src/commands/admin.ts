import { requireAuth, getConfig } from "../lib/config.ts";
import { MaulClient } from "../lib/maul-client.ts";

export async function adminOrders(opts: { date?: string; json?: boolean }) {
	if (!opts.date) throw new Error("--date is required");

	const token = await requireAuth();
	const config = getConfig();

	const client = new MaulClient({
		baseUrl: config.apiUrl,
		token: token.accessToken,
		userId: token.userId,
		organization: token.organization,
	});

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
