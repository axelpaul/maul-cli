import { writeSync } from "node:fs";
import type { CliError } from "./types.ts";

/** Returns true if output should be JSON (non-TTY by default, overridable). */
export function isJsonMode(flags: { json?: boolean; pretty?: boolean }): boolean {
	if (flags.json) return true;
	if (flags.pretty) return false;
	// Auto-detect: JSON when piped, human when interactive
	return !process.stdout.isTTY;
}

export function outputJson(data: unknown): void {
	// Complete the write before returning; console.log can truncate large pipe output.
	const bytes = Buffer.from(`${JSON.stringify(data, null, 2)}\n`);
	let offset = 0;
	while (offset < bytes.length) {
		try {
			offset += writeSync(1, bytes, offset, bytes.length - offset);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EAGAIN") throw error;
			Bun.sleepSync(1);
		}
	}
}

export function outputError(message: string, statusCode?: number): never {
	const err: CliError = { error: message };
	if (statusCode !== undefined) err.status_code = statusCode;
	console.error(JSON.stringify(err));
	process.exit(1);
}
