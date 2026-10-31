for (const type of ['mousedown', 'contextmenu', 'selectstart', 'dragstart']) {
    document.addEventListener(type, event => event.preventDefault());
}
