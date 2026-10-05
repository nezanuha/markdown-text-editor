/**
 * Runs from npm's `version` lifecycle, after package.json has been bumped but
 * before the commit and tag, so failing here aborts the release cleanly.
 *
 * The release workflow builds its GitHub release notes by grepping CHANGELOG.md
 * for "## [<version>]". If the section is still called [Unreleased] the grep
 * finds nothing and the release ships with placeholder notes, which is only
 * noticeable once it is published.
 *
 * Prereleases are exempt: a beta is a preview of a release, not one of its own,
 * so its entries stay under [Unreleased] until the stable version closes them.
 */
import { readFile } from 'node:fs/promises';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));

if (version.includes('-')) {
    console.log(`Prerelease ${version}, leaving CHANGELOG.md alone.`);
    process.exit(0);
}

// Normalised first, or a CRLF checkout defeats the $ anchor
const changelog = (await readFile('CHANGELOG.md', 'utf8')).replace(/\r\n/g, '\n');
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const heading = new RegExp(`^## \\[${escaped}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm');

if (!heading.test(changelog)) {
    const today = new Date().toISOString().slice(0, 10);
    console.error(`
CHANGELOG.md has no "## [${version}] - YYYY-MM-DD" heading.

Rename the [Unreleased] section and commit it before releasing:

    ## [${version}] - ${today}

Nothing has been tagged or published.
`);
    process.exit(1);
}
