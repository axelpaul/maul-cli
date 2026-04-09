import { join } from "path";
import { homedir } from "os";
import type { CachedToken } from "./types.ts";

export const CONFIG_DIR = join(homedir(), ".maularinn");
export const TOKEN_PATH = join(CONFIG_DIR, "token.json");

export function getConfig() {
	return {
		userPoolId: process.env.USER_POOL_ID || "eu-west-1_KkkgJsbfo",
		clientId: process.env.CLIENT_ID || "2qavs2k3odmgef85si7bv02qjb",
		region: process.env.REGION || "eu-west-1",
		apiUrl: process.env.MAUL_API_URL || "https://dev-api.maul.is",
		serviceUsername: process.env.SERVICE_ACCOUNT_USERNAME,
		servicePassword: process.env.SERVICE_ACCOUNT_PASSWORD,
	};
}

export async function loadToken(): Promise<CachedToken | null> {
	try {
		const file = Bun.file(TOKEN_PATH);
		if (!(await file.exists())) return null;
		const token: CachedToken = await file.json();
		return token;
	} catch {
		return null;
	}
}

export async function saveToken(token: CachedToken): Promise<void> {
	const { mkdirSync } = await import("fs");
	mkdirSync(CONFIG_DIR, { recursive: true });
	await Bun.write(TOKEN_PATH, JSON.stringify(token, null, 2));
}

export async function requireAuth(): Promise<CachedToken> {
	const token = await loadToken();
	if (!token) {
		throw new Error('Not authenticated. Run "maul auth login" first.');
	}
	if (Date.now() >= token.expiresAt) {
		throw new Error('Token expired. Run "maul auth login" to re-authenticate.');
	}
	return token;
}
