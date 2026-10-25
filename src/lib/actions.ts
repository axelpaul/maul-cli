/**
 * Operations shared by the CLI commands and the MCP server, so both go through the
 * same request logic.
 */
import { weekdayName } from "../commands/helpers.ts";
import { getConfig, loadToken, requireAuth } from "./config.ts";
import { findBestMatch } from "./match.ts";
import { MaulClient } from "./maul-client.ts";
import type { CachedToken, ExistingOrderItem, MenuItem, OrderItem } from "./types.ts";

export const ISO_WEEK_RE = /^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/;

export function assertIsoWeek(week: string): void {
	if (!ISO_WEEK_RE.test(week)) throw new Error(`Invalid week "${week}". Use YYYY-WNN.`);
}

export function assertDate(date: string): void {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid date "${date}". Use YYYY-MM-DD.`);
}

export function parseWeekday(value: string | number): number {
	const weekday = typeof value === "number" ? value : Number.parseInt(value, 10);
	if (!Number.isInteger(weekday) || weekday < 1 || weekday > 5) {
		throw new Error(`Invalid day: ${value}. Must be 1-5 (Mon-Fri).`);
	}
	return weekday;
}

export async function getSession(): Promise<{ client: MaulClient; token: CachedToken }> {
	const token = await requireAuth();
	const config = getConfig();
	const client = new MaulClient({
		baseUrl: config.apiUrl,
		token: token.accessToken,
		userId: token.userId,
		organization: token.organization,
	});
	return { client, token };
}

export async function authStatus() {
	const token = await loadToken();
	if (!token) return { authenticated: false, reason: "No cached token found" };
	const expired = Date.now() >= token.expiresAt;
	return {
		authenticated: !expired || Boolean(token.refreshToken),
		userId: token.userId,
		email: token.email,
		organization: token.organization,
		expiresAt: new Date(token.expiresAt).toISOString(),
		...(expired
			? token.refreshToken
				? { note: "Access token expired; it will be refreshed on the next request" }
				: { reason: "Token expired" }
			: {}),
	};
}

export async function getMenuItems(client: MaulClient, week: string): Promise<MenuItem[]> {
	const menus = await client.getMenu(week);
	return menus.flatMap((m) => m.Menu);
}

export function toOrderItem(item: MenuItem): OrderItem {
	return {
		RestaurantId: item.RestaurantId,
		MenuId: "variety-a",
		MenuItemId: item.MenuItemId,
		MealTime: item.MealTime || "Lunch",
		OrderDate: item.Date,
	};
}

export interface ResolvedMeal {
	day: number;
	query: string;
	match: MenuItem;
	score: number;
}

/** Resolve a {weekday: menu item ID or search text} map against the week's menu. */
export function resolveMeals(items: MenuItem[], meals: Record<string, string>): ResolvedMeal[] {
	const resolved: ResolvedMeal[] = [];
	for (const [dayStr, query] of Object.entries(meals)) {
		const day = parseWeekday(dayStr);
		const result = findBestMatch(items, day, String(query));
		if (!result) {
			throw new Error(`No match found for "${query}" on ${weekdayName(day)}`);
		}
		if (result.score < 30) {
			throw new Error(
				`Best match for "${query}" on ${weekdayName(day)} was "${result.item.ShortDescriptionByLang.en || result.item.MenuItemId}" (score: ${result.score}) — too low confidence. Be more specific.`,
			);
		}
		resolved.push({ day, query: String(query), match: result.item, score: result.score });
	}
	return resolved;
}

export async function submitResolved(
	client: MaulClient,
	userId: string,
	resolved: ResolvedMeal[],
): Promise<unknown> {
	return client.submitOrder({
		UserId: userId,
		OrderItems: resolved.map((r) => toOrderItem(r.match)),
	});
}

export function findDayOrder(
	orders: ExistingOrderItem[],
	day: number,
): ExistingOrderItem | undefined {
	return orders.find((o) => Number(o.WeekdayNumber) === day);
}

/**
 * Cancel the order for one weekday. When expectedMenuItemId is given, refuses unless the
 * existing order for that day is exactly that item.
 */
export async function cancelDayOrder(
	client: MaulClient,
	week: string,
	day: number,
	expectedMenuItemId?: string,
): Promise<ExistingOrderItem> {
	const orders = await client.getOrders(week);
	const dayOrder = findDayOrder(orders, day);
	if (!dayOrder) {
		throw new Error(`No order found for ${weekdayName(day)} in ${week}`);
	}
	if (expectedMenuItemId !== undefined && dayOrder.MenuItemId !== expectedMenuItemId) {
		throw new Error(
			`The ${weekdayName(day)} order is "${dayOrder.MenuItemId}", not "${expectedMenuItemId}"; no change made.`,
		);
	}
	await client.cancelOrder({
		mealTime: dayOrder.MealTime || "Lunch",
		menuItemId: dayOrder.MenuItemId,
		orderDate: dayOrder.Date,
		restaurantId: dayOrder.RestaurantId,
	});
	return dayOrder;
}
