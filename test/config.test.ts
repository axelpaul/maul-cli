import { afterEach, expect, test } from "bun:test";
import { getConfig } from "../src/lib/config.ts";

const original = process.env.MAUL_API_URL;

afterEach(() => {
	if (original === undefined) delete process.env.MAUL_API_URL;
	else process.env.MAUL_API_URL = original;
});

test("defaults to the foodie API base", () => {
	delete process.env.MAUL_API_URL;
	expect(getConfig().apiUrl).toBe("https://api.maul.is/foodie");
});

test("MAUL_API_URL overrides the base without a trailing slash", () => {
	process.env.MAUL_API_URL = "https://example.test/foodie/";
	expect(getConfig().apiUrl).toBe("https://example.test/foodie");
});
