import { authStatus } from "../lib/actions.ts";
import { authenticateCognito } from "../lib/auth-client.ts";
import { clearToken, getConfig, saveToken } from "../lib/config.ts";
import { MaulClient } from "../lib/maul-client.ts";
import { promptLine } from "../lib/prompt.ts";
import type { CachedToken } from "../lib/types.ts";

export async function login(opts: { username?: string; password?: string; json?: boolean }) {
	const config = getConfig();

	let username = opts.username || config.username;
	let password = opts.password || config.password;

	if (process.stdin.isTTY) {
		if (!username) username = await promptLine("Maul email: ");
		if (!password) password = await promptLine("Maul password: ", { hidden: true });
	}

	if (!username || !password) {
		throw new Error(
			"Usage: maul login [email] — prompts for the password, or set MAUL_USERNAME and MAUL_PASSWORD",
		);
	}

	const auth = await authenticateCognito({
		userPoolId: config.userPoolId,
		clientId: config.clientId,
		username,
		password,
	});

	// The id token's `sub` claim is the Maul user ID.
	const jwtParts = auth.idToken.split(".");
	const claims = JSON.parse(Buffer.from(jwtParts[1]!, "base64url").toString());
	const userId: string = claims.sub;

	// The user's profile carries the location (employer canteen) used for menus.
	const profile = await new MaulClient({
		baseUrl: config.apiUrl,
		token: auth.accessToken,
		userId,
		organization: "",
	}).getUser();

	const token: CachedToken = {
		accessToken: auth.accessToken,
		refreshToken: auth.refreshToken,
		username,
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
	}
}

export async function statusCommand(opts: { json?: boolean }) {
	const status = await authStatus();

	if (opts.json) {
		console.log(JSON.stringify(status, null, 2));
		return;
	}
	if (!("email" in status)) {
		console.log('Not authenticated. Run "maul login" first.');
	} else if (!status.authenticated) {
		console.log('Token expired. Run "maul login" to re-authenticate.');
	} else {
		console.log(`Authenticated as ${status.email}`);
		console.log(`  Organization: ${status.organization}`);
		console.log(`  Expires:      ${new Date(status.expiresAt).toLocaleString()}`);
		if ("note" in status && status.note) console.log(`  ${status.note}`);
	}
}

export async function logout() {
	console.log(clearToken() ? "Logged out." : "Already logged out.");
}
