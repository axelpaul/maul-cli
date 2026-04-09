#!/usr/bin/env bun

import { login, statusCommand, logout } from "./commands/auth.ts";
import { showMenu } from "./commands/menu.ts";
import { showOrders, submitOrder, cancelOrder } from "./commands/order.ts";
import { userInfo } from "./commands/user.ts";
import { adminOrders } from "./commands/admin.ts";
import { isJsonMode } from "./lib/output.ts";

function getFlag(name: string): string | undefined {
	const index = process.argv.indexOf(`--${name}`);
	if (index > -1 && process.argv[index + 1]) {
		return process.argv[index + 1];
	}
	const shortMap: Record<string, string> = {
		w: "week",
		d: "day",
		m: "meals",
	};
	for (const [short, long] of Object.entries(shortMap)) {
		if (long === name) {
			const shortIndex = process.argv.indexOf(`-${short}`);
			if (shortIndex > -1 && process.argv[shortIndex + 1]) {
				return process.argv[shortIndex + 1];
			}
		}
	}
	return undefined;
}

function hasFlag(name: string): boolean {
	return process.argv.includes(`--${name}`);
}

const COMMANDS = [
	{
		name: "login",
		description: "Authenticate and cache token",
		args: [
			{ name: "username", type: "string", required: true, positional: true },
			{ name: "password", type: "string", required: true, positional: true },
		],
	},
	{ name: "logout", description: "Clear cached token", args: [] },
	{ name: "status", description: "Show auth status", args: [] },
	{ name: "me", description: "Show user profile", args: [] },
	{
		name: "menu",
		description: "Show weekly menu",
		args: [{ name: "week", short: "w", type: "string", description: "ISO week (YYYY-WNN), defaults to next week" }],
	},
	{
		name: "orders",
		description: "Show your orders for a week",
		args: [{ name: "week", short: "w", type: "string", description: "ISO week (YYYY-WNN), defaults to next week" }],
	},
	{
		name: "order-submit",
		description: "Submit an order. Meals can be exact menu item IDs or plain text descriptions that will be fuzzy-matched.",
		args: [
			{ name: "week", short: "w", type: "string", required: true, description: "ISO week (YYYY-WNN)" },
			{
				name: "meals",
				short: "m",
				type: "json",
				required: true,
				description: 'JSON map of weekday (1-5) to menu item ID or search text, e.g. {"1":"pad thai chicken","2":"beef pie"}',
			},
		],
	},
	{
		name: "order-cancel",
		description: "Cancel order for a specific day",
		args: [
			{ name: "week", short: "w", type: "string", required: true, description: "ISO week (YYYY-WNN)" },
			{ name: "day", short: "d", type: "number", required: true, description: "Weekday number (1=Mon, 5=Fri)" },
		],
	},
	{
		name: "admin-orders",
		description: "View all orders for a date",
		args: [{ name: "date", type: "string", required: true, description: "Date (YYYY-MM-DD)" }],
	},
];

function printHelp() {
	console.log(`
maul - CLI for the Maul lunch ordering system

Usage: maul <command> [options]

Commands:
  login <user> <pass>   Authenticate and cache token
  logout                Clear cached token
  status                Show auth status
  me                    Show user profile
  menu                  Show weekly menu
  orders                Show your orders for a week
  order-submit          Submit an order (supports fuzzy menu matching)
  order-cancel          Cancel order for a specific day
  admin-orders          View all orders for a date

Options:
  --json                Force JSON output
  --pretty              Force human-readable output
  -w, --week <YYYY-WNN> ISO week (defaults to next week)
  -d, --day <1-5>       Weekday number (1=Mon, 5=Fri)
  -m, --meals <json>    JSON map: {"1":"pad thai chicken","2":"beef pie"}
  --date <YYYY-MM-DD>   Date for admin queries
  --help                Show this help message
  --version             Show version

Output is JSON when piped, human-readable in a terminal.
Use --json or --pretty to override.
`);
}

function printJsonHelp() {
	console.log(JSON.stringify({ commands: COMMANDS }, null, 2));
}

const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const command = args[0];
const json = isJsonMode({ json: hasFlag("json"), pretty: hasFlag("pretty") });

try {
	switch (command) {
		case "login":
			await login({ username: args[1], password: args[2], json });
			break;

		case "logout":
			await logout();
			break;

		case "status":
			await statusCommand({ json });
			break;

		case "me":
			await userInfo({ json });
			break;

		case "menu":
			await showMenu({ week: getFlag("week"), json });
			break;

		case "orders":
			await showOrders({ week: getFlag("week"), json });
			break;

		case "order-submit":
			await submitOrder({
				week: getFlag("week"),
				meals: getFlag("meals"),
				json,
			});
			break;

		case "order-cancel":
			await cancelOrder({
				week: getFlag("week"),
				day: getFlag("day"),
				json,
			});
			break;

		case "admin-orders":
			await adminOrders({ date: getFlag("date"), json });
			break;

		case "help":
		case undefined:
			if (json) {
				printJsonHelp();
			} else {
				printHelp();
			}
			break;

		case "version":
			console.log(json ? JSON.stringify({ version: "0.1.0" }) : "maul v0.1.0");
			break;

		default:
			if (hasFlag("help")) {
				if (json) printJsonHelp();
				else printHelp();
			} else if (hasFlag("version")) {
				console.log(json ? JSON.stringify({ version: "0.1.0" }) : "maul v0.1.0");
			} else {
				console.error(
					json
						? JSON.stringify({ error: `Unknown command: ${command}` })
						: `Unknown command: ${command}. Run "maul help" for usage.`,
				);
				process.exit(1);
			}
	}
} catch (error: any) {
	if (json) {
		console.error(JSON.stringify({ error: error.message }));
	} else {
		console.error(`Error: ${error.message}`);
	}
	process.exit(1);
}
