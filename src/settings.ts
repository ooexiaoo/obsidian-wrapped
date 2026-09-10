import { App, Plugin, PluginSettingTab, Setting, type SettingDefinitionItem } from "obsidian";
import { WrappedSettings } from "./types";

export interface WrappedPluginLike {
	settings: WrappedSettings;
	saveSettings: () => Promise<void>;
}

export class WrappedSettingTab extends PluginSettingTab {
	private plugin: WrappedPluginLike;

	constructor(app: App, plugin: WrappedPluginLike) {
		super(app, plugin as unknown as Plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Wrapped year")
			.setDesc("Which year to report on.")
			.addText((text) =>
				text
					.setPlaceholder(String(new Date().getFullYear()))
					.setValue(String(this.plugin.settings.year))
					.onChange(async (value) => {
						const year = parseInt(value, 10);
						if (!isNaN(year) && year > 2000 && year <= new Date().getFullYear() + 1) {
							this.plugin.settings.year = year;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Save folder")
			.setDesc("Where exported PNG cards are stored.")
			.addText((text) =>
				text.setValue(this.plugin.settings.saveFolder).onChange(async (value) => {
					this.plugin.settings.saveFolder = value.trim() || "Wrapped";
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Daily notes folder")
			.setDesc("Optional. If set, daily notes below this folder count as journal entries.")
			.addText((text) =>
				text.setValue(this.plugin.settings.dailyNotesFolder).onChange(async (value) => {
					this.plugin.settings.dailyNotesFolder = value.trim();
					await this.plugin.saveSettings();
				})
			);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const s = this.plugin.settings;
		return [
			{
				name: "Wrapped year",
				desc: "Which year to report on.",
				control: {
					type: "text",
					key: "year" as keyof WrappedSettings,
					placeholder: String(new Date().getFullYear()),
				},
			},
			{
				name: "Save folder",
				desc: "Where exported PNG cards are stored.",
				control: {
					type: "text",
					key: "saveFolder" as keyof WrappedSettings,
				},
			},
			{
				name: "Daily notes folder",
				desc: "Optional. If set, daily notes below this folder count as journal entries.",
				control: {
					type: "text",
					key: "dailyNotesFolder" as keyof WrappedSettings,
				},
			},
		];
	}

	getControlValue(key: string): unknown {
		return (this.plugin.settings as unknown as Record<string, unknown>)[key];
	}

	setControlValue(key: string, value: unknown): void {
		(this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
		void this.plugin.saveSettings();
	}
}
