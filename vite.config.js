import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        tailwindcss(),
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
