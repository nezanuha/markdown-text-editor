# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2026-06-16

### Added

- **Keyboard shortcuts**: Common formatting actions can now be triggered from the keyboard — `Ctrl+B` (Bold), `Ctrl+I` (Italic), `Ctrl+K` (Link), `Ctrl+\`` (inline Code), `Ctrl+Shift+S` (Strikethrough). Each shortcut is displayed in the corresponding toolbar button's tooltip
- **Find & Replace**: Press `Ctrl+F` to open a find panel or `Ctrl+H` to open find & replace. Case-insensitive search with a live match counter, next/prev navigation, single replace, and replace all. The panel floats in the top-right corner of the editor and closes with `Escape`
- **`onChange` option**: Pass an `onChange(value)` callback to be notified on every keystroke from the user
- **`footer.words` option**: New opt-in word count stat in the status bar. Set `footer: { words: true }` to enable it alongside the existing line, column, and character stats
- **`minHeight` option**: Minimum height in pixels the editor will shrink to when content is short. Defaults to `200`. Pairs with the existing `maxHeight` option to define the full auto-grow range
- **`destroy()` method**: Removes the editor DOM wrapper, restores the original `<textarea>` to its position in the document, and cleans up internal event listeners. Useful in single-page applications when unmounting a view

## [1.2.0] - 2026-05-14

### Added

