import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import pkg from "../package.json" with { type: "json" };
import { saveToken } from "../src/lib/config.ts";
import { createServer } from "../src/mcp/server.ts";

const READ_TOOLS = ["admin_orders", "auth_status", "me", "menu", "orders"];
const WRITE_TOOLS = ["order_cancel", "order_submit"];

let configDir: string;
const realFetch = globalThis.fetch;

beforeAll(() => {
	configDir = mkdtempSync(join(tmpdir(), "maul-test-"));
	process.env.MAUL_CONFIG_DIR = configDir;
	process.env.MAUL_API_URL = "https://maul.test";
});
afterAll(() => rmSync(configDir, { recursive: true, force: true }));
afterEach(() => {
	globalThis.fetch = realFetch;
});

function stdioEnv(extra: Record<string, string> = {}): Record<string, string> {
	const env: Record<string, string> = {};
	for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
	delete env.MAUL_MCP_ENABLE_WRITES;
	return { ...env, MAUL_CONFIG_DIR: configDir, ...extra };
}

async function connectStdio(env: Record<string, string>) {
	const client = new Client({ name: "maul-test", version: "0.0.0" });
	await client.connect(
		new StdioClientTransport({
			command: process.execPath,
			args: ["src/index.ts", "serve"],
			cwd: process.cwd(),
			stderr: "pipe",
			env,
		}),
	);
	return client;
}

async function connectInMemory(enableWrites: boolean) {
	const server = createServer({ enableWrites });
	const client = new Client({ name: "maul-test", version: "0.0.0" });
	const [a, b] = InMemoryTransport.createLinkedPair();
	await Promise.all([server.connect(a), client.connect(b)]);
	return client;
}

function text(res: any): string {
	return res.content[0].text;
}

test("stdio server exposes only read tools by default", async () => {
	const client = await connectStdio(stdioEnv());
	try {
		const names = (await client.listTools()).tools.map((t) => t.name).sort();
		expect(names).toEqual(READ_TOOLS);
		const invalid = await client.callTool({ name: "menu", arguments: { week: "bad-week" } });
		expect(invalid.isError).toBe(true);
	} finally {
		await client.close();
	}
});

test("write tools appear only with MAUL_MCP_ENABLE_WRITES=1", async () => {
	const client = await connectStdio(stdioEnv({ MAUL_MCP_ENABLE_WRITES: "1" }));
	try {
		const names = (await client.listTools()).tools.map((t) => t.name).sort();
		expect(names).toEqual([...READ_TOOLS, ...WRITE_TOOLS].sort());
		const rejected = await client.callTool({
			name: "order_submit",
			arguments: { week: "2026-W42", day: 1, menuItemId: "item-a", confirmItemId: "item-b" },
		});
		expect(rejected.isError).toBe(true);
	} finally {
		await client.close();
	}
});

test("tools report missing login without crashing", async () => {
	const client = await connectInMemory(false);
	try {
		const status = JSON.parse(text(await client.callTool({ name: "auth_status", arguments: {} })));
		expect(status.authenticated).toBe(false);
		const me = await client.callTool({ name: "me", arguments: {} });
		expect(me.isError).toBe(true);
		expect(text(me)).toContain("maul login");
	} finally {
		await client.close();
	}
});

test("orders and order_cancel use the shared client with confirmation", async () => {
	await saveToken({
		accessToken: "test-token",
		userId: "user-1",
		organization: "loc-1",
		email: "jon@example.com",
		expiresAt: Date.now() + 3_600_000,
	});
	const calls: Array<{ method: string; url: string; body?: string }> = [];
	const order = {
		MenuItemId: "item.mon",
		RestaurantId: "rest-1",
		RestaurantName: "Dæmieldhús",
		WeekdayNumber: "1",
		MealTime: "Lunch",
		Date: "2026-10-26",
		ShortDescriptionByLang: { en: "Fish", is: "Fiskur" },
		DescriptionByLang: {},
		Allergens: [],
		AllergensProvided: true,
		DietTypes: [],
	};
	globalThis.fetch = (async (input: any, init?: RequestInit) => {
		const url = String(input);
		calls.push({ method: init?.method ?? "GET", url, body: init?.body as string | undefined });
		if (url.endsWith("/orders/2026-W44/v2")) return Response.json([order]);
		if (url.endsWith("/orders/cancel")) return new Response(null, { status: 204 });
		return new Response("not found", { status: 404 });
	}) as typeof fetch;

	const client = await connectInMemory(true);
	try {
		const orders = JSON.parse(
			text(await client.callTool({ name: "orders", arguments: { week: "2026-W44" } })),
		);
		expect(orders.orders[0]).toMatchObject({ day: 1, itemId: "item.mon", name: "Fiskur" });

		const wrong = await client.callTool({
			name: "order_cancel",
			arguments: { week: "2026-W44", day: 1, confirmItemId: "item.other" },
		});
		expect(wrong.isError).toBe(true);
		expect(calls.some((c) => c.method === "POST")).toBe(false);

		const ok = await client.callTool({
			name: "order_cancel",
			arguments: { week: "2026-W44", day: 1, confirmItemId: "item.mon" },
		});
		expect(ok.isError).toBeFalsy();
		const post = calls.find((c) => c.method === "POST");
		expect(post?.url).toBe("https://maul.test/users/user-1/orders/cancel");
		expect(JSON.parse(post!.body!)).toEqual({
			mealTime: "Lunch",
			menuItemId: "item.mon",
			orderDate: "2026-10-26",
			restaurantId: "rest-1",
		});
	} finally {
		await client.close();
	}
});

test("--version prints the package.json version", async () => {
	const proc = Bun.spawn([process.execPath, "src/index.ts", "--version"], { stdout: "pipe" });
	expect((await new Response(proc.stdout).text()).trim()).toBe(pkg.version);
});

test("--help lists serve", async () => {
	const proc = Bun.spawn([process.execPath, "src/index.ts", "--help"], { stdout: "pipe" });
	expect(await new Response(proc.stdout).text()).toContain("serve");
});
