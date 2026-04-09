import type { CliError } from "./types.ts";

/** Returns true if output should be JSON (non-TTY by default, overridable). */
export function isJsonMode(flags: { json?: boolean; pretty?: boolean }): boolean {
	if (flags.json) return true;
	if (flags.pretty) return false;
	// Auto-detect: JSON when piped, human when interactive
	return !process.stdout.isTTY;
}

export function outputJson(data: unknown): void {
	console.log(JSON.stringify(data, null, 2));
}

export function outputError(message: string, statusCode?: number): never {
	const err: CliError = { error: message };
	if (statusCode !== undefined) err.status_code = statusCode;
	console.error(JSON.stringify(err));
	process.exit(1);
}
