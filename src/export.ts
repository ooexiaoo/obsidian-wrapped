import { App } from "obsidian";
import html2canvas from "html2canvas-pro";

/** Recursively inline computed styles on an element and its children so html2canvas can read them. */
function inlineStyles(element: HTMLElement) {
	const computed = getComputedStyle(element);
	const important = [
		"font-family", "font-size", "font-weight", "line-height", "letter-spacing",
		"color", "background-color", "background",
		"border", "border-radius", "padding", "margin",
		"display", "flex-direction", "align-items", "justify-content", "gap",
		"width", "height", "min-width", "min-height",
		"flex", "flex-basis", "flex-grow", "flex-shrink",
		"text-align", "white-space", "overflow", "text-overflow",
		"box-sizing", "position",
	];
	for (const prop of important) {
		const val = computed.getPropertyValue(prop);
		if (val) element.style.setProperty(prop, val);
	}
	// Resolve any remaining CSS custom properties
	for (const prop of ["background-image", "background"]) {
		const val = element.style.getPropertyValue(prop);
		if (val && val.includes("var(")) {
			element.style.setProperty(prop, computed.getPropertyValue(prop));
		}
	}
	for (const child of Array.from(element.children) as HTMLElement[]) {
		inlineStyles(child);
	}
}

export async function exportCardToPng(
	app: App,
	element: HTMLElement,
	rootFolder: string,
	filename: string
): Promise<string> {
	// Wait for fonts to load
	await document.fonts.ready;
	await new Promise((r) => setTimeout(r, 200));

	// Clone, inline styles, and render
	const clone = element.cloneNode(true) as HTMLElement;
	inlineStyles(clone);
	clone.style.width = "800px";
	clone.style.position = "fixed";
	clone.style.left = "0";
	clone.style.top = "0";
	clone.style.zIndex = "-1";
	clone.style.opacity = "1";
	document.body.appendChild(clone);

	// Let layout settle
	await new Promise((r) => setTimeout(r, 100));

	const canvas = await html2canvas(clone, {
		backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
		scale: 2,
		useCORS: true,
		logging: false,
		width: 800,
		windowWidth: 800,
	});

	clone.remove();

	const dataUrl = canvas.toDataURL("image/png");
	const path = `${rootFolder}/${filename}.png`;
	try {
		await app.vault.createFolder(rootFolder);
	} catch {
		// folder already exists
	}
	await app.vault.adapter.writeBinary(path, dataUrlToArrayBuffer(dataUrl));
	return path;
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
	const base64 = dataUrl.substring(dataUrl.indexOf(",") + 1);
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}