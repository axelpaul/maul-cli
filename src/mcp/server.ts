import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import pkg from "../../package.json" with { type: "json" };
import { getNextIsoWeek } from "../commands/helpers.ts";
import {
	authStatus,
	cancelDayOrder,
	findDayOrder,
	getMenuItems,
	getSession,
	ISO_WEEK_RE,
	toOrderItem,
} from "../lib/actions.ts";

export const WRITES_ENV = "MAUL_MCP_ENABLE_WRITES";

const result = (data: unknown) => ({
	content: [{ type: "text" as const, text: JSON.stringify(data) }],
});
const error = (value: unknown) => ({
	isError: true,
	content: [
		{
			type: "text" as const,
			text: value instanceof Error ? value.message : "Maul request failed.",
		},
	],
});
const weekSchema = z.string().regex(ISO_WEEK_RE).describe("ISO week, YYYY-WNN");
const optionalWeek = weekSchema.optional().describe("ISO week, YYYY-WNN; defaults to next week");
const daySchema = z.number().int().min(1).max(5).describe("Weekday number, 1=Mon … 5=Fri");

export function writesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
	return env[WRITES_ENV] === "1";
}

export function createServer(opts: { enableWrites?: boolean } = {}): McpServer {
	const enableWrites = opts.enableWrites ?? writesEnabled();
	const server = new McpServer({ name: "maul", version: pkg.version });

	server.registerTool(
		"auth_status",
		{
			description:
				'Show whether a Maul login is cached locally (email, organization, token expiry). Log in with the CLI: "maul login".',
			inputSchema: {},
			annotations: { readOnlyHint: true },
		},
		async () => {
			try {
				return result(await authStatus());
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"me",
		{
			description: "Read the signed-in user's Maul profile (email, company, location).",
			inputSchema: {},
			annotations: { readOnlyHint: true },
		},
		async () => {
			try {
				const { client } = await getSession();
				return result(await client.getUser());
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"menu",
		{
			description:
				"Read Maul lunch menu items for an ISO week (optionally one weekday); defaults to next week. Returns item IDs used by order_submit. No order is placed.",
			inputSchema: { week: optionalWeek, day: daySchema.optional() },
			annotations: { readOnlyHint: true },
		},
		async ({ week, day }) => {
			try {
				const selectedWeek = week || getNextIsoWeek();
				const { client } = await getSession();
				const items = (await getMenuItems(client, selectedWeek)).filter(
					(item) => day === undefined || item.WeekdayNumber === day,
				);
				return result({
					week: selectedWeek,
					count: items.length,
					items: items.slice(0, 125).map((item) => ({
						date: item.Date,
						day: item.WeekdayNumber,
						id: item.MenuItemId,
						restaurant: item.RestaurantName,
						name: item.ShortDescriptionByLang.is || item.ShortDescriptionByLang.en,
						nameEn: item.ShortDescriptionByLang.en,
						description: item.DescriptionByLang.is || item.DescriptionByLang.en,
						dietTypes: item.DietTypes,
						allergens: item.Allergens,
					})),
				});
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"orders",
		{
			description:
				"Read the signed-in user's Maul lunch orders for an ISO week; defaults to next week. No order is placed or changed.",
			inputSchema: { week: optionalWeek },
			annotations: { readOnlyHint: true },
		},
		async ({ week }) => {
			try {
				const selectedWeek = week || getNextIsoWeek();
				const { client } = await getSession();
				const orders = await client.getOrders(selectedWeek);
				return result({
					week: selectedWeek,
					orders: orders.map((order) => ({
						date: order.Date,
						day: Number(order.WeekdayNumber),
						itemId: order.MenuItemId,
						restaurant: order.RestaurantName,
						name: order.ShortDescriptionByLang?.is || order.ShortDescriptionByLang?.en,
						nameEn: order.ShortDescriptionByLang?.en,
					})),
				});
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"admin_orders",
		{
			description:
				"Read all orders at the signed-in user's location for one date (YYYY-MM-DD). Only works for accounts with Maul admin rights; others get an API error. Returns colleagues' names/emails.",
			inputSchema: {
				date: z
					.string()
					.regex(/^\d{4}-\d{2}-\d{2}$/)
					.describe("Date, YYYY-MM-DD"),
			},
			annotations: { readOnlyHint: true },
		},
		async ({ date }) => {
			try {
				const { client } = await getSession();
				return result({ date, orders: await client.getLocationOrders(date) });
			} catch (e) {
				return error(e);
			}
		},
	);

	if (!enableWrites) return server;

	server.registerTool(
		"order_submit",
		{
			description:
				"Place a Maul lunch order for one weekday by exact menu item ID (from the menu tool). confirmItemId must repeat menuItemId exactly. Refuses if that weekday already has an order (cancel it first). Only available when MAUL_MCP_ENABLE_WRITES=1.",
			inputSchema: {
				week: weekSchema,
				day: daySchema,
				menuItemId: z.string().min(1).max(120).describe("Exact menu item ID from the menu tool"),
				confirmItemId: z.string().describe("Must equal menuItemId to confirm the order"),
			},
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
		},
		async ({ week, day, menuItemId, confirmItemId }) => {
			try {
				if (confirmItemId !== menuItemId)
					throw new Error("confirmItemId must exactly match menuItemId.");
				const { client, token } = await getSession();
				const existing = await client.getOrders(week);
				if (findDayOrder(existing, day))
					throw new Error("An order already exists for this weekday; no change made.");
				const matches = (await getMenuItems(client, week)).filter(
					(item) => item.WeekdayNumber === day && item.MenuItemId === menuItemId,
				);
				const item = matches[0];
				if (matches.length !== 1 || !item)
					throw new Error("Exact menu item not found for that week and weekday.");
				await client.submitOrder({ UserId: token.userId, OrderItems: [toOrderItem(item)] });
				try {
					const updated = await client.getOrders(week);
					const verified = updated.some(
						(order) => order.MenuItemId === menuItemId && Number(order.WeekdayNumber) === day,
					);
					return result({
						week,
						day,
						menuItemId,
						submitted: true,
						verified,
						...(verified
							? {}
							: {
									warning:
										"Submission was accepted but the new order is not visible yet; check orders before retrying.",
								}),
					});
				} catch {
					return result({
						week,
						day,
						menuItemId,
						submitted: true,
						verified: null,
						warning:
							"Submission was accepted but verification failed; check orders before retrying.",
					});
				}
			} catch (e) {
				return error(e);
			}
		},
	);

	server.registerTool(
		"order_cancel",
		{
			description:
				"Cancel the signed-in user's Maul lunch order for one weekday. confirmItemId must equal the menu item ID of the existing order for that day (from the orders tool). Only available when MAUL_MCP_ENABLE_WRITES=1.",
			inputSchema: {
				week: weekSchema,
				day: daySchema,
				confirmItemId: z
					.string()
					.min(1)
					.describe("Menu item ID of the order being cancelled, as returned by the orders tool"),
			},
			annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
		},
		async ({ week, day, confirmItemId }) => {
			try {
				const { client } = await getSession();
				const cancelled = await cancelDayOrder(client, week, day, confirmItemId);
				return result({ week, day, cancelled: true, menuItemId: cancelled.MenuItemId });
			} catch (e) {
				return error(e);
			}
		},
	);

	return server;
}

export async function serve(): Promise<void> {
	await createServer().connect(new StdioServerTransport());
}
