#!/usr/bin/env bun

import { login, statusCommand, logout } from "./commands/auth.ts";
import { showMenu } from "./commands/menu.ts";
import { showOrders, submitOrder, cancelOrder } from "./commands/order.ts";
import { userInfo } from "./commands/user.ts";
import { adminOrders } from "./commands/admin.ts";

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

function printHelp() {
	console.log(`
maul - CLI for the Maularinn lunch ordering system

Usage: maul <command> [options]

Commands:
  login <user> <pass>   Authenticate and cache token
  logout                Clear cached token
  status                Show auth status
  me                    Show user profile
  menu                  Show weekly menu
  orders                Show your orders for a week
  order-submit          Submit an order
  order-cancel          Cancel order for a specific day
  admin-orders          View all orders for a date

Options:
  --json                Output as JSON (default is human-readable)
  -w, --week <YYYY-WNN> ISO week (defaults to next week)
  -d, --day <1-5>       Weekday number (1=Mon, 5=Fri)
  -m, --meals <json>    JSON map: {"1":"item_id","2":"item_id"}
  --date <YYYY-MM-DD>   Date for admin queries
  --help                Show this help message
  --version             Show version
`);
}

const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const command = args[0];
const isJson = hasFlag("json");

try {
	switch (command) {
		case "login":
			await login({ username: args[1], password: args[2], json: isJson });
			break;

		case "logout":
			await logout();
			break;

		case "status":
			await statusCommand({ json: isJson });
			break;

		case "me":
			await userInfo({ json: isJson });
			break;

		case "menu":
			await showMenu({ week: getFlag("week"), json: isJson });
			break;

		case "orders":
			await showOrders({ week: getFlag("week"), json: isJson });
			break;

		case "order-submit":
			await submitOrder({
				week: getFlag("week"),
				meals: getFlag("meals"),
				json: isJson,
			});
			break;

		case "order-cancel":
			await cancelOrder({
				week: getFlag("week"),
				day: getFlag("day"),
				json: isJson,
			});
			break;

		case "admin-orders":
			await adminOrders({ date: getFlag("date"), json: isJson });
			break;

		case "help":
		case undefined:
			printHelp();
			break;

		case "version":
			console.log("maul v0.1.0");
			break;

		default:
			if (hasFlag("help")) {
				printHelp();
			} else if (hasFlag("version")) {
				console.log("maul v0.1.0");
			} else {
				console.error(`Unknown command: ${command}. Run "maul help" for usage.`);
				process.exit(1);
			}
	}
} catch (error: any) {
	if (isJson) {
		console.error(JSON.stringify({ error: error.message }));
	} else {
		console.error(`Error: ${error.message}`);
	}
	process.exit(1);
}