- **Auto-grow editor**: The editor now expands vertically as content grows in non-fullscreen mode. A scrollbar appears only once content exceeds the maximum height, which defaults to 500px and can be overridden via the maxHeight option
- **Resize handle**: The editor has a drag handle at the bottom corner so users can manually resize it taller or shorter
- **Escape key exits fullscreen**: Pressing Escape while in fullscreen preview mode now exits back to the normal editor view
- **XSS sanitization**: Preview output is now sanitized via [DOMPurify](https://github.com/cure53/DOMPurify) before being rendered — prevents script injection through crafted markdown input

### Fixed

- **Fullscreen layout with long content**: Scrolling in fullscreen preview mode no longer breaks with very long text — the editor and preview panels are correctly bounded to the viewport height ([#29](https://github.com/nezanuha/markdown-text-editor/issues/29))
- **Crawlable links**: Replaced anchor elements without href in the heading dropdown with button elements — fixes the Links are not crawlable PageSpeed audit
- **Accessibility**: Added proper menu role attributes and labels to the heading popover for correct screen reader semantics

### Changed

- **devDependencies:** Updated frutjam to 2.1.1
- **devDependencies:** Updated vite to 8.0.12
- **dependencies:** Added dompurify 3.4.3

## [1.1.5] - 2026-05-11

### Changed

- Renamed internal CSS class `textarea` to `editor-textarea` to avoid conflicts with third-party stylesheets targeting generic class names
- Added `font: inherit` reset to `.editor-textarea` so the editor inherits the page font instead of defaulting to the browser's monospace fallback

## [1.1.4] - 2026-05-10

### Changed

- **devDependencies:** Updated `frutjam` to 2.0.4

## [1.1.3] - 2026-05-10

### Added

- Added `iife` build format output as `dist/markdown-text-editor.min.js` for direct CDN `<script src>` use — no module bundler required
- Added `jsdelivr`, `unpkg`, and updated `browser` fields in `package.json` to point to the IIFE build, so bare CDN URLs (without a file path) automatically serve the correct file

## [1.1.2] - 2026-05-10

### Added

- **Theme inheritance**: The editor now automatically inherits `data-theme` from the nearest ancestor element at initialisation via `closest('[data-theme]')`. Placing `data-theme="dark"` on `<html>`, `<body>`, or any parent container correctly themes the editor with zero runtime overhead — no observers, no polling
- **`theme` option**: Pass `theme: 'dark'` (or any frutjam theme name) in the options object to explicitly set the editor's theme, overriding ancestor inheritance

### Fixed

- **Theme `light-dark()` derived colors**: `--lightningcss-light` / `--lightningcss-dark` polyfill variables are now correctly scoped to each `data-theme` value, so soft and active color variants switch correctly when the theme is set via `data-theme` on the wrapper or an ancestor — not just via `prefers-color-scheme`
- **Toolbar and footer prose isolation**: Added `not-prose` to the toolbar and footer elements to prevent `@tailwindcss/typography` styles from leaking into the toolbar icons and status bar when the editor is placed inside a `prose`-classed container

### Changed

- Removed the separate `style` export and `./dist/markdown-text-editor.css` package export — CSS has been injected by JS since v1.1.0 and no standalone stylesheet exists
- Updated `frutjam` to 2.0.2
- **Docs**: Added theming section documenting all three ways to set the theme (`theme` option, `data-theme` on the `<textarea>`, `data-theme` on any ancestor) with priority order and examples
- **Docs**: Added CSS variables reference table so users can build custom themes by overriding `--color-base`, `--color-primary`, `--border-radius`, and other design tokens scoped to `.markdown-editor-wrapper`

## [1.1.1] - 2026-05-09

### Changed

- Updated dev dependencies: `tailwindcss`, `@tailwindcss/postcss`, and `@tailwindcss/vite` to 4.3.0; `frutjam` to 2.0.1

## [1.1.0] - 2026-05-08

### Added

- **`footer` option**: New status bar displayed below the editor showing the cursor's line number, column number, and total character count — all updated in real time. Visible by default; set `footer: false` to hide entirely, or pass `footer: { line: false, col: false, chars: false }` to toggle individual stats
- **`code` tool**: New inline code tool — wraps selected text (or inserts a `code` placeholder) in single backticks; clicking a second time removes the backticks
- **`codeblock` tool**: New fenced code block tool — inserts a triple-backtick block around selected text (or a `code` placeholder); clicking on an existing fenced block removes the fences
- **`hr` tool**: New horizontal rule tool — inserts a `---` divider at the cursor position on its own line
- **`table` tool**: New table tool — inserts a starter 2×3 markdown table template at the cursor position
- **`heading` tool**: Replaced the hidden cycle-through-H1–H6 click behaviour with a popover dropdown — users can now explicitly pick H1–H6 from a visible menu; selecting the same level a second time removes the heading, restoring plain text
- **Docs**: Corrected get/set content section — removed non-existent `editor.value` API and replaced with the correct native DOM approach; fixed wrong `altInput` comment, filled empty `mode: 'hybrid'` description, added `params` to `fileInput` docs, updated `heading` tool description to reflect the new dropdown
- The editor now works out of the box via CDN, npm, or any bundler (Vite, webpack, Rollup) with no extra configuration
- **CSS auto-injection**: CSS is now bundled into the JavaScript output via `vite-plugin-css-injected-by-js`. A single `import MarkdownEditor from 'markdown-text-editor'` is all that is needed — no separate stylesheet import or `<link>` tag required
- **Accessibility**: The toolbar now has a proper `role="toolbar"` landmark and `aria-label` so screen readers can identify and navigate it
- **Accessibility**: The preview pane is now a `role="region"` landmark labelled "Preview"
- **Accessibility**: The editor textarea is automatically given `aria-label="Markdown editor"` when no label is associated, ensuring it always has an accessible name
- **Accessibility**: The Link and Image modals are now announced with their name ("Link" / "Image") by screen readers via `aria-label` on the `<dialog>` element
- **`preview`**: Checkboxes in the preview pane are now clickable — toggling them updates the markdown source instantly without leaving preview mode ([#27](https://github.com/nezanuha/markdown-text-editor/discussions/27))

### Fixed

- **Accessibility**: All toolbar SVG icons are now marked `aria-hidden` so screen readers use the button label instead of the raw SVG path data
- **Accessibility**: The preview toggle button now exposes its on/off state via `aria-pressed`
- **Accessibility**: Toolbar buttons are now marked `aria-disabled` when preview is active, not just visually dimmed
- **Accessibility**: The modal close button has an `aria-label="Close"` and now uses the native `dialog.close()` so focus is correctly returned to the triggering button when dismissed
- **`bold` / `italic` / `strikethrough` / `blockquote` / `ul` / `ol` / `checklist` tools**: Clicking a tool a second time now correctly removes the syntax markers — each tool now checks the characters surrounding the selection in the textarea, not just the selected text itself, so toggling off works even when only the placeholder text is selected
- **`bold` / `italic` / `strikethrough` / `blockquote` tools**: Clicking a tool with no text selected now selects only the placeholder text, not the surrounding syntax markers — consistent with the list tools fix. For inline tools (`bold`, `italic`, `strikethrough`), the trailing closing markers are also excluded from the selection (e.g. selects `Bold text`, not `Bold text**`)
- **`strikethrough` tool**: Now correctly inserts `~~double tildes~~` instead of `~single~`, matching the standard markdown spec and rendering correctly in the preview pane
- **`indent` / `outdent`**: Pressing Tab no longer triggers two renders — the duplicate internal `_triggerUpdate()` call has been removed
- **`indent` / `outdent`**: Clicking the toolbar buttons in hybrid mode now correctly refreshes the display layer — the styled text now shifts immediately instead of staying stale until the next keystroke
- **`lists` + `indent`**: Pressing Enter on an indented list item no longer inserts a double newline — the indent manager now defers to the list manager for all list continuation
- **Performance**: `scrollToView` now caches the computed line height instead of recalculating it on every toolbar insert
- **`bold` / `italic` tools**: Applying italic to bold text (or vice versa) now correctly produces bold+italic (`***text***`) instead of overwriting the existing style ([#22](https://github.com/nezanuha/markdown-text-editor/issues/22))
- **Style conflicts with other CSS frameworks**: The editor's styles no longer bleed into Bootstrap, Tailwind, or any other framework on the same page. All editor styles are now fully scoped to the `.markdown-editor-wrapper` element — made possible by the new scoping capabilities introduced in [frutjam v2](https://github.com/nezanuha/frutjam) ([#26](https://github.com/nezanuha/markdown-text-editor/discussions/26))
- **Tailwind preflight leak**: Replaced `@import "tailwindcss"` with `@import "tailwindcss/theme"` + `@import "tailwindcss/utilities"` to exclude Tailwind's base/preflight layer — preventing global element resets (`h1`–`h6`, `a`, `button`, etc.) from bleeding into the host page
- **`image tool`**: Upload error no longer throws an uncaught exception when the server returns an unexpected response
- **`preview tool`**: Toggling preview on a page with multiple editor instances no longer disables toolbar buttons in all other instances
- **`lists`**: Clicking a list toolbar button (UL, OL, checklist) now selects only the placeholder text, not the marker prefix ([#24](https://github.com/nezanuha/markdown-text-editor/issues/24))
- **`lists`**: Pressing Enter to continue a list no longer selects the newly inserted marker — the cursor lands ready to type ([#25](https://github.com/nezanuha/markdown-text-editor/issues/25))
- **`checklist`**: Pressing Enter after a checklist item now correctly continues with `- [ ] ` instead of just `- ` ([#23](https://github.com/nezanuha/markdown-text-editor/issues/23))

## [1.0.1] - 2026-02-21

### Fixed

- Fix bug where selected text becomes invisible in textarea when plain mode is enabled

## [1.0.0] - 2026-02-21

### Added

- Added ListManager to handle automatic continuation of ordered lists (`1.`), unordered lists (`-`, `*`), and task lists (`[x]`)
- **`mode`**: Introduced hybrid (rendered styles) and plain (raw text) modes; plain remains the default
- **`image tool`**: Added client-side validation to ensure required Alt text is provided before initiating server requests
- Added support for custom upload parameters in `image.fileInput.params` (e.g., `_token`, `user_id`, `folder`)

### Changed

- The `options` object now ships with a fully pre-defined default configuration for a faster, zero-config setup. The `toolbar` array specifically now defaults to a "Minimal Essentials" set, removing the requirement to manually define tools or other option keys unless you want to customize the behavior. You can just do this `const editor = new MarkdownEditor('#editor');`
- Refreshed Markdown editor toolbar icons for improved design and consistency
- `IndentManager` now initialized by passing the editor instance (this) instead of separate arguments
- Updated the toolbar and preview pane to dynamically support current and custom themes by removing hard-coded backgrounds in favor of theme-defined color inheritance
- **`image tool`**: Moved file uploading from the `change` event to the "Apply" button click for a unified `async` flow
- **`image tool`**: Improved `altInput` to support both boolean and object-based (`{ required: true }`) configurations
- **`image tool`**: Standardized response handling to require `{ success: true }` for successful uploads.
- **`image tool`**: Improved error reporting by standardizing alert handling to support error responses with either `{ error: "..." }` or `{ message: "..." }` object keys
- [Breaking]: Renamed request field `image` to `image_file`
- [Breaking]: Renamed response field `path` to `image_path`

### Fixed

- Build (Production): Added `sourceMap: true` to CSS loaders to ensure `.map` files are generated, preventing deployment crashes
- Build Paths: Standardized output paths using `__dirname` for cross-environment stability
- **`theme`**: Aligned Tailwind CSS prose colors in the preview to match the selected editor theme palette
- **`image tool`**: Resolved issue where files would upload even if mandatory Alt text was missing

## [0.5.0] - 2026-02-04

### Added

- Added copyright notice to output files
- Official stable support for the undo/redo tools
- New `indent` and `outdent` tools
- Implemented a complete history system using `diff-chars` to minimize memory usage by storing only changes rather than full-text snapshots
- Added automatic insertion of closing pairs `{}`, `[]`, `()`, `<>`, `""`, and `''`
- Typing a pair character while text is selected now wraps the text instead of replacing it
- If a user types a closing character that is already present at the cursor, the cursor simply jumps forward
- Hitting `Enter` between `{}` now creates a triple-line expansion with a nested indent. Standard `Enter` now carries over the indentation level of the previous line
- Deleting an opening bracket also removes the adjacent closing bracket
- Support for custom upload parameters in ImageTool via the fileInput.params configuration object. This allows passing additional data like CSRF tokens, user IDs, or folder destinations during the upload request

### Changed

- Disabled Tailwind css Preflight
- Created separate Webpack build files for development and production
- Added a `1000ms` debounce for standard typing and immediate saving for "boundary" characters (spaces, punctuation, etc.)
- Refactored to handle both `\t` and `4-space` indentation patterns during the outdent process
- Undo and Redo now perfectly restore both the text content and the exact selection range/cursor position
- Integrated `Ctrl+Z`, `Ctrl+Y`, and `Ctrl+Shift+Z` to trigger the custom history manager
- [Breaking] Renamed the upload request parameter from `image` to `image_file` for better clarity and to avoid naming collisions.
- [Breaking] Renamed the response parameter `path` to `image_path` to align with standardized naming conventions.

### Fixed

- Fix keyboard undo/redo to follow the same behavior as the undo/redo tools
- Resolved an issue where highlighted text was not saved to the undo stack before being replaced
- Fixed potential state corruption by ensuring `_restoreState` correctly updates the `lastValue` reference
- Ensured the textarea regains focus immediately after undo/redo operations for a seamless typing experience
- Implemented `maxStackSize: 100` to prevent memory leaks during long editing sessions
- The manager now skips processing if the text value has not changed between saves

## [0.4.0] - 2025-08-06

### Added

- Introduced beta support for undo/redo functionality using a granular diff-based system
  - Built to handle large documents efficiently, with no impact on performance
  - Tracks changes with smart save points on word boundaries, paste, enter, backspace, delete, blur, and debounce events
  - Optimized for handling huge markdown content efficiently

### Changed

- Prefixed all Tailwind CSS and Frutjam classes by utilizing Frutjam’s new component prefixing support (e.g., for components like `.modal`), to avoid design conflicts with other frameworks such as Bootstrap
- Refactored folder hierarchy: reorganized the folder structure to separate files based on functionality
- Replaced fixed Tailwind background and text color classes with Frutjam Surface component to ensure theme consistency across all Frutjam themes 

## [0.3.0] - 2025-05-12

### Added

- Added `altInput` configuration to the `image` tool, allowing developers to customize the alt text input behavior in the markdown editor
- Introduced a `required` option inside `altInput`:
  - When `required` is `true` (default), alt text is mandatory, supporting better SEO and accessibility
  - When set to `false`, validation for alt text is disabled
- This configuration enables flexible validation rules across different editor instances

### Fixed

- Resolved an issue in the image modal where a `selectedText is not defined` error could occur when applying changes without selecting text

## [0.2.1] - 2025-05-12

### Fixed

- Resolved an issue where the preview tool's background color did not render correctly in dark mode
- Fixed a bug causing the preview pane to not update in response to user input, due to the this.preview reference being unintentionally overridden
- Updated modal element ID selectors to avoid naming conflicts with other projects

## [0.2.0] - 2025-05-12

### Added

- Integrated the [Fruitjam UI library](https://github.com/fruitjam/ui) for a cleaner, more modern, and intuitive user interface.
- Updated the link tool to use the Fruitjam UI modal, providing a more intuitive and visually consistent user experience.
- Introduced a fully configurable `image` tool with support for:
  - `fileInput` configuration:
    - `accept`: Array of allowed image file types (e.g., `'webp'`, `'avif'`)
    - `uploadUrl`: Endpoint for uploading image files
  - Automatic URL field population after successful upload
  - Fallback to URL and alt text fields when `fileInput` is not configured

### Fixed

- Resolved a critical error where removing the `preview` option from the toolbar would crash the editor.

## [0.1.5] - 2025-03-03

### Changed

- Upgraded to Tailwind CSS v4

## [0.1.4] - 2025-02-24

### Fixed

- Resolved UI glitch for a smoother user experience.

## [0.1.3] - 2025-02-18

### Changed

- Production-ready minified CSS

### Fixed

- Bug fixes

## [0.1.2] - 2025-02-17

### Added

- New Tools Added: You can now easily add Headings, Links, and Blockquotes to your content!
- Sleek New UI: Enjoy a fresh, improved design that makes your experience smoother and more intuitive than ever!

## [0.1.1] - 2025-02-16

### Added

- Implemented scrolling to the view of newly inserted text in the textarea when a toolbar tool is clicked.

### Changed

- Disabled toolbar tools in mobile view when preview mode is active to improve UX.
- Improved UI

### Fixed

- Bug fixes

## [0.1.0] - 2025-02-15

### Added

- Ordered List Tool: Introduced a new tool for creating ordered (numbered) lists. This allows users to easily organize and present information in a step-by-step format.
- Unordered List Tool: Added a tool for creating unordered (bulleted) lists. This enhances document formatting by making it easier to list items without specific order.
- Checklist Tool: A new checklist tool has been added, allowing users to create interactive checklists. This feature is perfect for tasks, to-do lists, or tracking progress in projects.

### Changed

- Document Update: Updated the documentation to reflect new features and provide clear instructions on how to use the newly added list tools.

## [0.0.21-beta.3] - 2025-02-15

### Added

- Added RTL Support: Enhanced user experience by adding Right-to-Left text support.

### Changed

- UI Enhancements: Improved the overall user interface for a more polished experience.
- Local Development Improvements: Made significant changes to improve the local development workflow.

### Fixed

- Fixed Page Reload Issue: Resolved the issue where the page was reloading upon clicking the tool.

## [0.0.21-beta.2] - 2025-01-20

### Fixed

- Bug Fix: Resolved MarkdownEditor undefined issue for CDN usage. The library now correctly exposes the MarkdownEditor global variable in browsers.

## [0.0.20-beta.2] - 2025-01-19

### Changed

- Changed markdownEditor to MarkdownEditor class import.
- Several improvements to enhance functionality.
- Updated README.md with clearer usage instructions.

## [0.0.2-beta.1] - 2025-01-15

### Added

- Initial release

---

[Unreleased]: https://github.com/nezanuha/markdown-text-editor/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/nezanuha/markdown-text-editor/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/nezanuha/markdown-text-editor/compare/v1.1.5...v1.2.0
[1.1.5]: https://github.com/nezanuha/markdown-text-editor/compare/v1.1.4...v1.1.5
[1.1.4]: https://github.com/nezanuha/markdown-text-editor/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/nezanuha/markdown-text-editor/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/nezanuha/markdown-text-editor/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/nezanuha/markdown-text-editor/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/nezanuha/markdown-text-editor/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/nezanuha/markdown-text-editor/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/nezanuha/markdown-text-editor/compare/v0.5.0...v1.0.0
[0.5.0]: https://github.com/nezanuha/markdown-text-editor/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/nezanuha/markdown-text-editor/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/nezanuha/markdown-text-editor/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/nezanuha/markdown-text-editor/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/nezanuha/markdown-text-editor/compare/v0.1.5...v0.2.0
[0.1.5]: https://github.com/nezanuha/markdown-text-editor/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/nezanuha/markdown-text-editor/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/nezanuha/markdown-text-editor/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/nezanuha/markdown-text-editor/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/nezanuha/markdown-text-editor/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/nezanuha/markdown-text-editor/compare/v0.0.2-beta.1...v0.1.0
[0.0.2-beta.1]: https://github.com/nezanuha/markdown-text-editor/compare/0.0.21-beta.3...v0.0.2-beta.1
[0.0.21-beta.3]: https://github.com/nezanuha/markdown-text-editor/compare/0.0.21-beta.2...0.0.21-beta.3
[0.0.21-beta.2]: https://github.com/nezanuha/markdown-text-editor/compare/0.0.20-beta.2...0.0.21-beta.2
[0.0.20-beta.2]: https://github.com/nezanuha/markdown-text-editor/compare/0.0.2-beta.1...0.0.20-beta.2
[0.0.2-beta.1]: https://github.com/nezanuha/markdown-text-editor/releases/tag/0.0.2-beta.1