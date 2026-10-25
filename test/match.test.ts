import { expect, test } from "bun:test";
import { resolveMeals, toOrderItem } from "../src/lib/actions.ts";
import type { MenuItem } from "../src/lib/types.ts";

function item(id: string, day: number, en: string): MenuItem {
	return {
		MenuItemId: id,
		RestaurantId: "rest-1",
		RestaurantName: "Dæmieldhús",
		WeekdayNumber: day,
		MealTime: "Lunch",
		Allergens: [],
		AllergensProvided: true,
		DietTypes: [],
		DescriptionByLang: {},
		ShortDescriptionByLang: { en },
		Date: `2026-10-2${5 + day}`,
		Temperature: "hot",
		ImageId: null,
		CandidateMenuItemIds: [],
	};
}

const items = [
	item("a.mon", 1, "Pad thai chicken"),
	item("b.mon", 1, "Beef pie"),
	item("c.tue", 2, "Vegan curry"),
];

test("resolveMeals matches exact IDs and fuzzy text per weekday", () => {
	const resolved = resolveMeals(items, { "1": "beef pie", "2": "c.tue" });
	expect(resolved.map((r) => r.match.MenuItemId)).toEqual(["b.mon", "c.tue"]);
});

test("resolveMeals rejects bad days and unknown meals", () => {
	expect(() => resolveMeals(items, { "6": "beef" })).toThrow("Must be 1-5");
	expect(() => resolveMeals(items, { "2": "sushi" })).toThrow("No match");
});

test("toOrderItem builds the order payload", () => {
	expect(toOrderItem(items[0]!)).toEqual({
		RestaurantId: "rest-1",
		MenuId: "variety-a",
		MenuItemId: "a.mon",
		MealTime: "Lunch",
		OrderDate: "2026-10-26",
	});
});
