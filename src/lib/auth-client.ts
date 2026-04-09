import {
	CognitoUserPool,
	CognitoUser,
	AuthenticationDetails,
} from "amazon-cognito-identity-js";

export interface AuthResult {
	accessToken: string;
	idToken: string;
	expiresIn: number;
}

export function authenticateCognito(opts: {
	userPoolId: string;
	clientId: string;
	username: string;
	password: string;
}): Promise<AuthResult> {
	return new Promise((resolve, reject) => {
		const pool = new CognitoUserPool({
			UserPoolId: opts.userPoolId,
			ClientId: opts.clientId,
		});

		const user = new CognitoUser({
			Username: opts.username,
			Pool: pool,
		});

		const authDetails = new AuthenticationDetails({
			Username: opts.username,
			Password: opts.password,
		});

		user.authenticateUser(authDetails, {
			onSuccess(session) {
				resolve({
					accessToken: session.getAccessToken().getJwtToken(),
					idToken: session.getIdToken().getJwtToken(),
					expiresIn: session.getAccessToken().getExpiration() - Math.floor(Date.now() / 1000),
				});
			},
			onFailure(err) {
				reject(new Error(err.message || "Authentication failed"));
			},
		});
	});
}
