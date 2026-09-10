# Obsidian Wrapped

A Spotify Wrapped-style look at your year in Obsidian. Scan your vault and generate shareable wrapped cards showing your writing stats, rhythm, and personality.

## Features

- **Vault scanning** with accurate date resolution (frontmatter → mtime → ctime)
- **Archetype detection** — Journaler, Taskmaster, Zettelkasten Architect, Collector, Balanced
- **8 shareable card types** with Obsidian theme integration
- **PNG export** for sharing on social media
- **Progress bar** for batch export

## Cards

1. **Cover** — Your archetype emoji, personality badge, and year
2. **Stats** — Notes created, words written, words per note, notes per day
3. **Monthly** — Bar chart of notes created each month
4. **Rhythm** — Writing streaks and active days
5. **Influential** — Top linked notes and recent popular notes
6. **Archetype** — Personality-specific card with detailed stats
7. **Embarrassing** — One humorous stat about your vault
8. **Fun facts** — Random interesting observations

## Installation

### Manual

1. Download `main.js`, `manifest.json`, `styles.css`, and `versions.json` from the [latest release](https://github.com/ooexiaoo/obsidian-wrapped/releases/latest)
2. Create a folder `.obsidian/plugins/obsidian-wrapped/` in your vault
3. Place the downloaded files in that folder
4. Enable "Obsidian Wrapped" in Settings → Community plugins

### From Community Plugins

1. Open Settings → Community plugins → Browse
2. Search for "Obsidian Wrapped"
3. Install and enable

## Usage

1. Open the command palette (Ctrl/Cmd + P)
2. Type "Generate wrapped" and select the command
3. Browse your wrapped cards
4. Click "Save as PNG" on individual cards or "Save all as images" to export

## Settings

- **Year** — Which year to analyze (default: current year)
- **Save folder** — Where to save exported PNGs (default: Wrapped)
- **Daily notes folder** — Path to your daily notes folder for journal detection

## Date Resolution

The plugin resolves note creation dates using this priority:
1. Frontmatter date fields (`created`, `date`, `date_created`, `created_at`, `creation_date`)
2. File modification time (mtime)
3. File system change time (ctime)

This ensures accurate dates even if your vault was copied or moved.

## Development

```bash
npm install
npm run build
```

To test locally, copy `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/obsidian-wrapped/` folder.

## License

MIT