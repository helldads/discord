export const command = {
	name: 'help',
	description: 'Get information about Dadbot commands and server tips',
};

export async function handler(interaction, env, ctx) {
	const cod = env.HELLDADS_CODE_OF_CONDUCT;
	const lines = [
		"**Welcome to HellDads! Here's how to get started:**",
		'',
		'• <#1301288282616758363> – Learn our rules and [Code of Conduct](' + cod + ').',
		"• <#1301285072896266254> – Introduce yourself and check what's going on.",
		'• <#1309187415487025262> – Grab roles like **LFG** to dive with other dads.',
		'• <#1301290839661875202> – Find teammates for your next dive.',
		'• <#1362454651714277376> – Try new loadouts and get inspirantion for your own.',
		'• <#1310726352747630642> & <#1310723505553277028> – Community challenges and rewards.',
		'• <#1345040640949489674> – Join a sub-faction for future events.',
		'• <#1301285073496182865> – Share and enjoy clips and highlights.',
		'• <#1308493598203052155> – Stay updated on all community related things.',
		'',
		'This bot also supports helpful commands:',
		'• `/modhelp` – Open a private support channel with the mods.',
		'• `/lfg` – Find friends by submitting a looking for group request.',
		'• `/quote` – Get a democratic Helldivers quote.',
		'• `/stats` – Display community statistics.',
		'• `/event` – Display the current event and statistics.',
		'• `/submit` – Submit your mission results for the current community event.',
		'• `/update` – Update your game statistics for the highscores.',
		'• `/highscores` – Display highscores of all HellDads who /update their results.',
		'• `/help` – Show this help message.',
	];

	const message = lines.join('\n');
	return Response.json({
		type: 4,
		data: { content: message, flags: 64 },
	});
}
