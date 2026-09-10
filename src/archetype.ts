import { Archetype, Personality, WrappedData } from "./types";

export interface ArchetypeScore {
	archetype: Archetype;
	scores: Record<Archetype, number>;
}

export function scoreArchetypes(data: WrappedData): ArchetypeScore {
	const notesYear = Math.max(1, data.totalNotesCreatedYear);

	const journalRatio = data.journalEntriesYear / notesYear;
	let journal = journalRatio * 3 + Math.min(1, data.dailyNoteStreak / 30) * 2;
	if (data.midnightWrites > 0) journal += Math.min(1, data.midnightWrites / 50);

	const taskActivity = Math.min(1, data.tasksCreated / 150);
	let tasks = taskActivity * 3;
	if (data.tasksCreated > 20) tasks += data.taskCompletionRate / 100;

	const zettel = data.linkDensity * 2.5 + (1 - data.orphanStats.pct / 100) * 1.5;

	const shallow = 1 - Math.min(1, data.avgWordsPerNote / 250);
	const collector = (data.orphanStats.pct / 100) * 2 + shallow * 2 - Math.min(1, data.totalNotesAllTime / 2000);

	const scores: Record<Archetype, number> = {
		journal,
		tasks,
		zettelkasten: zettel,
		collector,
		balanced: 0.5,
	};

	let archetype: Archetype = "balanced";
	let best = -1;
	for (const key in scores) {
		const k = key as Archetype;
		if (scores[k] > best) {
			best = scores[k];
			archetype = k;
		}
	}

	// Fallback: if nothing meaningful stands out, keep balanced
	if (best < 1.2) archetype = "balanced";

	return { archetype, scores };
}

export function personalityFor(data: WrappedData, score: ArchetypeScore): Personality {
	const a = score.archetype;
	const completion = data.taskCompletionRate;

	switch (a) {
		case "journal":
			if (data.midnightWrites > 20) {
				return {
					archetype: a,
					label: "The Night Owl Journaler",
					emoji: "🌙",
					description: `You poured ${data.journalWordsYear.toLocaleString()} words into ${data.journalEntriesYear} daily entries${data.midnightWrites > 50 ? " — most of them after midnight." : " this year."}`,
				};
			}
			return {
				archetype: a,
				label: "The Steadfast Journaler",
				emoji: "📔",
				description: `Daily notes are your ritual — a ${data.dailyNoteStreak}-day streak and ${data.journalWordsYear.toLocaleString()} words logged this year.`,
			};
		case "tasks":
			if (completion >= 80) {
				return {
					archetype: a,
label: "The Taskmaster",
				emoji: "🎯",
					description: `${data.tasksCompleted} of ${data.tasksCreated} tasks completed (${completion}%). Nothing escapes your list.`,
				};
			}
			return {
				archetype: a,
				label: "The Optimistic Planner",
				emoji: "📝",
				description: `${data.tasksCreated} tasks created, ${data.tasksCompleted} completed. The list is a vision, not a ledger.`,
			};
		case "zettelkasten":
			return {
				archetype: a,
				label: "The Zettelkasten Architect",
				emoji: "🕸️",
				description: `${Math.round(data.linkDensity * 10) / 10} links per note and a web of ${data.notesWithLinks} connected ideas. Your brain has a floor plan.`,
			};
		case "collector":
			return {
				archetype: a,
				label: "The Collector",
				emoji: "📚",
				description: `${data.totalNotesCreatedYear} notes created, ${data.orphans} still untouched by a single link. Gathering is also a form of thinking.`,
			};
		default:
			if (data.totalNotesAllTime > 0 && data.avgWordsPerNote > 400) {
				return {
					archetype: a,
					label: "The Deep Thinker",
					emoji: "🧠",
					description: `Fewer notes, but ${Math.round(data.avgWordsPerNote)} words deep each. You build cathedrals, not parking lots.`,
				};
			}
			return {
				archetype: a,
				label: "The Balanced Scribe",
				emoji: "⚖️",
				description: `${data.totalNotesAllTime} notes, comfortable streaks, a bit of everything. Consistency over drama.`,
			};
	}
}

export function embarrassingStat(data: WrappedData): string {
	const candidates: string[] = [];

	if (data.orphans > 0) {
		candidates.push(`You have ${data.orphans} orphan notes (${data.orphanStats.pct}%) that no other note links to. They are very, very alone.`);
	}
	if (data.tasksCreated > 30 && data.taskCompletionRate < 60) {
		candidates.push(`You created ${data.tasksCreated} tasks but only ${data.tasksCompleted} were completed (${data.taskCompletionRate}%). The abandoned ones are still waiting in the dark.`);
	}
	if (data.longestBreak > 30) {
		candidates.push(`After ${data.totalNotesCreatedYear} creations this year, you once went ${data.longestBreak} days without touching a note. Silence is also content.`);
	}
	if (data.midnightWrites > 30) {
		candidates.push(`${data.midnightWrites} edits happened between midnight and 5AM. Question: does the bed stay cold, or does the note?`);
	}
	if (data.totalNotesCreatedYear === 0) {
		candidates.push(`Zero new notes this year. The vault is a museum now, and you donated the curator.`);
	}
	if (data.weirdestPath) {
		candidates.push(`Your lightest note is ${data.weirdestNote} — "${data.weirdestPath.split("/").pop()}". Even a Post-it feels guilty sometimes.`);
	}
	if (candidates.length === 0) {
		candidates.push(`Statistically impeccable year. Either you're perfect, or the vault didn't want us to know.`);
	}
	// Pick: prefer task-shame, then orphans, then the rest for variety
	return candidates[0];
}