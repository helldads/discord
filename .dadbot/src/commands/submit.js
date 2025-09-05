// Slash command for users to submit their event contributions

export const command = {
	name: 'submit',
	description: 'Submit your mission results for the Operation: LUNGPUNCH.',
	options: [
		{
			name: 'sporelungs',
			description: 'Spore Lungs destroyed',
			type: 4, // INTEGER
			required: false,
		},
		{
			name: 'eggs',
			description: 'Eggs Sites destroyed',
			type: 4, // INTEGER
			required: false,
		},
	],
};

export async function handler(interaction, env, ctx) {
	// Abort if no event is active
	const eventKey = env.HELLDADS_CURRENT_EVENT_KEY;
	if (!eventKey) {
		return Response.json({
			type: 4,
			data: { content: 'No event is currently active.', flags: 64 },
		});
	}

	const options = {};
	for (const opt of interaction.data.options || []) {
		options[opt.name] = opt.value;
	}
	const lungs = options.sporelungs;
	const eggs = options.eggs;

	if (lungs === undefined && eggs === undefined) {
		return Response.json({
			type: 4,
			data: {
				content: 'Error: Provide Spore Lungs or Eggs Sites destroyed.',
				flags: 64,
			},
		});
	}

	const userId = BigInt(interaction.member?.user?.id || interaction.user?.id || 0).toString();
	const username = interaction.member?.user?.username || interaction.user?.username || '';

	const now = new Date().toISOString();

	const columns = ['user', 'name', 'date', 'event_key'];
	const values = [userId, username, now, eventKey];
	if (lungs !== undefined) {
		columns.push('event_spore_lungs_destroyed');
		values.push(parseInt(lungs, 10));
	}
	if (eggs !== undefined) {
		columns.push('event_eggs_destroyed');
		values.push(parseInt(eggs, 10));
	}

	try {
		const placeholders = columns.map(() => '?').join(', ');
		const sql = `INSERT INTO submissions (${columns.join(', ')}) VALUES (${placeholders});`;
		const submission = env.STATISTICS_DB.prepare(sql).bind(...values);
		await env.STATISTICS_DB.batch([submission]);
	} catch (err) {
		console.error('Error writing to database', err);
		return Response.json({
			type: 4,
			data: { content: 'Failed to store data.', flags: 64 },
		});
	}

	let message;
	if (lungs !== undefined && eggs !== undefined) {
		message = `<@${userId}> destroyed ${lungs} Spore Lungs and ${eggs} Eggs Sites.`;
	} else if (lungs !== undefined) {
		message = `<@${userId}> destroyed ${lungs} Spore Lungs.`;
	} else {
		message = `<@${userId}> destroyed ${eggs} Eggs Sites.`;
	}
	return Response.json({
		type: 4,
		data: { content: message },
	});
}
