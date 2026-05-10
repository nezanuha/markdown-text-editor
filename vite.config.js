import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import cssInjectedByJs from 'vite-plugin-css-injected-by-js';

const SCOPE = '.markdown-editor-wrapper';
const GLOBAL_SELECTORS = /^(\*|:before|:after|::backdrop)$/;
// frutjam's root config pre-scopes [data-theme] → .markdown-editor-wrapper[data-theme]
// before our PostCSS plugin runs, so we match the already-scoped form
const SCOPED_DATA_THEME = /^\.markdown-editor-wrapper(\[data-theme(=[^\]]+)?\])$/;
const SCOPED_IS_DATA_THEME = /^\.markdown-editor-wrapper:is\(\s*\[data-theme/;

function scopeGlobalCss() {
    return {
        postcssPlugin: 'scope-global-css',
        Rule(rule) {
            const expanded = [];
            for (const sel of rule.selectors) {
                const trimmed = sel.trim();
                if (GLOBAL_SELECTORS.test(trimmed)) {
                    expanded.push(`${SCOPE} ${trimmed}`);
                } else if (SCOPED_DATA_THEME.test(trimmed)) {
                    const attr = trimmed.slice(SCOPE.length); // e.g. [data-theme="dark"]
                    expanded.push(trimmed);                   // .markdown-editor-wrapper[data-theme]
                    expanded.push(`${attr} ${SCOPE}`);        // [data-theme] .markdown-editor-wrapper
                } else if (SCOPED_IS_DATA_THEME.test(trimmed)) {
                    const isClause = trimmed.slice(SCOPE.length); // :is([data-theme=...])
                    expanded.push(trimmed);
                    expanded.push(`${isClause} ${SCOPE}`);
                } else {
                    expanded.push(sel);
                }
            }
            rule.selectors = expanded;
        },
    };
}
scopeGlobalCss.postcss = true;

export default defineConfig({
    plugins: [
        tailwindcss(),
        cssInjectedByJs(),
    ],
    css: {
        postcss: {
            plugins: [scopeGlobalCss()],
        },
    },
    build: {
        lib: {
            entry: 'src/components/Editor.js',
            name: 'MarkdownEditor',
            formats: ['es', 'umd'],
            fileName: (format) => `markdown-text-editor.${format}.js`,
        },
        cssCodeSplit: false,
        sourcemap: true,
    },
    server: {
        open: '/demo.html',
        port: 3000,
    },
});
