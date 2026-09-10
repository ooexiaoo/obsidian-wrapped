import { Notice, Plugin } from "obsidian";
import { embarrassingStat, personalityFor, scoreArchetypes } from "./archetype";
import { buildCards } from "./cards";
import { computeWrapped } from "./metrics";
import { WrappedModal } from "./modal";
import { WrappedSettingTab } from "./settings";
import { DEFAULT_SETTINGS, WrappedSettings } from "./types";

export default class ObsidianWrapped extends Plugin {
	settings: WrappedSettings;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon("calendar-heart", "Wrapped", () => {
			void this.generateWrapped();
		});

		this.addCommand({
			id: "generate",
			name: "Generate",
			callback: () => {
				void this.generateWrapped();
			},
		});

		this.addSettingTab(new WrappedSettingTab(this.app, this));
	}

	async generateWrapped() {
		const status = new Notice("Scanning your vault…", 0);
		try {
			const data = await computeWrapped(this.app, this.settings);
			const score = scoreArchetypes(data);
			const personality = personalityFor(data, score);
			data.archetype = personality.archetype;
			data.embarrassing = embarrassingStat(data);

			const cards = buildCards(data, personality, this.settings);
			status.hide();

			new WrappedModal(this.app, cards, this.settings).open();
		} catch (e) {
			status.hide();
			console.error(e);
			new Notice(`Wrapped failed: ${e}`);
		}
	}

	async loadSettings() {
		const loaded = (await this.loadData()) as Partial<WrappedSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded ?? {});
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}