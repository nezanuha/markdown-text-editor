export function getTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');

    // Use existing data-theme if set, otherwise fallback to system preference
    if (!currentTheme || currentTheme === "") {
        const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        return isDarkMode ? 'dark' : 'light'
    }
    return currentTheme;
}