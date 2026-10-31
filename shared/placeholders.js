window.CICOPlaceholders = (() => {
    function missing(value) {
        return value === null || value === undefined || /^[\s—–-]*$/.test(String(value));
    }

    function toggle(element, empty) {
        element.classList.toggle('is-placeholder', empty);
        if (empty) element.setAttribute('aria-label', 'Not available');
        else element.removeAttribute('aria-label');
    }

    function set(element, value) {
        const empty = missing(value);
        const text = empty ? '' : String(value);
        const changed = element.textContent !== text || element.classList.contains('is-placeholder') !== empty;
        if (element.textContent !== text) element.textContent = text;
        toggle(element, empty);
        return changed;
    }

    for (const element of document.querySelectorAll('#overlay *')) {
        if (!element.children.length && element.textContent.trim() && missing(element.textContent)) set(element, null);
    }

    return { set, toggle };
})();
