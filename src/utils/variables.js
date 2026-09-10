/**
 * Variables are configured either flat or grouped, and the two forms can be
 * mixed in one list:
 *
 *   { label: 'Customer Name', value: '{{customer.name}}', sample: 'Hannes' }
 *   { label: 'Customer', items: [ { label: 'Email', value: '{{customer.email}}' } ] }
 *
 * Returns every usable leaf entry, dropping malformed ones rather than throwing,
 * so one bad line of config cannot take the whole editor down.
 */
export function flattenVariables(variables) {
    const usable = entry => entry && entry.label && typeof entry.value === 'string';
    const out = [];

    for (const entry of Array.isArray(variables) ? variables : []) {
        if (!entry) continue;
        if (Array.isArray(entry.items)) {
            out.push(...entry.items.filter(usable));
        } else if (usable(entry)) {
            out.push(entry);
        }
    }

    return out;
}

/**
 * Swaps each variable that declares a sample for that sample, so the preview can
 * show representative text. Variables without a sample are left as written.
 * Only ever applied to a copy on its way to the renderer; the textarea keeps the
 * real placeholders.
 */
export function applyVariableSamples(markdown, variables) {
    const samples = flattenVariables(variables).filter(v => typeof v.sample === 'string');
    if (!samples.length) return markdown;

    // Longest value first, so a variable that is a prefix of another cannot
    // consume it, e.g. {{user}} must not break {{user.email}}.
    return samples
        .slice()
        .sort((a, b) => b.value.length - a.value.length)
        .reduce((text, v) => text.split(v.value).join(v.sample), markdown);
}
