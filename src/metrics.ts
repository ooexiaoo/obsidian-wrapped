import { App, CachedMetadata, TFile } from "obsidian";
import {
	MonthlyBucket,
	NoteStats,
	TopNote,
	WrappedData,
	WrappedSettings,
} from "./types";

const DAY_MS = 86_400_000;

function dayKey(ms: number): string {
	const d = new Date(ms);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hour(ms: number): number {
	return new Date(ms).getHours();
}

/** Try to extract a creation timestamp from frontmatter date fields. */
function frontmatterDate(cache: CachedMetadata | null): number | null {
	if (!cache?.frontmatter) return null;
	const fm: Record<string, unknown> = cache.frontmatter;
	const candidates = ["created", "date", "date_created", "created_at", "creation_date"];
	for (const key of candidates) {
		const raw: unknown = fm[key];
		if (raw == null) continue;
		const t = Date.parse(String(raw));
		if (!isNaN(t)) return t;
	}
	return null;
}

/** Return the best-guess creation time for a note: frontmatter → mtime → ctime. */
function resolvedCreatedTime(file: TFile, cache: CachedMetadata | null): number {
	const fm = frontmatterDate(cache);
	if (fm !== null) return fm;
	if (file.stat.mtime) return file.stat.mtime;
	return file.stat.ctime;
}

function stripFrontmatter(raw: string): string {
	// YAML frontmatter is delimited by --- at the very start
	const m = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
	if (m && m[0].length > 0) {
		const fm = m[0];
		const body = raw.slice(fm.length);
		// keep inline code/fences out of the word count partially; simple pass: count words
		return body;
	}
	return raw;
}

export function countWords(raw: string): number {
	const body = stripFrontmatter(raw);
	const codeBlockRe = /```[\s\S]*?```|`[^`]*`/g;
	const cleaned = body.replace(codeBlockRe, " ");
	return cleaned.split(/\s+/).filter((w) => w.length > 0).length;
}

function countTasks(raw: string): { total: number; done: number } {
	const body = stripFrontmatter(raw);
	let total = 0;
	let done = 0;
	for (const line of body.split("\n")) {
		const m = line.match(/^\s*[-*+] \[([ xX])\]/);
		if (m) {
			total++;
			if (m[1] === "x" || m[1] === "X") done++;
		}
	}
	return { total, done };
}

function isDailyNote(basename: string, dailyFolder: string, path: string): boolean {
	if (dailyFolder && path.startsWith(dailyFolder.replace(/\/$/, "") + "/")) return true;
	return /^\d{4}-\d{2}-\d{2}/.test(basename);
}

async function withConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
	let i = 0;
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (i < items.length) {
			const item = items[i++];
			try {
				await fn(item);
			} catch {
				// skip unreadable file
			}
		}
	});
	await Promise.all(workers);
}

export async function computeWrapped(app: App, settings: WrappedSettings): Promise<WrappedData> {
	const files = app.vault.getMarkdownFiles();
	const year = settings.year;
	const yearStart = new Date(year, 0, 1).getTime();
	const yearEndMs = new Date(year + 1, 0, 1).getTime();

	const notes: NoteStats[] = [];
	// active days = days where at least one note was edited
	const activeDays = new Map<string, number>(); // day -> count of edits
	const { metadataCache, vault } = app;

	const monthCreated = new Map<string, number>();
	const monthLabels = new Map<string, string>();

	let totalWords = 0;
	let totalWordsYear = 0;
	let tasksTotal = 0;
	let tasksDone = 0;
	let midnight = 0;
	let revived = 0;
	let journalStarts = 0; // daily notes created this year
	let journalWordsYear = 0;

	let longestNotePath = "";
	let longestWords = -1;
	let firstNotePath = "";
	let firstNoteTime = Infinity;
	let weirdestPath = "";
	let weirdestWords = Infinity;

	let outgoingLinksTotal = 0;
	const incomingByPath = new Map<string, number>();

	const resolvedLinks = metadataCache.resolvedLinks;
	for (const srcPath in resolvedLinks) {
		const links = resolvedLinks[srcPath];
		for (const destPath in links) {
			const n = links[destPath];
			incomingByPath.set(destPath, (incomingByPath.get(destPath) ?? 0) + n);
		}
	}

	await withConcurrency(files, 8, async (file: TFile) => {
		const cache = metadataCache.getFileCache(file);
		const stat = file.stat;
		const mtime = stat.mtime;
		// frontmatter → mtime → ctime (mtime beats ctime because copying a vault resets ctime on Linux)
		const ctime = resolvedCreatedTime(file, cache);

		const raw = await vault.cachedRead(file);
		const words = countWords(raw);
		const { total, done } = countTasks(raw);

		const outgoing = cache?.links?.length ?? 0;

		const baseName = file.basename;
		const mDay = dayKey(mtime);

		// Monthly creation buckets (by ctime)
		if (ctime >= yearStart && ctime < yearEndMs) {
			const d = new Date(ctime);
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
			monthCreated.set(key, (monthCreated.get(key) ?? 0) + 1);
			monthLabels.set(key, d.toLocaleString("en", { month: "short" }));
		}

		// Total + year words
		totalWords += words;
		const createdThisYear = ctime >= yearStart && ctime < yearEndMs;
		if (createdThisYear) {
			totalWordsYear += words;
		}

		// Tasks
		tasksTotal += total;
		tasksDone += done;

		// Edits: mtime
		activeDays.set(mDay, (activeDays.get(mDay) ?? 0) + 1);
		if (mtime >= yearStart && mtime < yearEndMs) {
			const h = hour(mtime);
			if (h < 5) midnight++;
			// revived note: created before this year, edited this year
			if (ctime < yearStart) revived++;
		}

		// Midnight creation (for journal flavor)
		if (ctime >= yearStart && ctime < yearEndMs && hour(ctime) < 5) {
			journalStarts++; // approximate: daily-note-style late creations
		}

		// Daily notes
		if (isDailyNote(baseName, settings.dailyNotesFolder, file.path)) {
			if (ctime >= yearStart && ctime < yearEndMs) {
				journalStarts++;
				journalWordsYear += words;
			}
		}

		// Longest / shortest
		if (words > longestWords) {
			longestWords = words;
			longestNotePath = file.path;
		}
		if (words < weirdestWords) {
			weirdestWords = words;
			weirdestPath = file.path;
		}
		if (ctime < firstNoteTime) {
			firstNoteTime = ctime;
			firstNotePath = file.path;
		}

		// Links
		outgoingLinksTotal += outgoing;
		const incoming = incomingByPath.get(file.path) ?? 0;

		const n: NoteStats = {
			path: file.path,
			basename: file.basename,
			ctime,
			mtime,
			words,
			tasksTotal: total,
			tasksDone: done,
			outgoingLinks: outgoing,
			incomingLinks: incoming,
		};
		notes.push(n);
	});

	// After scan — derived metrics
	const totalNotes = notes.length;
	const orphans = notes.filter((n) => n.outgoingLinks === 0 && n.incomingLinks === 0).length;

	// Writing streaks (edits)
	const sortedDays = [...activeDays.keys()].sort();
	let writingStreak = 0;
	{
		// last active day: if that equals today or yesterday, count backwards
		const lastActive = sortedDays[sortedDays.length - 1];
		if (lastActive) {
			const lastAct = new Date(lastActive + "T12:00:00").getTime();
			const now = Date.now();
			if (now - lastAct < 2 * DAY_MS) {
				const activeSet = new Set(sortedDays);
				let cur = lastAct;
				while (activeSet.has(dayKey(cur))) {
					writingStreak++;
					cur -= DAY_MS;
				}
			}
		}
	}

	// Longest break within the year
	let longestBreak = 0;
	{
		const yearDays = sortedDays.filter((k) => k >= dayKey(yearStart) && k <= dayKey(Date.now()));
		for (let i = 1; i < yearDays.length; i++) {
			const gap = (new Date(yearDays[i] + "T12:00:00").getTime() - new Date(yearDays[i - 1] + "T12:00:00").getTime()) / DAY_MS;
			if (gap - 1 > longestBreak) longestBreak = gap - 1;
		}
	}

	// Daily note streak: consecutive daily note files
	let dailyNoteStreak = 0;
	{
		const dailyKeys = notes
			.filter((n) => isDailyNote(n.basename, settings.dailyNotesFolder, n.path))
			.map((n) => dayKey(n.ctime))
			.filter((k) => k >= dayKey(yearStart));

		let max = 0;
		let run = 0;
		let prevDay: number | null = null;
		const sortedDaily = [...dailyKeys].sort();
		for (const k of sortedDaily) {
			const t = new Date(k + "T12:00:00").getTime();
			if (prevDay !== null && (t - prevDay) / DAY_MS === 1) run++;
			else run = 1;
			if (run > max) max = run;
			prevDay = t;
		}
		dailyNoteStreak = max;
	}

	// Monthly buckets formatted
	const monthlyCreated: MonthlyBucket[] = [...monthCreated.keys()]
		.sort()
		.map((k) => ({ month: k, label: monthLabels.get(k) ?? k.slice(5), count: monthCreated.get(k) ?? 0 }));

	// Busiest month
	let busiestMonth = "";
	let busiestCount = 0;
	for (const b of monthlyCreated) {
		if (b.count > busiestCount) {
			busiestCount = b.count;
			busiestMonth = b.month;
		}
	}
	const busiestMonthName = busiestMonth ? new Date(busiestMonth + "-01T12:00:00").toLocaleString("en", { month: "long" }) : "—";

	// Active days per weekday
	const weekdayCounts = new Map<number, number>();
	for (const k of sortedDays) {
		const d = new Date(k + "T12:00:00").getDay();
		weekdayCounts.set(d, (weekdayCounts.get(d) ?? 0) + 1);
	}
	let busiestDow = "";
	let busiestDowCount = 0;
	const dowNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	for (const [d, c] of weekdayCounts) {
		if (c > busiestDowCount) {
			busiestDowCount = c;
			busiestDow = dowNames[d];
		}
	}

	// Most influential notes (backlinks)
	const influential: TopNote[] = notes
		.filter((n) => n.incomingLinks > 0)
		.sort((a, b) => b.incomingLinks - a.incomingLinks)
		.slice(0, 5)
		.map((n) => ({ path: n.path, basename: n.basename, value: n.incomingLinks }));

	// Hub notes (outgoing links)
	const hubs: TopNote[] = notes
		.filter((n) => n.outgoingLinks > 0)
		.sort((a, b) => b.outgoingLinks - a.outgoingLinks)
		.slice(0, 5)
		.map((n) => ({ path: n.path, basename: n.basename, value: n.outgoingLinks }));

	const notesWithLinks = notes.filter((n) => n.outgoingLinks > 0).length;
	const linkDensity = totalNotes ? outgoingLinksTotal / totalNotes : 0;

	const avgWordsPerNote = totalNotes ? totalWords / totalNotes : 0;
	const totalNotesCreatedYear = monthCreated.size
		? monthlyCreated.reduce((s, b) => s + b.count, 0)
		: notes.filter((n) => n.ctime >= yearStart && n.ctime < yearEndMs).length;
	const wordsPerNoteYear = totalNotesCreatedYear ? totalWordsYear / totalNotesCreatedYear : 0;
	const tasksCreated = tasksTotal;
	const tasksCompleted = tasksDone;
	const taskCompletionRate = tasksTotal ? (tasksDone / tasksTotal) * 100 : 0;
	const tasksAbandoned = tasksTotal - tasksDone;

	const lastActiveMs = sortedDays.length ? new Date(sortedDays[sortedDays.length - 1] + "T12:00:00").getTime() : Date.now();
	const existedDays = firstNoteTime !== Infinity ? Math.max(1, Math.round((Date.now() - firstNoteTime) / DAY_MS)) : 1;

	// Pack summary
	const data: WrappedData = {
		year,
		vaultName: vault.getName(),
		archetype: "balanced",
		totalNotesAllTime: totalNotes,
		totalNotesCreatedYear,
		totalWordsAll: totalWords,
		totalWordsYear,
		avgWordsPerNote,
		wordsPerNoteYear: Math.round(wordsPerNoteYear),
		longestNote: { path: longestNotePath, basename: longestNotePath.split("/").pop()?.replace(/\.md$/, "") ?? "", value: longestWords },
		longestWordCount: longestWords,
		firstNote: firstNotePath ? { path: firstNotePath, date: firstNoteTime } : null,
		monthlyCreated,
		busiestMonth,
		busiestDayOfWeek: busiestDow,
		perDay: Math.round((totalNotesCreatedYear / 365) * 10) / 10,
		writingStreak,
		longestBreak,
		midnightWrites: midnight,
		revivedNotes: revived,
		mostInfluential: influential,
		mostEdited: [],
		orphans,
		orphanStats: { count: orphans, pct: totalNotes ? Math.round((orphans / totalNotes) * 100) : 0 },
		linkDensity: Math.round(linkDensity * 10) / 10,
		dailyNoteStreak,
		journalEntriesYear: journalStarts,
		journalWordsYear,
		tasksCreated,
		tasksCompleted,
		taskCompletionRate: Math.round(taskCompletionRate * 10) / 10,
		tasksAbandoned,
		notesWithLinks,
		notesWithLinksPct: totalNotes ? Math.round((notesWithLinks / totalNotes) * 100) : 0,
		hubNotes: hubs,
		weirdestNote: `${weirdestWords} words`,
		weirdestPath,
		mostActiveDayOfWeek: busiestDow,
		mostActiveMonthName: busiestMonthName,
		lastActive: lastActiveMs,
		existedDays,
		embarrassing: "",
	};

	return data;
}