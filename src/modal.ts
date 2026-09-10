import { App, Modal, Notice } from "obsidian";
import { WrappedCard } from "./cards";
import { exportCardToPng } from "./export";
import { WrappedSettings } from "./types";

export class WrappedModal extends Modal {
	private cards: WrappedCard[];
	private settings: WrappedSettings;

	constructor(app: App, cards: WrappedCard[], settings: WrappedSettings) {
		super(app);
		this.cards = cards;
		this.settings = settings;
		this.modalEl.addClass("ow-modal");
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("div", { cls: "ow-modal-header" });

		const header = contentEl.querySelector(".ow-modal-header") as HTMLElement;
		header.createEl("span", { text: "Your Year in Notes", cls: "ow-modal-title" });
		const saveAllBtn = header.createEl("button", { text: "Save all as images", cls: "mod-cta" });
		saveAllBtn.addEventListener("click", () => this.saveAll());

		const cardsContainer = contentEl.createDiv({ cls: "ow-cards" });

		this.cards.forEach((card) => {
			const wrap = cardsContainer.createDiv({ cls: "ow-card-wrap" });
			const toolbar = wrap.createDiv({ cls: "ow-card-toolbar" });
			toolbar.createEl("span", { text: card.title });
			const btn = toolbar.createEl("button", { text: "Save as PNG", cls: "ow-save-btn" });
			btn.addEventListener("click", () => this.saveCard(card, wrap));

			const node = wrap.createDiv({ cls: "ow-card-dom" });
			node.innerHTML = card.html;
		});
	}

	async saveCard(card: WrappedCard, wrap: HTMLElement) {
		const dom = wrap.querySelector(".ow-card-dom") as HTMLElement;
		if (!dom) return;
		const saveBtn = wrap.querySelector(".ow-save-btn") as HTMLButtonElement;
		const original = saveBtn.innerText;
		saveBtn.innerText = "Exporting…";
		saveBtn.disabled = true;
		try {
			await exportCardToPng(this.app, dom, this.settings.saveFolder, card.title);
			new Notice(`Saved ${card.title}.png`);
		} catch (e) {
			new Notice(`Export failed: ${e}`);
		} finally {
			saveBtn.innerText = original;
			saveBtn.disabled = false;
		}
	}

	async saveAll() {
		const buttons = Array.from(this.contentEl.querySelectorAll<HTMLButtonElement>(".ow-save-btn"));
		for (const b of buttons) b.disabled = true;

		// Create progress bar
		const header = this.contentEl.querySelector(".ow-modal-header") as HTMLElement;
		const progressWrap = header.createDiv({ cls: "ow-progress-wrap" });
		const progressBar = progressWrap.createDiv({ cls: "ow-progress-bar" });
		const progressLabel = progressWrap.createEl("span", { text: "0 / 0", cls: "ow-progress-label" });

		const doms = Array.from(this.contentEl.querySelectorAll<HTMLElement>(".ow-card-dom"));
		const total = doms.length;
		let count = 0;

		try {
			for (const dom of doms) {
				const card = this.cards[doms.indexOf(dom)];
				if (!card) continue;
				progressLabel.setText(`${count + 1} / ${total}`);
				await exportCardToPng(this.app, dom, this.settings.saveFolder, card.title);
				count++;
				const pct = Math.round((count / total) * 100);
				progressBar.style.width = `${pct}%`;
			}
		} catch (e) {
			new Notice(`Export failed: ${e}`);
		}
		new Notice(`Saved ${count} cards to ${this.settings.saveFolder}/`);
		progressWrap.remove();
		for (const b of buttons) b.disabled = false;
	}

	onClose() {
		this.contentEl.empty();
	}
}