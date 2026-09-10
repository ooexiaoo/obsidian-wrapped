export interface NoteStats {
	path: string;
	basename: string;
	ctime: number; // ms timestamp
	mtime: number;
	words: number;
	tasksTotal: number;
	tasksDone: number;
	outgoingLinks: number;
	incomingLinks: number;
}

export type Archetype = "journal" | "tasks" | "zettelkasten" | "collector" | "balanced";

export interface Personality {
	label: string;
	emoji: string;
	description: string;
	archetype: Archetype;
}

export interface MonthlyBucket {
	month: string; // "2026-01"
	label: string; // "Jan"
	count: number;
}

export interface MonthlyLatency {
	month: string;
	label: string;
	days: number; // days in month
	share: number; // created-note keyword count normalized 0..1
}

export interface TopNote {
	path: string;
	basename: string;
	value: number;
}

export interface WrappedData {
	year: number;
	vaultName: string;
	archetype: Archetype;

	totalNotesAllTime: number;
	totalNotesCreatedYear: number;
	totalWordsAll: number;
	totalWordsYear: number;
	avgWordsPerNote: number;
	wordsPerNoteYear: number;
	longestNote: TopNote;
	longestWordCount: number;
	firstNote: { path: string; date: number } | null;

	monthlyCreated: MonthlyBucket[];
	busiestMonth: string;
	busiestDayOfWeek: string;
	perDay: number;

	writingStreak: number; // consecutive days with at least one edit
	longestBreak: number; // consecutive days with no edits (gaps)
	midnightWrites: number; // edits between 00:00-04:59
	revivedNotes: number; // notes created before the year, edited during it

	mostInfluential: TopNote[]; // top backlinked notes
	mostEdited: TopNote[]; // most edited notes (mtime vs ctime spread approximated via links? fallback: created count)
	orphans: number;
	orphanStats: { count: number; pct: number };
	linkDensity: number; // avg outgoing links per note

	// Journal archetype
	dailyNoteStreak: number;
	journalEntriesYear: number;
	journalWordsYear: number;

	// Task archetype
	tasksCreated: number;
	tasksCompleted: number;
	taskCompletionRate: number;
	tasksAbandoned: number;

	// Zettelkasten
	notesWithLinks: number;
	notesWithLinksPct: number;
	hubNotes: TopNote[];

	// Entertaining bits
	weirdestNote: string; // shortest note
	weirdestPath: string;
	mostActiveDayOfWeek: string;
	mostActiveMonthName: string;
	lastActive: number; // ms
	existedDays: number; // days since first note

	embarrassing: string;
}

export interface WrappedSettings {
	year: number;
	saveFolder: string;
	dailyNotesFolder: string;
	darkTheme: boolean;
}

export const DEFAULT_SETTINGS: WrappedSettings = {
	year: new Date().getFullYear(),
	saveFolder: "Wrapped",
	dailyNotesFolder: "",
	darkTheme: true,
};