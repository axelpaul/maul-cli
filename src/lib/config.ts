import { chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { refreshCognitoSession } from "./auth-client.ts";
import type { CachedToken } from "./types.ts";

/**
 * Public Cognito app client used by the Maul web app (app.maul.is). Every Maul user,
 * regardless of employer, signs in through this same user pool and client; the
 * employer/location is read from the user's profile after login. Override with
 * MAUL_COGNITO_USER_POOL_ID / MAUL_COGNITO_CLIENT_ID if Maul ever rotates them.
 */
export const DEFAULT_USER_POOL_ID = "eu-west-1_KkkgJsbfo";
export const DEFAULT_CLIENT_ID = "2qavs2k3odmgef85si7bv02qjb";
/** API host the Maul web app talks to. */
export const DEFAULT_API_URL = "https://dev-api.maul.is";

function configDir(): string {
	if (process.env.MAUL_CONFIG_DIR) return process.env.MAUL_CONFIG_DIR;
	const xdg = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
	return join(xdg, "maul-cli");
}

export function tokenPath(): string {
	return join(configDir(), "token.json");
}

/** Token location used by versions before 0.2.0; read as a fallback only. */
function legacyTokenPath(): string {
	return join(homedir(), ".maularinn", "token.json");
}

export function getConfig() {
	return {
		userPoolId:
			process.env.MAUL_COGNITO_USER_POOL_ID || process.env.USER_POOL_ID || DEFAULT_USER_POOL_ID,
		clientId: process.env.MAUL_COGNITO_CLIENT_ID || process.env.CLIENT_ID || DEFAULT_CLIENT_ID,
		apiUrl: (process.env.MAUL_API_URL || DEFAULT_API_URL).replace(/\/+$/, ""),
		username: process.env.MAUL_USERNAME || process.env.SERVICE_ACCOUNT_USERNAME,
		password: process.env.MAUL_PASSWORD || process.env.SERVICE_ACCOUNT_PASSWORD,
	};
}

export async function loadToken(): Promise<CachedToken | null> {
	for (const path of [tokenPath(), legacyTokenPath()]) {
		try {
			const file = Bun.file(path);
			if (await file.exists()) return (await file.json()) as CachedToken;
		} catch {
			// unreadable cache; try the next location
		}
	}
	return null;
}

export async function saveToken(token: CachedToken): Promise<void> {
	mkdirSync(configDir(), { recursive: true, mode: 0o700 });
	const path = tokenPath();
	await Bun.write(path, JSON.stringify(token, null, 2));
	try {
		chmodSync(path, 0o600);
	} catch {
		// best effort (e.g. Windows)
	}
}

/** Remove cached tokens. Returns true if anything was deleted. */
export function clearToken(): boolean {
	let removed = false;
	for (const path of [tokenPath(), legacyTokenPath()]) {
		if (existsSync(path)) {
			unlinkSync(path);
			removed = true;
		}
	}
	return removed;
}

/** Load the cached token, refreshing it with the stored refresh token if it has expired. */
export async function requireAuth(): Promise<CachedToken> {
	const token = await loadToken();
	if (!token) {
		throw new Error('Not authenticated. Run "maul login" first.');
	}
	if (Date.now() < token.expiresAt - 60_000) return token;

	if (token.refreshToken && token.username) {
		const config = getConfig();
		try {
			const refreshed = await refreshCognitoSession({
				userPoolId: config.userPoolId,
				clientId: config.clientId,
				username: token.username,
				refreshToken: token.refreshToken,
			});
			const updated: CachedToken = {
				...token,
				accessToken: refreshed.accessToken,
				refreshToken: refreshed.refreshToken || token.refreshToken,
				expiresAt: Date.now() + refreshed.expiresIn * 1000,
			};
			await saveToken(updated);
			return updated;
		} catch (err) {
			throw new Error(
				`Session expired and refresh failed (${err instanceof Error ? err.message : err}). Run "maul login" again.`,
			);
		}
	}
	throw new Error('Token expired. Run "maul login" to re-authenticate.');
}
