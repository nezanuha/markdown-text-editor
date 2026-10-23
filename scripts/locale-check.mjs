/**
 * Checks every locale/*.js against locale/template.js.
 *
 *     npm run locale:check
 *
 * The editor looks a translation up by its English text, `strings?.[text] ?? text`,
 * so a key that no longer matches the source falls back to English in silence. One
 * reworded string in src/ leaves every locale file quietly stale with nothing in
 * the console to say so. This turns that into a failing line of output.
 *
 * Three ways a file goes wrong:
 *
 *   missing    the template has a key this file does not, so that string shows in
 *              English. Either new UI text, or a key renamed out from under it.
 *   orphan     this file has a key the template does not, so the translation is
 *              never read. Usually the other half of a rename.
 *   lost {n}   the English has a {n} placeholder and the translation does not, so
 *              the number never appears. "{n} words" translated as "words".
 *
 * Unlike locale:extract, this reads only locale/, so it runs in CI as part of
 * `npm test` rather than needing a fresh build.
 *
 * A rename shows up as a missing and an orphan together. If the meaning did not
 * change, move the translations across; if it did, they need redoing.
 */
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const load = async file => (await import(pathToFileURL(resolve('locale', file)).href)).default;

const template = await load('template.js');
const expected = Object.keys(template);

const files = readdirSync('locale')
    .filter(file => file.endsWith('.js') && file !== 'template.js')
    .sort();

let failed = 0;

for (const file of files) {
    const strings = await load(file);
    const problems = [];

    for (const key of expected) {
        if (!(key in strings)) problems.push(`missing   ${JSON.stringify(key)}`);
        else if (key.includes('{n}') && !strings[key].includes('{n}')) {
            problems.push(`lost {n}  ${JSON.stringify(key)} -> ${JSON.stringify(strings[key])}`);
        }
    }

    for (const key of Object.keys(strings)) {
        if (!(key in template)) problems.push(`orphan    ${JSON.stringify(key)}`);
    }

    if (problems.length) {
        failed++;
        console.error(`\nlocale/${file}`);
        for (const problem of problems) console.error(`  ${problem}`);
    }
}

if (failed) {
    console.error(`\n${failed} of ${files.length} locale files are out of step with the template.`);
    console.error('Run `npm run locale:extract` first if you changed UI text in src/.');
    process.exit(1);
}

console.log(`${files.length} locale files, all ${expected.length} keys present.`);
