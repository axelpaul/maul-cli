const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/** Get ISO week string for next week (YYYY-WNN). */
export function getNextIsoWeek(): string {
	const today = new Date();
	const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
	return formatIsoWeek(nextWeek);
}

/** Get ISO week string for current week (YYYY-WNN). */
export function getCurrentIsoWeek(): string {
	return formatIsoWeek(new Date());
}

export function weekdayName(n: number): string {
	return WEEKDAY_NAMES[n - 1] || `Day ${n}`;
}

function formatIsoWeek(date: Date): string {
	const year = getIsoYear(date);
	const week = getIsoWeekNumber(date);
	return `${year}-W${String(week).padStart(2, "0")}`;
}

function getIsoWeekNumber(date: Date): number {
	const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	const dayNum = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getIsoYear(date: Date): number {
	const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	const dayNum = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	return d.getUTCFullYear();
}
