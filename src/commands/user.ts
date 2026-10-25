import { getSession } from "../lib/actions.ts";

export async function userInfo(opts: { json?: boolean }) {
	const { client } = await getSession();

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
