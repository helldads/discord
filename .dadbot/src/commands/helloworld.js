export const command = {
	name: 'helloworld',
	description: 'A simple description',
};

export async function handler(interaction, env, ctx) {
	const message = 'Hello world!';

	return Response.json({
		type: 4,
		data: { content: message },
	});
}
