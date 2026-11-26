/**
 * Writes THIRD-PARTY-NOTICES.md from the licences in node_modules.
 *
 *     npm run notices        (and once more inside `npm run build`)
 *
 * The standalone build carries marked and DOMPurify inside it, because a
 * `<script src>` has nothing to resolve them with. MIT and Apache-2.0 both ask
 * that the copyright notice travel with a redistribution, and a minified
 * bundle with every comment stripped was not carrying one. This file is what
 * travels, listed in `files` so it is in the published package, and the
 * standalone build's banner points at it.
 *
 * Generated rather than written by hand, so a dependency bump cannot leave the
 * notice describing a version nobody ships. `npm run build` regenerates it;
 * a diff in CI means the licences moved and nobody looked.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// The ones that end up inside a build we publish. The es and cjs builds leave
// them out -- see RUNTIME_DEPS in vite.config.js -- so only the standalone
// build is a redistribution, and these are what it redistributes.
const BUNDLED = ['marked', 'dompurify'];

const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8').trim() : null);

const sections = BUNDLED.map((name) => {
    const meta = JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8'));
    const text = read(`node_modules/${name}/LICENSE`)
        ?? read(`node_modules/${name}/LICENSE.md`)
        ?? read(`node_modules/${name}/license`);

    if (!text) {
        throw new Error(`No licence file found for ${name}. Look in node_modules/${name}/ `
            + 'and add the filename to third-party-notices.mjs.');
    }

    return `## ${name} ${meta.version}\n\n`
        + `License: ${meta.license}\n`
        + (meta.homepage ? `Home: ${meta.homepage}\n` : '')
        + `\n\`\`\`\n${text}\n\`\`\`\n`;
});

const notices = '# Third-party notices\n\n'
    + 'The standalone build, `dist/markdown-text-editor.min.js`, has these\n'
    + 'libraries compiled into it, because a `<script src>` tag has no way to\n'
    + 'resolve them itself. Their licences are reproduced in full below.\n\n'
    + 'The `es` and `cjs` builds import them instead, so if you install this\n'
    + 'package with npm you get them as your own dependencies and nothing here\n'
    + 'is redistributed.\n\n'
    + sections.join('\n');

// CRLF, like the rest of the repo. Written with LF, the file came back
// modified from every build -- git normalises it on the way in, so the diff
// was empty and `git status` was dirty anyway. Checking the tree is the step
// before a release, and it should mean something.
writeFileSync('THIRD-PARTY-NOTICES.md', notices.replace(/\n/g, '\r\n'));
console.log(`THIRD-PARTY-NOTICES.md written: ${BUNDLED.join(', ')}`);
