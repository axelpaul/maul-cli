import { requireAuth, getConfig } from "../lib/config.ts";
import { MaulClient } from "../lib/maul-client.ts";

export async function userInfo(opts: { json?: boolean }) {
	const token = await requireAuth();
	const config = getConfig();

	const client = new MaulClient({
		baseUrl: config.apiUrl,
		token: token.accessToken,
		userId: token.userId,
		organization: token.organization,
	});

	const profile = await client.getUser();

	if (opts.json) {
		console.log(JSON.stringify(profile, null, 2));
	} else {
		console.log(`User: ${profile.Email}`);
		console.log(`  ID:           ${profile.UserId}`);
		console.log(`  Company:      ${profile.CompanyName}`);
		console.log(`  Organization: ${profile.LocationId}`);
		if (profile.Name) console.log(`  Name:         ${profile.Name}`);
	}
}
