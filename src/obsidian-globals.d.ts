/* Ambient declarations for Obsidian runtime globals (not exported from "obsidian" npm). */
declare function createDiv(o?: import("obsidian").DomElementInfo | string, callback?: (el: HTMLDivElement) => void): HTMLDivElement;
declare function createSpan(o?: import("obsidian").DomElementInfo | string, callback?: (el: HTMLSpanElement) => void): HTMLSpanElement;
declare function createEl<K extends keyof HTMLElementTagNameMap>(tag: K, o?: import("obsidian").DomElementInfo | string, callback?: (el: HTMLElementTagNameMap[K]) => void): HTMLElementTagNameMap[K];
declare function createFragment(callback?: (el: DocumentFragment) => void): DocumentFragment;
