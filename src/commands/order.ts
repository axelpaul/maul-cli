import { requireAuth, getConfig } from "../lib/config.ts";
import { MaulClient } from "../lib/maul-client.ts";
import { findBestMatch } from "../lib/match.ts";
import { getNextIsoWeek, weekdayName } from "./helpers.ts";
import type { OrderSubmission, OrderItem, MenuItem } from "../lib/types.ts";

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
			console.log(`  ${weekdayName(Number(item.WeekdayNumber))} — ${item.RestaurantName}`);
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
		throw new Error('Invalid --meals JSON. Expected format: {"1":"pad thai chicken","2":"beef pie"}');
	}

	// Fetch menu to resolve items
	const menus = await client.getMenu(opts.week);
	const allItems = menus.flatMap((m) => m.Menu);

	const orderItems: OrderItem[] = [];
	const resolved: Array<{ day: number; query: string; match: MenuItem; score: number }> = [];

	for (const [dayStr, query] of Object.entries(meals)) {
		const weekday = Number.parseInt(dayStr, 10);
		if (Number.isNaN(weekday) || weekday < 1 || weekday > 5) {
			throw new Error(`Invalid day: ${dayStr}. Must be 1-5.`);
		}

		const result = findBestMatch(allItems, weekday, query);
		if (!result) {
			throw new Error(`No match found for "${query}" on ${weekdayName(weekday)}`);
		}
		if (result.score < 30) {
			throw new Error(
				`Best match for "${query}" on ${weekdayName(weekday)} was "${result.item.ShortDescriptionByLang.en || result.item.MenuItemId}" (score: ${result.score}) — too low confidence. Be more specific.`,
			);
		}

		resolved.push({ day: weekday, query, match: result.item, score: result.score });

		orderItems.push({
			RestaurantId: result.item.RestaurantId,
			MenuId: "variety-a",
			MenuItemId: result.item.MenuItemId,
			MealTime: result.item.MealTime || "Lunch",
			OrderDate: result.item.Date,
		});
	}

	const order: OrderSubmission = {
		UserId: token.userId,
		OrderItems: orderItems,
	};

	const apiResult = await client.submitOrder(order);

	if (opts.json) {
		console.log(
			JSON.stringify(
				{
					status: "submitted",
					week: opts.week,
					resolved: resolved.map((r) => ({
						day: r.day,
						query: r.query,
						matched: r.match.ShortDescriptionByLang.en || r.match.MenuItemId,
						menuItemId: r.match.MenuItemId,
						restaurant: r.match.RestaurantName,
						score: r.score,
					})),
					order: apiResult,
				},
				null,
				2,
			),
		);
	} else {
		console.log(`Order submitted for ${opts.week}\n`);
		for (const r of resolved) {
			const desc = r.match.ShortDescriptionByLang.en || r.match.MenuItemId;
			console.log(`  ${weekdayName(r.day)} — ${r.match.RestaurantName}`);
			console.log(`    ${desc}${r.score < 80 ? ` (match: ${r.score}%)` : ""}`);
		}
	}
}
