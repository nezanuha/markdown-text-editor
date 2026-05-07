import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import cssInjectedByJs from 'vite-plugin-css-injected-by-js';

export default defineConfig({
    plugins: [
        tailwindcss(),
        cssInjectedByJs(),
    ],
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
