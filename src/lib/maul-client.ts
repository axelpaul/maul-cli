import type {
	UserProfile,
	WeeklyMenu,
	ExistingOrderItem,
	OrderSubmission,
	LocationOrder,
} from "./types.ts";

export class MaulClient {
	private baseUrl: string;
	private token: string;
	private userId: string;
	private organization: string;

	constructor(opts: {
		baseUrl: string;
		token: string;
		userId: string;
		organization: string;
	}) {
		this.baseUrl = opts.baseUrl;
		this.token = opts.token;
		this.userId = opts.userId;
		this.organization = opts.organization;
	}

	private headers(): Record<string, string> {
		return {
			Authorization: `Bearer ${this.token}`,
			Accept: "application/json",
			"Content-Type": "application/json",
			Origin: "https://app.maul.is",
			Referer: "https://app.maul.is/",
		};
	}

	private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		const url = `${this.baseUrl}${path}`;
		const res = await fetch(url, {
			method,
			headers: this.headers(),
			body: body ? JSON.stringify(body) : undefined,
		});

		if (!res.ok) {
			const text = await res.text().catch(() => "");
			throw new ApiError(`API ${method} ${path} failed: ${res.status} ${text}`, res.status);
		}

		if (res.status === 204) return undefined as T;
		return res.json() as Promise<T>;
	}

	async getUser(userId?: string): Promise<UserProfile> {
		return this.request<UserProfile>("GET", `/users/${userId || this.userId}`);
	}

	async getMenu(isoWeek: string): Promise<WeeklyMenu[]> {
		return this.request<WeeklyMenu[]>(
			"GET",
			`/location/${this.organization}/menus/${isoWeek}?fspId=maul`,
		);
	}

	async getOrders(isoWeek: string, userId?: string): Promise<ExistingOrderItem[]> {
		const uid = userId || this.userId;
		try {
			return await this.request<ExistingOrderItem[]>(
				"GET",
				`/users/${uid}/orders/${isoWeek}/v2`,
			);
		} catch (err) {
			if (err instanceof ApiError && err.statusCode === 404) {
				return [];
			}
			throw err;
		}
	}

	async submitOrder(order: OrderSubmission): Promise<unknown> {
		return this.request("POST", "/orders", order);
	}

	async getLocationOrders(date: string): Promise<LocationOrder[]> {
		return this.request<LocationOrder[]>(
			"GET",
			`/locations/${this.organization}/orders/${date}`,
		);
	}
}

export class ApiError extends Error {
	statusCode: number;
	constructor(message: string, statusCode: number) {
		super(message);
		this.name = "ApiError";
		this.statusCode = statusCode;
	}
}
