/**
 * POSTs an image to the configured endpoint and returns where it was stored.
 *
 * Shared by the image modal and by paste/drop so both speak the same contract:
 * the server receives `image_file` plus any configured params, and answers with
 * { success, image_path, image_alt? }.
 */
export async function uploadImage(file, { uploadUrl, params = {}, alt = '' } = {}) {
    const formData = new FormData();
    formData.append('image_file', file);
    formData.append('image_alt', alt);
    for (const [key, value] of Object.entries(params)) {
        formData.append(key, value);
    }

    const res = await fetch(uploadUrl, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);

    const result = await res.json();
    if (!result.success || !result.image_path) {
        throw new Error(result.error || result.message || 'Image upload failed.');
    }

    return { path: result.image_path, alt: result.image_alt || '' };
}
