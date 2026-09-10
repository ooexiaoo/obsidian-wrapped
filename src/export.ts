import { App } from "obsidian";
import { toPng } from "html-to-image";

export async function exportCardToPng(
	app: App,
	element: HTMLElement,
	rootFolder: string,
	filename: string
): Promise<string> {
	await document.fonts.ready;
	await new Promise((r) => window.setTimeout(r, 200));

	const dataUrl = await toPng(element, {
		cacheBust: true,
		pixelRatio: 1,
	});

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