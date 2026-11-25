/**
 * Uploading, in one place.
 *
 * The host configures this once, at the top level, and the three ways a file
 * can arrive -- the toolbar's image dialog, a paste, a drop -- all go through
 * the same `upload()`. None of them knows which form the host wrote.
 *
 *   upload: '/api/upload'
 *   upload: { url, field, headers, params, response, accept,
 *             maxSize, insert, onProgress, paste, drop }
 *   upload: async (file, alt) => url
 *
 * Before 2.0 this lived in the toolbar, as
 * `{ image: { fileInput: { uploadUrl } } }`. That form still works, because
 * paste and drop were reading it out of the toolbar array anyway, which is the
 * clearest sign it never belonged there: an endpoint is not a button.
 *
 * Images are the default and the common case, but nothing here is image-only.
 * `accept` decides what may be uploaded and `insert` decides what is written
 * into the document, so a PDF becomes a link rather than being discarded.
 */

import { escapeHtml } from './escapeHtml.js';

// What the server has been sent since 1.8. Renaming either would change the
// request for everyone who never asked, so `image_file` stays the default and
// `field` overrides it.
//
// The alt text has no such option on purpose. An endpoint that cannot read
// `image_file`, because it already exists under another name, can still read a
// string called `image_alt`. An `altField` to match `field` would have been
// symmetry for its own sake.
const DEFAULT_FIELD = 'image_file';
const ALT_FIELD = 'image_alt';

// Unchanged behaviour for a host that says nothing: images, and only images.
const DEFAULT_ACCEPT = ['image/*'];

const isImage = file => !!file?.type?.startsWith('image/');

/**
 * The answers the editor understands without being told.
 *
 *   { url, alt? }          or { path, alt? }   -- say it however you say it
 *   { success, image_path, image_alt? }        -- the 1.8 contract, still read
 *   { success: false, error }                  -- a failure, with the reason
 *
 * `image_path` was named when images were the only thing this took, and an
 * endpoint that stores PDFs should not have to call its answer that. `url` and
 * `path` are read first, so a new endpoint can use its own words and an old one
 * keeps working. `success` is only consulted to find a failure: an endpoint
 * that answers 200 with a URL and nothing else has already said it worked.
 *
 * Anything neither shape fits is what `response` is for.
 */
function defaultResponse(body) {
    const fail = () => new Error(body?.error || body?.message || 'Upload failed.');
    if (!body || body.success === false) throw fail();

    const path = body.url || body.path || body.image_path;
    if (!path) throw fail();

    return { path, alt: body.alt || body.image_alt || '' };
}

/**
 * What goes into the document once the upload lands.
 *
 * Markdown has syntax for exactly one of these, the image. Video and audio are
 * raw HTML because there is nothing else to write, and a file is a link named
 * after itself, which is what every forum and issue tracker does with an
 * attachment.
 *
 * Writing the HTML rather than a link is a bet that whatever renders this
 * markdown allows HTML through. Most publishing pipelines do; `markdown-it`
 * with `html: false` and Python-Markdown do not, and there a reader sees the
 * tag as text. That is what `insert` is for -- but it is the wrong way round to
 * make everyone who accepts video write the same branch to get a player, when
 * nobody widens `accept` to video hoping for a link.
 */
function defaultInsert(file, url, alt) {
    const type = file?.type || '';

    if (type.startsWith('image/')) return `![${alt || ''}](${url})`;
    if (type.startsWith('video/')) return `<video src="${escapeHtml(url)}" controls></video>`;
    if (type.startsWith('audio/')) return `<audio src="${escapeHtml(url)}" controls></audio>`;

    return `[${alt || file?.name || url}](${url})`;
}

/**
 * `accept: ['png']` became `image/png` before 2.0, so a full type would have
 * come out as `image/image/png`. Both forms are read now, and a bare subtype
 * keeps meaning what it used to.
 */
function normaliseAccept(accept) {
    if (!Array.isArray(accept) || !accept.length) return DEFAULT_ACCEPT;
    const types = accept
        .filter(type => typeof type === 'string' && type.trim())
        .map(type => (type.includes('/') ? type.trim() : `image/${type.trim()}`));
    return types.length ? types : DEFAULT_ACCEPT;
}

