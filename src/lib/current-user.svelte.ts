import { getCurrentUser } from './admin-api';
import type { CurrentUser } from './admin-types';

class CurrentUserStore {
	user = $state<CurrentUser | null>(null);
	loaded = $state(false);

	async load() {
		try {
			this.user = await getCurrentUser();
		} catch {
			this.user = null;
		} finally {
			this.loaded = true;
		}
	}

	get allowGlobalKeys(): boolean {
		return this.user?.allow_global_keys ?? false;
	}

	get requiresByok(): boolean {
		return this.loaded && !this.allowGlobalKeys;
	}
}

export const currentUser = new CurrentUserStore();
