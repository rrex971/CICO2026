window.CICOMatchView = (() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const ease = 'cubic-bezier(.16, 1, .3, 1)';
    const node = (tag, className, text) => {
        const element = document.createElement(tag);
        element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    };
    const setText = (element, text) => { if (element.textContent !== String(text)) element.textContent = text; };
    const number = value => value === null || value === undefined ? '—' : Number(Number(value).toFixed(2)).toString();

    function header(title, round) {
        const element = node('header', 'header match-header');
        element.setAttribute('aria-label', title);
        element.innerHTML = '<div class="brand" role="img" aria-label="CICO 2026"><img class="mascot" src="../assets/chibi-mascot.png" alt="" draggable="false"><div class="wordmark"><span>CICO</span><small>2026</small></div></div><div class="round-heading"><div id="round"></div></div>';
        setText(element.querySelector('#round'), round);
        element.querySelector('#round').classList.toggle('long-round', round.length > 17);
        return element;
    }

    function playerPanel(side, dispatch) {
        const element = node('section', `player-panel panel side-${side}`);
        element.innerHTML = '<div class="player-avatar"><span class="candy-mark"></span><img alt=""></div><div class="player-copy"><div class="player-name-row"><img class="player-flag" alt=""><span class="player-name">—</span></div><div class="player-bottom"><div class="points"></div></div></div><div class="player-ban"><div class="ban-heading"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="m6 6 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg><span>BAN</span></div><strong class="ban-pick">—</strong></div>';
        const points = element.querySelector('.points');
        for (let index = 0; index < Math.ceil(CICO2026.match.bestOf / 2); index++) {
            const button = node('button', 'candy-point');
            button.type = 'button';
            button.setAttribute('aria-label', `Player ${side + 1}: ${index + 1} points`);
            button.addEventListener('click', event => dispatch({ type: 'points', side, value: event.ctrlKey ? null : index + 1 }));
            button.addEventListener('contextmenu', event => { event.preventDefault(); dispatch({ type: 'points', side, value: event.ctrlKey ? null : index }); });
            points.append(button);
        }
        element.querySelector('.player-avatar img').addEventListener('error', event => { event.target.hidden = true; });
        return element;
    }

    function updatePlayer(element, player, points, ban) {
        const image = element.querySelector('.player-avatar img');
        const id = player?.id > 0 ? String(player.id) : '';
        if (image.dataset.user !== id) {
            image.dataset.user = id;
            image.hidden = !id;
            if (id) image.src = `https://a.ppy.sh/${id}`;
        }
        const flag = element.querySelector('.player-flag');
        const country = /^[A-Z]{2}$/.test(player?.country || '') ? player.country : '';
        if (flag.dataset.country !== country) {
            flag.dataset.country = country;
            flag.hidden = !country;
            if (country) flag.src = `https://osu.ppy.sh/assets/images/flags/${[...country].map(char => (char.charCodeAt(0) + 127397).toString(16)).join('-')}.svg`;
            flag.onerror = () => { flag.onerror = null; flag.src = `https://assets.ppy.sh/old-flags/${country}.png`; };
        }
        setText(element.querySelector('.player-name'), player?.name || '—');
        element.querySelectorAll('.candy-point').forEach((button, index) => {
            const earned = points.value !== null && index < points.value;
            if (button.wasEarned !== undefined && button.wasEarned !== earned && !reduced.matches) {
                button.pointAnimation?.cancel();
                const mirror = element.classList.contains('side-1') ? -1 : 1;
                button.pointAnimation = button.animate([
                    { transform: `scale(${mirror * .85}, .85)`, filter: 'blur(2px)', opacity: .4 },
                    { transform: `scale(${mirror}, 1)`, filter: 'blur(0)', opacity: 1 }
                ], { duration: 360, delay: index * 25, easing: ease });
            }
            button.wasEarned = earned;
            button.classList.toggle('earned', earned);
            button.setAttribute('aria-pressed', String(points.value !== null && index < points.value));
        });
        const banPick = element.querySelector('.ban-pick');
        const banText = ban?.slot || '—';
        if (element.banText !== undefined && element.banText !== banText && !reduced.matches) {
            banPick.getAnimations().forEach(animation => animation.cancel());
            const direction = element.classList.contains('side-1') ? -1 : 1;
            banPick.animate([{ transform: `translateX(${direction * 8}px)`, filter: 'blur(3px)', opacity: .2 }, { transform: 'translateX(0)', filter: 'blur(0)', opacity: 1 }], { duration: 320, easing: ease });
        }
        element.banText = banText;
        setText(banPick, banText);
    }

    function mapPanel() {
        const element = node('aside', 'current-map panel');
        element.innerHTML = '<div class="map-art"><span class="candy-mark"></span><img class="map-image" alt=""><img class="map-image" alt=""><span class="slot-tag">MAP</span><span class="map-tag" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path/></svg><span></span></span></div><div class="current-copy"><div class="map-artist">—</div><div class="map-title-window"><div class="map-title">—</div></div><div class="map-difficulty">—</div><div class="map-mapper"><span>MAPPED BY</span><strong>—</strong></div></div><div class="map-stat-grid"></div>';
        for (const [key, label] of [['sr', '★ STAR RATING'], ['cs', 'CS'], ['ar', 'AR'], ['od', 'OD'], ['hp', 'HP'], ['bpm', 'BPM'], ['length', 'LENGTH']]) {
            const stat = node('div', `map-stat${key === 'sr' ? ' star' : ''}`);
            stat.dataset.stat = key;
            stat.append(node('span', '', label), node('strong', '', '—'));
            element.querySelector('.map-stat-grid').append(stat);
        }
        return element;
    }

    function badgeIcon(path, type) {
        const original = type === 'original';
        path.setAttribute('d', original ? 'm4 12 5 5L20 6' : 'm16.6 2.6 4.8 4.8-2.3 2.3-4.8-4.8Zm-3.5 3.5 4.8 4.8-10.1 10.1L2 22l1-5.8Z');
        path.setAttribute('fill', original ? 'none' : 'currentColor');
        path.setAttribute('stroke', original ? 'currentColor' : 'none');
        path.setAttribute('stroke-width', '3');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
    }

    function updateMap(element, map) {
        const value = map || { slot: 'MAP' };
        const signature = JSON.stringify(value);
        if (element.mapSignature === signature) return;
        element.mapSignature = signature;
        const copy = element.querySelector('.current-copy');
        copy.getAnimations().forEach(animation => animation.cancel());
        setText(copy.querySelector('.map-artist'), value.artist || '—');
        setText(copy.querySelector('.map-title'), value.title || '—');
        setText(copy.querySelector('.map-difficulty'), CICOMapData.difficultyLabel(value.difficulty));
        setText(copy.querySelector('.map-mapper strong'), value.mapper || '—');
        const mod = String(value.slot).slice(0, 2);
        const slot = element.querySelector('.slot-tag');
        setText(slot, value.slot || 'MAP');
        slot.style.setProperty('--mod-color', CICO2026.modColors[mod] || 'var(--caramel)');
        slot.style.setProperty('--mod-depth', CICO2026.modDepthColors[mod] || 'var(--chocolate)');
        const badge = element.querySelector('.map-tag');
        badge.hidden = !CICOMapData.badgeLabels[value.badgeType];
        badge.dataset.type = value.badgeType || '';
        setText(badge.querySelector('span'), CICOMapData.badgeLabels[value.badgeType] || '');
        badgeIcon(badge.querySelector('path'), value.badgeType);
        for (const stat of element.querySelectorAll('[data-stat]')) {
            const key = stat.dataset.stat;
            const text = key === 'length' ? value.length || '—' : key === 'sr' && CICOMapData.number(value.sr) !== null ? Number(value.sr).toFixed(2) : number(value[key]);
            setText(stat.querySelector('strong'), text);
        }
        const request = (element.coverRequest || 0) + 1;
        element.coverRequest = request;
        const layers = [...element.querySelectorAll('.map-image')];
        if (!value.cover) layers.forEach(layer => layer.classList.remove('active'));
        else if (element.coverUrl !== value.cover) {
            const image = new Image();
            image.onload = () => {
                if (element.coverRequest !== request) return;
                const incoming = layers.find(layer => !layer.classList.contains('active')) || layers[0];
                incoming.src = value.cover;
                incoming.classList.add('active');
                layers.filter(layer => layer !== incoming).forEach(layer => layer.classList.remove('active'));
                element.coverUrl = value.cover;
            };
            image.onerror = () => { if (element.coverRequest === request) { layers.forEach(layer => layer.classList.remove('active')); element.coverUrl = ''; } };
            image.src = value.cover;
        }
        if (!value.cover) element.coverUrl = '';
        if (!reduced.matches) copy.animate([{ opacity: .2, filter: 'blur(3px)', transform: 'translateY(5px)' }, { opacity: 1, filter: 'blur(0)', transform: 'translateY(0)' }], { duration: 260, easing: ease });
        requestAnimationFrame(() => marquee(element.querySelector('.map-title-window')));
    }

    function marquee(viewport) {
        const title = viewport.firstElementChild;
        title.getAnimations().forEach(animation => animation.cancel());
        viewport.classList.remove('scrolling');
        const distance = title.scrollWidth - viewport.clientWidth;
        if (reduced.matches || distance < 2) return;
        viewport.classList.add('scrolling');
        const duration = 3000 + distance / 35 * 2000;
        title.animate([{ transform: 'translateX(0)', offset: 0 }, { transform: 'translateX(0)', offset: .12 }, { transform: `translateX(-${distance + 28}px)`, offset: .5 }, { transform: `translateX(-${distance + 28}px)`, offset: .62 }, { transform: 'translateX(0)', offset: 1 }], { duration, iterations: Infinity });
    }

    function logPanel() {
        const element = node('section', 'pick-log panel');
        element.setAttribute('aria-label', 'Recent picks');
        element.innerHTML = '<div class="log-feed"></div>';
        return element;
    }

    function updateLog(element, actions, maps) {
        const signature = JSON.stringify(actions.filter(action => action.type === 'pick'));
        if (element.logSignature === signature) return;
        element.logSignature = signature;
        const rows = actions.filter(action => action.type === 'pick').slice(-6).reverse().map(action => {
            const row = node('div', `log-chip side-${action.side ?? 'neutral'}`, action.slot);
            row.setAttribute('aria-label', `${action.slot}${action.side === null ? '' : ` picked by Player ${action.side + 1}`}`);
            return row;
        });
        element.querySelector('.log-feed').replaceChildren(...rows);
        if (!rows.length) element.querySelector('.log-feed').append(node('span', 'log-empty', '—'));
        if (rows.length && !reduced.matches) rows[0].animate([{ opacity: 0, transform: 'translateY(-5px)', filter: 'blur(2px)' }, { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }], { duration: 220, easing: ease });
    }

    function chatPanel(label, className) {
        const element = node('section', `match-chat panel ${className}`);
        const heading = node('h2', '', label);
        heading.append(node('span', 'heading-line'));
        const viewport = node('div', 'chat-viewport');
        viewport.append(node('div', 'chat-rows'));
        element.append(heading, viewport);
        return element;
    }

    function appendChat(element, name, message, tags, twitch) {
        const rows = element.querySelector('.chat-rows');
        rows.getAnimations().forEach(animation => animation.cancel());
        const previous = rows.getBoundingClientRect().height;
        const row = node('div', 'chat-line');
        row.append(node('strong', '', name || '—'), document.createTextNode(' '), twitch ? CICOTwitch.fragment(String(message), tags) : document.createTextNode(String(message)));
        rows.append(row);
        while (rows.children.length > 30) rows.firstElementChild.remove();
        if (!reduced.matches) {
            const height = rows.getBoundingClientRect().height;
            const scale = document.querySelector('#overlay').getBoundingClientRect().width / 1920;
            rows.animate([{ transform: `translateY(${Math.max(0, height - previous) / scale}px)` }, { transform: 'translateY(0)' }], { duration: 180, easing: ease });
        }
    }

    function gameChatFeed(element) {
        let chatLength = 0;
        let chatLast = '';
        const key = message => JSON.stringify([message.id ?? message.timestamp ?? '', message.name ?? message.sender ?? '', message.message ?? message.content ?? message.text ?? '']);
        return messages => {
            if (!Array.isArray(messages)) return;
            const last = messages.length ? key(messages.at(-1)) : '';
            if (last === chatLast && messages.length === chatLength) return;
            const appended = chatLength > 0 && messages.length > chatLength && key(messages[chatLength - 1]) === chatLast;
            const previous = appended ? chatLength - 1 : messages.findLastIndex(message => key(message) === chatLast);
            const fresh = chatLast && previous >= 0 ? messages.slice(previous + 1) : messages.slice(-8);
            for (const message of fresh) appendChat(element, message.name || message.sender || message.user || '—', message.message ?? message.content ?? message.text ?? '');
            chatLast = last;
            chatLength = messages.length;
        };
    }

    reduced.addEventListener('change', () => {
        document.getAnimations().forEach(animation => animation.cancel());
        document.querySelectorAll('.map-title-window').forEach(marquee);
    });

    return { node, setText, number, header, playerPanel, updatePlayer, mapPanel, updateMap, badgeIcon, logPanel, updateLog, chatPanel, appendChat, gameChatFeed };
})();
