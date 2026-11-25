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
 * Four ways a file goes wrong:
 *
 *   missing    the template has a key this file does not, so that string shows in
 *              English. Either new UI text, or a key renamed out from under it.
 *   orphan     this file has a key the template does not, so the translation is
 *              never read. Usually the other half of a rename.
 *   lost {n}   the English has a {n} placeholder and the translation does not, so
 *              the number never appears. "{n} words" translated as "words".
 *   out of order
 *              the keys are all there but not in the template's order. Nothing
 *              breaks; fifty-six files drift apart instead, and a one-string
 *              change then shows up as a file that moved its contents around.
 *              Checked so the tidy holds -- every one of them had new keys in a
 *              block at the top, ahead of an otherwise alphabetical list.
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

    const keys = Object.keys(strings);
    for (const key of keys) {
        if (!(key in template)) problems.push(`orphan    ${JSON.stringify(key)}`);
    }

    // Only worth saying once the set itself is right: a missing key puts
    // everything after it out of step, and that is the same complaint twice.
    if (!problems.length && keys.join('\u0000') !== expected.join('\u0000')) {
        const at = keys.findIndex((key, i) => key !== expected[i]);
        problems.push(`out of order  ${JSON.stringify(keys[at])} is where `
            + `${JSON.stringify(expected[at])} should be (key ${at + 1})`);
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
    console.error('Keys in the wrong place are a straight reorder: put them in the '
        + "template's order, which is the order translators read.");
    process.exit(1);
}

console.log(`${files.length} locale files, all ${expected.length} keys present.`);
