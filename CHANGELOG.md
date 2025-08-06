# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2025-08-06

### Added

- Introduced beta support for undo/redo functionality using a granular diff-based system
  - Built to handle large documents efficiently, with no impact on performance
  - Tracks changes with smart save points on word boundaries, paste, enter, backspace, delete, blur, and debounce events
  - Optimized for handling huge markdown content efficiently

### Changed

- Prefixed all Tailwind CSS and Frutjam classes by utilizing Frutjam’s new component prefixing support (e.g., for components like `.modal`), to avoid design conflicts with other frameworks such as Bootstrap.
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

[Unreleased]: https://github.com/nezanuha/markdown-text-editor/compare/v0.4.0...HEAD
[v0.4.0]: https://github.com/nezanuha/markdown-text-editor/compare/v0.3.0...v0.4.0
[v0.3.0]: https://github.com/nezanuha/markdown-text-editor/compare/v0.2.1...v0.3.0
[v0.2.1]: https://github.com/nezanuha/markdown-text-editor/compare/v0.2.0...v0.2.1
[v0.2.0]: https://github.com/nezanuha/markdown-text-editor/compare/v0.1.5...v0.2.0
[v0.1.5]: https://github.com/nezanuha/markdown-text-editor/compare/v0.1.4...v0.1.5
[v0.1.4]: https://github.com/nezanuha/markdown-text-editor/compare/v0.1.3...v0.1.4
[v0.1.3]: https://github.com/nezanuha/markdown-text-editor/compare/v0.1.2...v0.1.3
[v0.1.2]: https://github.com/nezanuha/markdown-text-editor/compare/v0.1.1...v0.1.2
[v0.1.1]: https://github.com/nezanuha/markdown-text-editor/compare/v0.1.0...v0.1.1
[v0.1.0]: https://github.com/nezanuha/markdown-text-editor/compare/v0.0.2-beta.1...v0.1.0
[v0.0.2-beta.1]: https://github.com/nezanuha/markdown-text-editor/compare/0.0.21-beta.3...v0.0.2-beta.1
[0.0.21-beta.3]: https://github.com/nezanuha/markdown-text-editor/compare/0.0.21-beta.2...0.0.21-beta.3
[0.0.21-beta.2]: https://github.com/nezanuha/markdown-text-editor/compare/0.0.20-beta.2...0.0.21-beta.2
[0.0.20-beta.2]: https://github.com/nezanuha/markdown-text-editor/releases/tag/0.0.20-beta.2