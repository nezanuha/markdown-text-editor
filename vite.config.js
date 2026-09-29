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

/** Pulls one file field out of a multipart/form-data body. */
function readUploadedFile(buffer, contentType, field) {
    const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType || '');
    if (!boundary) return null;

    const marker = Buffer.from('--' + (boundary[1] || boundary[2]).trim());
    const parts = [];
    let at = buffer.indexOf(marker);
    while (at !== -1) {
        const next = buffer.indexOf(marker, at + marker.length);
        if (next === -1) break;
        parts.push(buffer.subarray(at + marker.length + 2, next - 2)); // trim the CRLFs
        at = next;
    }

    for (const part of parts) {
        const split = part.indexOf('\r\n\r\n');
        if (split === -1) continue;
        const headers = part.subarray(0, split).toString();
        if (!new RegExp(`name="${field}"`).test(headers)) continue;
        return {
            body: part.subarray(split + 4),
            name: /filename="([^"]*)"/.exec(headers)?.[1] || 'upload',
            type: /Content-Type:\s*(\S+)/i.exec(headers)?.[1] || 'application/octet-stream',
        };
    }
    return null;
}

/**
 * Dev-only stand-in for an image upload endpoint, so the demo pages can exercise
 * paste and drop without a backend.
 *
 * It keeps the uploaded bytes in memory and serves them straight back, so you see
 * the image you actually pasted rather than a stand-in. Responses use a short path
 * like a real backend would, never a data URI, which would bloat the markdown and
 * defeat the point of uploading. The delay makes the "Uploading..." placeholder
 * visible instead of instantaneous.
 */
function mockUploadEndpoint() {
    const store = new Map();

    return {
        name: 'mock-upload-endpoint',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use('/api/uploads/', (req, res, next) => {
                const file = store.get(req.url.replace(/^\//, ''));
                if (!file) return next();
                res.setHeader('Content-Type', file.type);
                res.end(file.body);
            });

            server.middlewares.use('/api/upload', (req, res, next) => {
                if (req.method !== 'POST') return next();

                const chunks = [];
                req.on('data', (chunk) => chunks.push(chunk));
                req.on('end', () => setTimeout(() => {
                    const file = readUploadedFile(Buffer.concat(chunks), req.headers['content-type'], 'image_file');
                    res.setHeader('Content-Type', 'application/json');

                    if (!file) {
                        res.end(JSON.stringify({ success: false, error: 'No image_file in the request.' }));
                        return;
                    }

                    const id = Math.random().toString(36).slice(2, 10);
                    store.set(id, file);
                    res.end(JSON.stringify({
                        success: true,
                        image_path: `/api/uploads/${id}`,
                        image_alt: file.name.replace(/\.[^.]+$/, ''),
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
