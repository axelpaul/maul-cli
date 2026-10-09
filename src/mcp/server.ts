import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getNextIsoWeek } from "../commands/helpers.ts";
import { getConfig, requireAuth } from "../lib/config.ts";
import { MaulClient } from "../lib/maul-client.ts";

const server = new McpServer({ name: "maul", version: "0.1.0" });
const result = (data: unknown) => ({
	content: [{ type: "text" as const, text: JSON.stringify(data) }],
});
const error = (value: unknown) => ({
	isError: true,
	content: [
		{ type: "text" as const, text: value instanceof Error ? value.message : "Maul lookup failed." },
	],
});
const weekSchema = z
	.string()
	.regex(/^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/)
	.optional();

async function client(): Promise<MaulClient> {
	const token = await requireAuth();
	const config = getConfig();
	return new MaulClient({
		baseUrl: config.apiUrl,
		token: token.accessToken,
		userId: token.userId,
		organization: token.organization,
	});
}

server.registerTool(
	"menu",
	{
		description:
			"Read Maul lunch menu items for an ISO week; defaults to next week. No order is placed.",
		inputSchema: { week: weekSchema, day: z.number().int().min(1).max(5).optional() },
	},
	async ({ week, day }) => {
		try {
			const selectedWeek = week || getNextIsoWeek();
			const menus = await (await client()).getMenu(selectedWeek);
			const items = menus
				.flatMap((menu) => menu.Menu)
				.filter((item) => day === undefined || item.WeekdayNumber === day);
			return result({
				week: selectedWeek,
				count: items.length,
				items: items.slice(0, 125).map((item) => ({
					date: item.Date,
					day: item.WeekdayNumber,
					id: item.MenuItemId,
					restaurant: item.RestaurantName,
					name: item.ShortDescriptionByLang.is || item.ShortDescriptionByLang.en,
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
		inputSchema: { week: weekSchema },
	},
	async ({ week }) => {
		try {
			const selectedWeek = week || getNextIsoWeek();
			const orders = await (await client()).getOrders(selectedWeek);
			return result({
				week: selectedWeek,
				orders: orders.map((order) => ({
					day: order.WeekdayNumber,
					itemId: order.MenuItemId,
					restaurant: order.RestaurantName,
					name: order.ShortDescriptionByLang?.is || order.ShortDescriptionByLang?.en,
				})),
			});
		} catch (e) {
			return error(e);
		}
	},
);

if (process.env.MAUL_MCP_ENABLE_WRITES === "1") {
	server.registerTool(
		"order_submit",
		{
			description:
				"Submit one lunch order by exact menu item ID. Requires explicit startup opt-in and exact-ID confirmation. Refuses an existing order for that weekday.",
			inputSchema: {
				week: z.string().regex(/^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/),
				day: z.number().int().min(1).max(5),
				menuItemId: z.string().min(1).max(120),
				confirmItemId: z.string(),
			},
		},
		async ({ week, day, menuItemId, confirmItemId }) => {
			try {
				if (confirmItemId !== menuItemId)
					throw new Error("confirmItemId must exactly match menuItemId.");
				const token = await requireAuth();
				const api = await client();
				const existing = await api.getOrders(week);
				if (existing.some((order) => Number(order.WeekdayNumber) === day))
					throw new Error("An order already exists for this weekday; no change made.");
				const menus = await api.getMenu(week);
				const matches = menus
					.flatMap((menu) => menu.Menu)
					.filter((item) => item.WeekdayNumber === day && item.MenuItemId === menuItemId);
				if (matches.length !== 1)
					throw new Error("Exact menu item not found for that week and weekday.");
				const item = matches[0];
				if (!item) throw new Error("Exact menu item not found.");
				await api.submitOrder({
					UserId: token.userId,
					OrderItems: [
						{
							RestaurantId: item.RestaurantId,
							MenuId: "variety-a",
							MenuItemId: item.MenuItemId,
							MealTime: item.MealTime || "Lunch",
							OrderDate: item.Date,
						},
					],
				});
				try {
					const updated = await api.getOrders(week);
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
}

export async function serve(): Promise<void> {
	await server.connect(new StdioServerTransport());
}
