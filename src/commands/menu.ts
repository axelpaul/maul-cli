import { requireAuth, getConfig } from "../lib/config.ts";
import { MaulClient } from "../lib/maul-client.ts";
import { getNextIsoWeek, weekdayName } from "./helpers.ts";

export async function showMenu(opts: { week?: string; json?: boolean }) {
	const token = await requireAuth();
	const config = getConfig();
	const week = opts.week || getNextIsoWeek();

	const client = new MaulClient({
		baseUrl: config.apiUrl,
		token: token.accessToken,
		userId: token.userId,
		organization: token.organization,
	});

	const menus = await client.getMenu(week);
	const items = menus.flatMap((m) => m.Menu);

	const byDay: Record<string, typeof items> = {};
	for (const item of items) {
		const day = String(item.WeekdayNumber);
		(byDay[day] ??= []).push(item);
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
