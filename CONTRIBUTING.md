# Contributing

Thanks for taking an interest. Bug reports, feature requests and pull requests are all welcome.

## Getting started

```bash
git clone https://github.com/nezanuha/markdown-text-editor.git
cd markdown-text-editor
npm install
npm run dev
```

`npm run dev` opens `/demo/` on port 3000. There are two playground pages:

- **`demo/index.html`** — the main editor, hybrid mode, variables
- **`demo/renderer.html`** — the `renderer` and `sanitizer` options against markdown-it

Both import from `src/`, so changes hot-reload.

## Tests

```bash
npm run build   # tests run against dist/, so build first
npm test
npm run typecheck
```

The suite constructs editors under [happy-dom](https://github.com/capricorn86/happy-dom) and asserts on the resulting DOM. It exists to catch runtime errors and structural mistakes that a build cannot — a tool that throws on construction, a button that renders when it shouldn't.

**Layout is not simulated.** `offsetHeight` and `getBoundingClientRect` always return `0`, so auto-grow, fullscreen sizing and hybrid mode's character alignment can only be verified in a browser. Open the demo pages for anything visual.

happy-dom has no Popover API, so `showPopover` / `hidePopover` are stubbed in the test harness. Dropdown positioning and light-dismiss are browser-only too.

## Project layout

```
src/
  components/
    Editor.js              main class, rendering, options
    Preview.js  Footer.js
    toolbar/
      Toolbar.js           tool registry, builds the toolbar
      MakeTool.js          base class for tools
      tools/               one file per toolbar button
  utils/                   undo/redo, lists, indent, shortcuts, find & replace
  styles/main.css          plain CSS on top of Tailwind + frutjam
test/
  smoke.mjs              headless tests, run against dist/
  types.test.ts          compile-only, proves the types match the code
types/index.d.ts         published TypeScript definitions
demo/
```

## Adding a toolbar tool

1. Create `src/components/toolbar/tools/YourTool.js` extending `MakeTool`.
2. Implement `applySyntax()`, and use `this.editor.insertText(text, offset, trailing)` rather than writing to the textarea directly — it handles focus, caret position, scrolling, re-render and `onChange`.
3. Register it in the `toolMapping` object in `Toolbar.js`.
4. Add it to the default toolbar array in `Editor.js` only if it is useful without configuration.

For a dropdown, copy the popover pattern in `HeadingTool.js` — it already handles the roles and markup. One gotcha: `MakeTool`'s constructor calls `createButton()`, so anything your override needs must come from `this.editor`, not from a field you assign after `super()`.

A tool may return `null` from `createButton()` to render nothing, as `VariableTool` does when no variables are configured.

## Types

`types/index.d.ts` is hand-written and published with the package. **Adding or changing an option means updating it**, or TypeScript users get a compile error on valid configuration.

`test/types.test.ts` guards against drift. It never runs; it only has to compile. Valid configuration must type-check, and each `@ts-expect-error` must actually error, since an unused one is itself a compile error. `npm run typecheck` runs both, and so does CI.

## Style

Match the surrounding code. Four-space indent, no semicolon-free style, comments only where the reason isn't obvious from the code.

Toolbar buttons use frutjam utility classes prefixed `fj:`. Prefer an existing frutjam class over new CSS.

## Documentation

The documentation site is maintained separately, at
[frutjam.com/plugins/markdown-editor](https://frutjam.com/plugins/markdown-editor).
Its source is not in this repository, so there is nothing for you to edit there.

If your change adds or alters an option, say so in the pull request and it will be
documented on release. In this repository, update `README.md` for user-visible
features, `CHANGELOG.md` for every change, and `types/index.d.ts` for anything that
touches the options.

## Changelog

Add an entry under `## [Unreleased]` in `CHANGELOG.md`, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):

```markdown
- **`optionName` option**: What it lets you do, in one sentence ([#12](link))
```

Write for someone who has never seen the feature. Lead with what they can now do, not how it works internally. Keep entries prose-only — no code blocks.

## Commits

Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.

Explain *why* in the body, not just what. The diff already shows what changed; it cannot show the problem you were solving or the alternative you rejected.

## Pull requests

- One concern per pull request
- Say what you tested, and what you couldn't
- Note anything that changes existing behaviour, however small

Not sure whether an idea fits? Open an issue or a discussion first. That is usually faster than building something that turns out to need a different shape.
