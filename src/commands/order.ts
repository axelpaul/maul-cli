import { requireAuth, getConfig } from "../lib/config.ts";
import { MaulClient } from "../lib/maul-client.ts";
import { getNextIsoWeek, weekdayName } from "./helpers.ts";
import type { OrderSubmission, OrderItem } from "../lib/types.ts";

export async function showOrders(opts: { week?: string; json?: boolean }) {
	const token = await requireAuth();
	const config = getConfig();
	const week = opts.week || getNextIsoWeek();

	const client = new MaulClient({
		baseUrl: config.apiUrl,
		token: token.accessToken,
		userId: token.userId,
		organization: token.organization,
	});

	const orders = await client.getOrders(week);

	if (opts.json) {
		console.log(JSON.stringify({ week, orders }, null, 2));
	} else {
		console.log(`Orders for ${week}\n`);
		if (orders.length === 0) {
			console.log("  No orders found.");
			return;
		}
		for (const item of orders) {
			console.log(`  ${weekdayName(item.WeekdayNumber)} — ${item.RestaurantName}`);
			const desc =
				item.ShortDescriptionByLang?.en ||
				item.ShortDescriptionByLang?.is ||
				item.DescriptionByLang?.en ||
				item.DescriptionByLang?.is ||
				"";
			if (desc) console.log(`    ${desc}`);
		}
	}
}

export async function submitOrder(opts: { week?: string; meals?: string; json?: boolean }) {
	if (!opts.week) throw new Error("--week is required");
	if (!opts.meals) throw new Error("--meals is required");

	const token = await requireAuth();
	const config = getConfig();

	const client = new MaulClient({
		baseUrl: config.apiUrl,
		token: token.accessToken,
		userId: token.userId,
		organization: token.organization,
	});

	let meals: Record<string, string>;
	try {
		meals = JSON.parse(opts.meals);
	} catch {
		throw new Error('Invalid --meals JSON. Expected format: {"1":"menu_item_id","2":"menu_item_id"}');
	}

	// Fetch menu to resolve full item details
	const menus = await client.getMenu(opts.week);
	const allItems = menus.flatMap((m) => m.Menu);
	const itemMap = new Map(allItems.map((item) => [item.MenuItemId, item]));

	const orderItems: OrderItem[] = [];
	for (const [dayStr, menuItemId] of Object.entries(meals)) {
		const item = itemMap.get(menuItemId);
		if (!item) {
			throw new Error(`Menu item not found: ${menuItemId} (day ${dayStr})`);
		}

		orderItems.push({
			RestaurantId: item.RestaurantId,
			MenuId: "variety-a",
			MenuItemId: item.MenuItemId,
			MealTime: item.MealTime || "Lunch",
			OrderDate: item.Date,
		});
	}

	const order: OrderSubmission = {
		UserId: token.userId,
		OrderItems: orderItems,
	};

	const result = await client.submitOrder(order);

	if (opts.json) {
		console.log(JSON.stringify({ status: "submitted", week: opts.week, order: result }, null, 2));
	} else {
		console.log(`Order submitted for ${opts.week}`);
		for (const oi of orderItems) {
			const src = itemMap.get(oi.MenuItemId);
			console.log(`  ${oi.OrderDate} — ${src?.RestaurantName || oi.RestaurantId}`);
		}
	}
}

export async function cancelOrder(opts: { week?: string; day?: string; json?: boolean }) {
	if (!opts.week) throw new Error("--week is required");
	if (!opts.day) throw new Error("--day is required");

	const weekday = Number.parseInt(opts.day, 10);
	if (Number.isNaN(weekday) || weekday < 1 || weekday > 5) {
		throw new Error("Day must be 1-5 (Mon-Fri)");
	}

	const token = await requireAuth();
	const config = getConfig();

	const client = new MaulClient({
		baseUrl: config.apiUrl,
		token: token.accessToken,
		userId: token.userId,
		organization: token.organization,
	});

	await client.cancelOrder(opts.week, weekday);

	if (opts.json) {
		console.log(JSON.stringify({ status: "cancelled", week: opts.week, day: weekday }, null, 2));
	} else {
		console.log(`Cancelled ${weekdayName(weekday)} order for ${opts.week}`);
	}
}
