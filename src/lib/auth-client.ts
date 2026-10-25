import {
	AuthenticationDetails,
	CognitoRefreshToken,
	CognitoUser,
	CognitoUserPool,
	type CognitoUserSession,
} from "amazon-cognito-identity-js";

export interface AuthResult {
	accessToken: string;
	idToken: string;
	refreshToken: string;
	expiresIn: number;
}

function toResult(session: CognitoUserSession): AuthResult {
	return {
		accessToken: session.getAccessToken().getJwtToken(),
		idToken: session.getIdToken().getJwtToken(),
		refreshToken: session.getRefreshToken().getToken(),
		expiresIn: session.getAccessToken().getExpiration() - Math.floor(Date.now() / 1000),
	};
}

function cognitoUser(userPoolId: string, clientId: string, username: string): CognitoUser {
	const pool = new CognitoUserPool({ UserPoolId: userPoolId, ClientId: clientId });
	return new CognitoUser({ Username: username, Pool: pool });
}

export function authenticateCognito(opts: {
	userPoolId: string;
	clientId: string;
	username: string;
	password: string;
}): Promise<AuthResult> {
	return new Promise((resolve, reject) => {
		const user = cognitoUser(opts.userPoolId, opts.clientId, opts.username);
		const authDetails = new AuthenticationDetails({
			Username: opts.username,
			Password: opts.password,
		});

		user.authenticateUser(authDetails, {
			onSuccess(session) {
				resolve(toResult(session));
			},
			onFailure(err) {
				reject(new Error(err.message || "Authentication failed"));
			},
			newPasswordRequired() {
				reject(new Error("Maul requires a new password; sign in once at https://app.maul.is."));
			},
		});
	});
}

export function refreshCognitoSession(opts: {
	userPoolId: string;
	clientId: string;
	username: string;
	refreshToken: string;
}): Promise<AuthResult> {
	return new Promise((resolve, reject) => {
		const user = cognitoUser(opts.userPoolId, opts.clientId, opts.username);
		user.refreshSession(
			new CognitoRefreshToken({ RefreshToken: opts.refreshToken }),
			(err: Error | null, session: CognitoUserSession) => {
				if (err) reject(new Error(err.message || "Token refresh failed"));
				else resolve(toResult(session));
			},
		);
	});
}
