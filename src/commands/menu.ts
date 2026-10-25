import { assertIsoWeek, getMenuItems, getSession } from "../lib/actions.ts";
import { getNextIsoWeek, weekdayName } from "./helpers.ts";

export async function showMenu(opts: { week?: string; json?: boolean }) {
	const week = opts.week || getNextIsoWeek();
	assertIsoWeek(week);
	const { client } = await getSession();
	const items = await getMenuItems(client, week);

	const byDay: Record<string, typeof items> = {};
	for (const item of items) {
		const day = String(item.WeekdayNumber);
		if (!byDay[day]) byDay[day] = [];
		byDay[day].push(item);
	}

	if (opts.json) {
		console.log(JSON.stringify({ week, menu: byDay }, null, 2));
	} else {
		console.log(`Menu for ${week}\n`);
		for (let d = 1; d <= 5; d++) {
			const dayItems = byDay[String(d)];
			console.log(`  ${weekdayName(d)}`);
			if (!dayItems || dayItems.length === 0) {
				console.log("    No items available\n");
				continue;
			}
			for (const item of dayItems) {
				const desc =
					item.ShortDescriptionByLang.en ||
					item.ShortDescriptionByLang.is ||
					item.DescriptionByLang.en ||
					item.DescriptionByLang.is ||
					"";
				console.log(`    ${item.RestaurantName}`);
				console.log(`      ${desc}`);
				console.log(`      ID: ${item.MenuItemId}`);
			}
			console.log();
		}
	}
}
