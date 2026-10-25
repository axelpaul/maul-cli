import {
	assertIsoWeek,
	cancelDayOrder,
	getMenuItems,
	getSession,
	parseWeekday,
	resolveMeals,
	submitResolved,
} from "../lib/actions.ts";
import { getNextIsoWeek, weekdayName } from "./helpers.ts";

export async function showOrders(opts: { week?: string; json?: boolean }) {
	const week = opts.week || getNextIsoWeek();
	assertIsoWeek(week);
	const { client } = await getSession();

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

	assertIsoWeek(opts.week);

	let meals: Record<string, string>;
	try {
		meals = JSON.parse(opts.meals);
	} catch {
		throw new Error(
			'Invalid --meals JSON. Expected format: {"1":"pad thai chicken","2":"beef pie"}',
		);
	}
	if (!meals || typeof meals !== "object" || Array.isArray(meals)) {
		throw new Error('--meals must be a JSON object like {"1":"pad thai chicken"}');
	}

	const { client, token } = await getSession();
	const resolved = resolveMeals(await getMenuItems(client, opts.week), meals);
	const apiResult = await submitResolved(client, token.userId, resolved);

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

export async function cancelOrder(opts: { week?: string; day?: string; json?: boolean }) {
	if (!opts.week) throw new Error("--week is required");
	if (!opts.day) throw new Error("--day is required");

	assertIsoWeek(opts.week);
	const weekday = parseWeekday(opts.day);

	const { client } = await getSession();
	await cancelDayOrder(client, opts.week, weekday);

	if (opts.json) {
		console.log(JSON.stringify({ status: "cancelled", week: opts.week, day: weekday }, null, 2));
	} else {
		console.log(`Cancelled ${weekdayName(weekday)} order for ${opts.week}`);
	}
}
