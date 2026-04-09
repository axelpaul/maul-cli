import type { CliError } from "./types.ts";

export function outputJson(data: unknown): void {
	console.log(JSON.stringify(data, null, 2));
}

export function outputError(message: string, statusCode?: number): never {
	const err: CliError = { error: message };
	if (statusCode !== undefined) err.status_code = statusCode;
	console.error(JSON.stringify(err));
	process.exit(1);
}
