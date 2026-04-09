import { unlinkSync } from "fs";
import { authenticateCognito } from "../lib/auth-client.ts";
import { getConfig, saveToken, loadToken, TOKEN_PATH } from "../lib/config.ts";
import type { CachedToken, UserProfile } from "../lib/types.ts";

export async function login(opts: { username?: string; password?: string; json?: boolean }) {
	const config = getConfig();

	const username = opts.username || config.serviceUsername;
	const password = opts.password || config.servicePassword;

	if (!username || !password) {
		throw new Error(
			"Usage: maul login <username> <password>",
		);
	}

	const auth = await authenticateCognito({
		userPoolId: config.userPoolId,
		clientId: config.clientId,
		username,
		password,
	});

	// Decode id token to get sub (userId) — same as reference app
	const jwtParts = auth.idToken.split(".");
	const claims = JSON.parse(Buffer.from(jwtParts[1]!, "base64").toString());
	const userId: string = claims.sub;

	// Fetch user profile to get LocationId
	const headers = {
		Authorization: `Bearer ${auth.accessToken}`,
		Accept: "application/json",
		Origin: "https://app.maul.is",
		Referer: "https://app.maul.is/",
	};

	const res = await fetch(`${config.apiUrl}/users/${userId}`, { headers });
	if (!res.ok) {
		throw new Error(`Failed to fetch user profile: ${res.status}`);
	}

	const profile = (await res.json()) as UserProfile;

	const token: CachedToken = {
		accessToken: auth.accessToken,
		userId,
		organization: profile.LocationId,
		email: profile.Email,
		expiresAt: Date.now() + auth.expiresIn * 1000,
	};

	await saveToken(token);

	if (opts.json) {
		console.log(
			JSON.stringify(
				{
					status: "authenticated",
					userId: token.userId,
					email: token.email,
					organization: token.organization,
					expiresAt: new Date(token.expiresAt).toISOString(),
				},
				null,
				2,
			),
		);
	} else {
		console.log(`Authenticated as ${token.email}`);
		console.log(`  User ID:      ${token.userId}`);
		console.log(`  Organization: ${token.organization}`);
		console.log(`  Expires:      ${new Date(token.expiresAt).toLocaleString()}`);
	}
}

export async function statusCommand(opts: { json?: boolean }) {
	const token = await loadToken();

	if (!token) {
		if (opts.json) {
			console.log(JSON.stringify({ authenticated: false, reason: "No cached token found" }, null, 2));
		} else {
			console.log("Not authenticated. Run \"maul auth login\" first.");
		}
		return;
	}

	const expired = Date.now() >= token.expiresAt;

	if (opts.json) {
		console.log(
			JSON.stringify(
				{
					authenticated: !expired,
					userId: token.userId,
					email: token.email,
					organization: token.organization,
					expiresAt: new Date(token.expiresAt).toISOString(),
					...(expired ? { reason: "Token expired" } : {}),
				},
				null,
				2,
			),
		);
	} else {
		if (expired) {
			console.log("Token expired. Run \"maul auth login\" to re-authenticate.");
		} else {
			console.log(`Authenticated as ${token.email}`);
			console.log(`  Organization: ${token.organization}`);
			console.log(`  Expires:      ${new Date(token.expiresAt).toLocaleString()}`);
		}
	}
}

export async function logout() {
	try {
		unlinkSync(TOKEN_PATH);
		console.log("Logged out.");
	} catch {
		console.log("Already logged out.");
	}
}
