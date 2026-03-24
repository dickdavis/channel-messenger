const adjectives = [
	'phantom',
	'stellar',
	'quantum',
	'cyber',
	'neon',
	'void',
	'orbital',
	'plasma',
	'shadow',
	'chrome',
	'warp',
	'flux',
	'hyper',
	'dark',
	'zero',
	'ghost',
	'rogue',
	'pulse',
	'nova',
	'static',
	'binary',
	'astral',
	'feral',
	'frozen',
	'silent'
];

const nouns = [
	'nexus',
	'vector',
	'cipher',
	'relay',
	'beacon',
	'cortex',
	'specter',
	'vortex',
	'prism',
	'helix',
	'sentinel',
	'wraith',
	'oracle',
	'drifter',
	'nomad',
	'reaper',
	'shard',
	'signal',
	'surge',
	'glitch',
	'arc',
	'probe',
	'vertex',
	'conduit',
	'revenant'
];

export function generateName(): string {
	const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
	const noun = nouns[Math.floor(Math.random() * nouns.length)];
	return `${adj}-${noun}`;
}
