import { builds } from '../data/builds.js';

export const command = {
	name: 'build',
	description: 'Get a Helldivers loadout from Helldads.',
	options: [
		{
			name: 'name',
			description: 'Choose a specific build (leave empty for a random build)',
			type: 3,
			required: false,
			autocomplete: true,
		},
		{
			name: 'private',
			description: 'Only show the build to you (default: no)',
			type: 5,
			required: false,
		},
	],
};

const findOption = (interaction, name) => interaction.data.options?.find((option) => option.name === name);

export function autocomplete(interaction) {
	const query = String(findOption(interaction, 'name')?.value || '').toLocaleLowerCase();
	const choices = builds
		.filter((build) => build.name.toLocaleLowerCase().includes(query))
		.slice(0, 25)
		.map((build) => ({ name: build.name, value: build.slug }));

	return Response.json({ type: 8, data: { choices } });
}

export async function handler(interaction, env, ctx) {
	const requestedSlug = findOption(interaction, 'name')?.value;
	const isPrivate = findOption(interaction, 'private')?.value === true;
	const requestedBuild = requestedSlug ? builds.find((build) => build.slug === requestedSlug) : null;

	if (requestedSlug && !requestedBuild) {
		return Response.json({
			type: 4,
			data: { content: 'That build is no longer available. Please select another one.', flags: 64 },
		});
	}

	const selectedBuild = requestedBuild || builds[Math.floor(Math.random() * builds.length)];
	const userId = interaction.member?.user?.id || interaction.user?.id;
	const user = userId ? `<@${userId}>` : 'A Helldiver';
	const introduction = requestedBuild
		? `**${user} requested the ${selectedBuild.name}!**`
		: `**${user} rolled a random Helldads build: ${selectedBuild.name}!**`;
	const url = `${env.HELLDADS_BUILDS_URL}/${selectedBuild.slug}`;
	const callToAction = isPrivate ? 'Only you can see this message.' : '_Run `/build` to roll your own._';

	return Response.json({
		type: 4,
		data: {
			content: `${introduction}\n\n${url}\n\n${callToAction}`,
			...(isPrivate ? { flags: 64 } : {}),
		},
	});
}
