window.CICO2026 = {
    round: 'Round of 32',
    defaultRound: 'round-of-32',
    poolSource: '../mappools.json',
    tournamentSource: 'https://wybin.xyz/api/v1/tournament/cico2026',
    seedReveal: { qualifiedSeeds: 32, eliminatedPageSize: 16 },
    startingSoon: { minutes: 5, channel: 'osucatchid', video: '../assets/starting-soon.mp4' },
    match: { bestOf: 9, bans: 1, channel: 'osucatchid', profileSource: '../qualifier-seeds.json', matchSource: '../matches.json' },
    gameplayClients: [
        { x: 32, y: 166, width: 680, height: 510, radius: 14 },
        { x: 744, y: 166, width: 680, height: 510, radius: 14 }
    ],
    maps: [],
    modColors: {
        NM: '#629bc1',
        HD: '#c39d4f',
        HR: '#cc8c6d',
        DT: '#9780bf',
        FM: '#79a68d',
        TB: '#c77d91'
    },
    modDepthColors: {
        NM: '#497a9b',
        HD: '#987735',
        HR: '#a8674e',
        DT: '#725b9a',
        FM: '#558269',
        TB: '#9e5e72'
    },
    client: { x: 32, y: 176, width: 1392, height: 783, radius: 14 },
    caster: { x: 1443, y: 840, width: 455, height: 218 }
};
