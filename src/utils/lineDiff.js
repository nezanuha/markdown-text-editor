/**
 * What a draft would change, by line.
 *
 * Deliberately not a full diff. A longest-common-subsequence pass over two
 * documents is O(n*m), and a 150,000-character draft is a few thousand lines
 * on each side, which is tens of millions of cells to fill in while somebody
 * waits to answer a yes-or-no question. The `diff` package would do it, but it
 * is a dev dependency here and putting it in the bundle to answer that question
 * costs every page that never asks.
 *
 * Trimming the matching lines off both ends is linear, needs nothing, and is
 * exact for the case that actually happens: a draft is the page's text with
 * one stretch rewritten. Where the edits are scattered the middle block grows
 * to span them, so the answer is wider than the smallest possible diff but
 * never wrong -- everything outside it really is identical.
 */
export function lineDiff(before, after) {
    const a = String(before ?? '').split('\n');
    const b = String(after ?? '').split('\n');

    let head = 0;
    while (head < a.length && head < b.length && a[head] === b[head]) head++;

    // Stop before the two ends meet, or an unchanged line would be counted
    // from both directions and appear in neither list.
    let tail = 0;
    while (tail < a.length - head
        && tail < b.length - head
        && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;

    return {
        /** Identical lines before the change, and after it. */
        head,
        tail,
        /** Lines the draft would take off the page. */
        removed: a.slice(head, a.length - tail),
        /** Lines the draft would put there instead. */
        added: b.slice(head, b.length - tail),
    };
}
