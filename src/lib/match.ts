import type { MenuItem } from "./types.ts";

/** Score how well a menu item matches a search query. Higher = better. 0 = no match. */
function scoreItem(item: MenuItem, query: string): number {
	const q = query.toLowerCase();
	const tokens = q.split(/\s+/);

	// Build searchable text from all relevant fields
	const texts = [
		item.ShortDescriptionByLang.en,
		item.ShortDescriptionByLang.is,
		item.DescriptionByLang.en,
		item.DescriptionByLang.is,
		item.RestaurantName,
		item.MenuItemId,
	]
		.filter(Boolean)
		.map((t) => t!.toLowerCase());

	const joined = texts.join(" ");

	// Exact full query match in any field
	if (texts.some((t) => t === q)) return 100;

	// Full query is a substring
	if (joined.includes(q)) return 80;

	// Count how many tokens match
	let matched = 0;
	for (const token of tokens) {
		if (joined.includes(token)) matched++;
	}

	if (matched === 0) return 0;

	// Score based on proportion of tokens matched
	return Math.round((matched / tokens.length) * 60);
}

export interface MatchResult {
	item: MenuItem;
	score: number;
}

/**
 * Find the best matching menu item for a query on a specific weekday.
 * Returns the match result, or null if nothing scores above threshold.
 */
export function findBestMatch(
	items: MenuItem[],
	weekday: number,
	query: string,
): MatchResult | null {
	// If query looks like an exact MenuItemId, try direct match first
	if (query.includes(".")) {
		const exact = items.find((i) => i.MenuItemId === query && i.WeekdayNumber === weekday);
		if (exact) return { item: exact, score: 100 };
	}

	const dayItems = items.filter((i) => i.WeekdayNumber === weekday);
	let best: MatchResult | null = null;

	for (const item of dayItems) {
		const score = scoreItem(item, query);
		if (score > 0 && (!best || score > best.score)) {
			best = { item, score };
		}
	}

	return best;
}
