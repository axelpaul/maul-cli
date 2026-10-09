import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("Maul MCP stdio handshake and read-only tools", async () => {
	const client = new Client({ name: "maul-test", version: "0.1.0" });
	try {
		await client.connect(new StdioClientTransport({ command: process.execPath, args: ["src/index.ts", "serve"], cwd: process.cwd(), stderr: "pipe" }));
		expect((await client.listTools()).tools.map(tool => tool.name).sort()).toEqual(["menu", "orders"]);
		const invalid = await client.callTool({ name: "menu", arguments: { week: "bad-week" } });
		expect(invalid.isError).toBe(true);
	} finally {
		await client.close();
	}
});

test("Maul write tool is opt-in and refuses mismatched confirmation", async () => {
	const client = new Client({ name: "maul-write-test", version: "0.1.0" });
	try {
		await client.connect(new StdioClientTransport({ command: process.execPath, args: ["src/index.ts", "serve"], cwd: process.cwd(), stderr: "pipe", env: { ...process.env, MAUL_MCP_ENABLE_WRITES: "1" } }));
		expect((await client.listTools()).tools.map(tool => tool.name)).toContain("order_submit");
		const rejected = await client.callTool({ name: "order_submit", arguments: { week: "2026-W42", day: 1, menuItemId: "item-a", confirmItemId: "item-b" } });
		expect(rejected.isError).toBe(true);
	} finally {
		await client.close();
	}
});
