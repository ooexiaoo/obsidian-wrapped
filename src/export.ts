import { App } from "obsidian";
import html2canvas from "html2canvas-pro";

export async function exportCardToPng(
	app: App,
	element: HTMLElement,
	rootFolder: string,
	filename: string
): Promise<string> {
	// Wait for fonts to load before rendering
	await document.fonts.ready;
	// Small delay for font rendering to settle
	await new Promise((r) => setTimeout(r, 100));

	const canvas = await html2canvas(element, {
		backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
		scale: 2,
		useCORS: true,
		logging: false,
		windowWidth: 900,
	});
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