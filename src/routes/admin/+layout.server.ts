import { redirect } from '@sveltejs/kit';

export const load = ({ locals }) => {
	const { userId } = locals.auth();
	if (!userId) {
		redirect(307, '/sign-in');
	}
	return { userId };
};