function matchesAccept(file, accept) {
    return accept.some(type => (
        type.endsWith('/*')
            ? file.type?.startsWith(type.slice(0, -1))
            : file.type === type
    ));
}

/**
 * Sizes as a person reads them. A 5 MB limit reported as "5120 kB" is
 * arithmetic handed to someone who asked a question.
 */
function formatSize(bytes) {
    if (!Number.isFinite(bytes)) return '';
    if (bytes >= 1024 * 1024) {
        const mb = bytes / (1024 * 1024);
        return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`;
    }
    return `${Math.max(1, Math.round(bytes / 1024))} kB`;
}

/**
 * A rejection the editor is willing to show, plus the detail a developer needs.
 * `message` is translated and goes in front of the user; `detail` names the
 * type or the size and goes to the console, where a MIME string belongs.
 */
function refusal(message, detail) {
    const error = new Error(message);
    error.detail = detail;
    return error;
}

/** Whatever the host's function returned, said in the editor's terms. */
function readResult(result, fallbackAlt) {
    if (typeof result === 'string') return { path: result, alt: fallbackAlt || '' };
    const path = result?.path ?? result?.url;
    if (!path) throw new Error('Upload failed: no URL was returned.');
    return { path, alt: result.alt ?? fallbackAlt ?? '' };
}

/**
 * XMLHttpRequest rather than fetch, for one reason: fetch cannot report upload
 * progress. A FormData body raises no events at all, so a host that accepts
 * video would have nothing to show for a minute. Everything else matches what
 * fetch did -- the same multipart body, the same same-origin credentials, the
 * same status check, the same errors.
 */
function post(file, alt, config) {
    const { url, field, headers, params, response, onProgress } = config;

    const body = new FormData();
    body.append(field, file);
    body.append(ALT_FIELD, alt ?? '');
    for (const [key, value] of Object.entries(params)) body.append(key, value);

    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('POST', url, true);

        // `headers` deliberately never sets Content-Type: the browser writes it
        // itself with the multipart boundary, and overriding it makes the body
        // unreadable at the other end.
        for (const [key, value] of Object.entries(headers || {})) {
            request.setRequestHeader(key, value);
        }

        // Only wired when the host asked, so nothing pays for an event it
        // never reads.
        if (onProgress) {
            request.upload.addEventListener('progress', (event) => {
                if (!event.lengthComputable) return;
                onProgress(file, event.loaded, event.total);
            });
        }

        request.addEventListener('load', () => {
            if (request.status < 200 || request.status >= 300) {
                reject(new Error(`Upload failed: ${request.status}`));
                return;
            }
            try {
                // A host's `response` is written to find the URL, and most
                // return that alone. Without readResult an adapter returning
                // { path } puts ![undefined] in the document.
                resolve(readResult(response(JSON.parse(request.responseText)), alt));
            } catch (error) {
                reject(error);
            }
        });

        request.addEventListener('error', () => {
            reject(new Error('Upload failed: the request did not complete.'));
        });

        request.send(body);
    });
}

// Once per page rather than once per editor: a page carrying twelve editors on
// the old form has one thing to change, not twelve things to read.
let fileInputNoted = false;

/**
 * The 1.x form still works, and code that works should not be scolded on every
 * page load -- `labels` and the toolbar's `variables` entry say nothing, for
 * exactly that reason.
 *
 * This one gets a note anyway, because unlike those two it leaves something
 * undiscoverable. Uploading from a paste or a drop without the image button is
 * what `upload` added, and it is what people still on `fileInput` turn up
 * asking for (#40). Silence is what made them ask.
 *
 * `info`, not `warn` or `error`: nothing is broken.
 */
function noteFileInput(overridden) {
    if (fileInputNoted) return;
    fileInputNoted = true;

    console.info(overridden
        ? '[MarkdownEditor] image.fileInput is ignored, since upload is set and wins.\n'
            + '  Drop fileInput from the toolbar entry to say so.'
        : '[MarkdownEditor] image.fileInput still works, but upload replaces it:\n'
            + "  new MarkdownEditor(el, { upload: '/api/upload' })\n"
            + '  Pasting and dropping then upload with or without the image button.');
}

/**
 * Reads `upload` in any of its three forms, or the pre-2.0 toolbar form, and
 * returns the one shape the rest of the editor uses. `null` when no endpoint is
 * configured at all, which is what every caller checks.
 *
 * `label` is the editor's translator. Two of the messages here are shown to a
 * person rather than logged, so they go through the same locale files as every
 * other string in the interface.
 */
export function resolveUpload(options = {}, label = text => text) {
    const legacy = legacyFromToolbar(options.toolbar);
    if (legacy) noteFileInput(!!options.upload);

    const config = options.upload ?? legacy;
    if (!config) return null;

    const settings = typeof config === 'string' ? { url: config }
        : typeof config === 'function' ? { handler: config }
            : config;

    const handler = settings.handler ?? (typeof settings.upload === 'function' ? settings.upload : null);
    if (!handler && !settings.url) return null;

    const accept = normaliseAccept(settings.accept);
    const maxSize = Number.isFinite(settings.maxSize) ? settings.maxSize : Infinity;
    const insert = typeof settings.insert === 'function' ? settings.insert : defaultInsert;
    const onProgress = typeof settings.onProgress === 'function' ? settings.onProgress : null;

    const send = handler
        ? (file, alt) => Promise.resolve(handler(file, alt)).then(r => readResult(r, alt))
        : (file, alt, onTick) => post(file, alt, {
            url: settings.url,
            field: settings.field || DEFAULT_FIELD,
            headers: settings.headers || undefined,
            params: settings.params || {},
            response: typeof settings.response === 'function' ? settings.response : defaultResponse,
            // The host's own callback and whatever the editor's UI asked for
            // on this one call, so a percentage in the dialog costs the host
            // nothing and does not take its callback away.
            onProgress: (onProgress || onTick)
                ? (f, loaded, total) => { onProgress?.(f, loaded, total); onTick?.(f, loaded, total); }
                : null,
        });

    return {
        accept,
        maxSize,
        // Both default on. A host turning one off is saying where files may
        // come from, not that uploading is off, which is `upload` absent.
        paste: settings.paste !== false,
        drop: settings.drop !== false,

        /** Whether this file is one the host said it would take. */
        accepts: file => matchesAccept(file, accept),

        /** The markdown written once the upload lands. */
        insert: (file, url, alt) => insert(file, url, alt),

        /**
         * The placeholder held in the document while the upload is in flight.
         * Image syntax for an image so the preview does not show a stray link
         * for a second, a link for anything else.
         */
        placeholder: (file, text) => (isImage(file) ? `![${text}]()` : `[${text}]()`),

        /**
         * The whole contract: hand it a file, get back where it was stored.
         * Checks the host's own limits on every path, not just in the modal's
         * file picker, so a pasted screenshot cannot slip past a rule the file
         * dialog enforces.
         */
        upload(file, alt = '', onTick) {
            if (!matchesAccept(file, accept)) {
                return Promise.reject(refusal(
                    label('This file type is not allowed'),
                    `${file.type || 'a file with no type'} is not in accept: ${accept.join(', ')}`,
                ));
            }
            if (file.size > maxSize) {
                return Promise.reject(refusal(
                    label('Maximum file size is {n}').replace('{n}', formatSize(maxSize)),
                    `${file.name || 'the file'} is ${formatSize(file.size)}`,
                ));
            }
            return send(file, alt, onTick);
        },
    };
}

/** `{ image: { fileInput: { uploadUrl, params, accept } } }`, as written before 2.0. */
function legacyFromToolbar(toolbar) {
    const entry = (Array.isArray(toolbar) ? toolbar : [])
        .find(tool => tool && typeof tool === 'object' && tool.image);
    const fileInput = entry?.image?.fileInput;
    if (!fileInput?.uploadUrl) return null;

    return {
        url: fileInput.uploadUrl,
        params: fileInput.params,
        accept: fileInput.accept,
    };
}
