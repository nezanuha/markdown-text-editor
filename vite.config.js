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

/**
 * Dev-only stand-in for an image upload endpoint, so the demo pages can exercise
 * paste and drop without a backend. Answers in the shape the editor expects, after
 * a deliberate delay so the "Uploading..." placeholder is actually visible.
 *
 * It does not store the upload. It returns the path of a static placeholder that
 * the dev server already serves, which is what a real backend does: a short path,
 * not a data URI. Inlining base64 here would bloat the markdown and contradict the
 * point of uploading in the first place.
 */
function mockUploadEndpoint() {
    return {
        name: 'mock-upload-endpoint',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use('/api/upload', (req, res, next) => {
                if (req.method !== 'POST') return next();
                req.resume(); // drain the body, we do not need it
                req.on('end', () => setTimeout(() => {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                        success: true,
                        image_path: '/demo/uploaded.svg',
                        image_alt: 'Uploaded image',
                    }));
                }, 1200));
            });
        },
    };
}

export default defineConfig({
    plugins: [
        tailwindcss(),
        cssInjectedByJs(),
        mockUploadEndpoint(),
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
            formats: ['es', 'umd', 'iife'],
            fileName: (format) => format === 'iife' ? 'markdown-text-editor.min.js' : `markdown-text-editor.${format}.js`,
        },
        cssCodeSplit: false,
        sourcemap: true,
    },
    server: {
        open: '/demo/',
        port: 3000,
    },
});
