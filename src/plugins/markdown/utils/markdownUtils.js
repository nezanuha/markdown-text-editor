// utils/markdownUtils.js

import { marked } from 'marked';

export function renderMarkdown(content) {
    return marked(content);
}