export type ToastType = 'success' | 'error';

interface Toast {
	id: number;
	message: string;
	type: ToastType;
}

let nextId = 0;
export let toasts = $state<Toast[]>([]);

export function addToast(message: string, type: ToastType = 'success', duration?: number) {
	const id = nextId++;
	toasts.push({ id, message, type });
	setTimeout(() => removeToast(id), duration ?? (type === 'error' ? 5000 : 3000));
}

export function removeToast(id: number) {
	const idx = toasts.findIndex((t) => t.id === id);
	if (idx !== -1) toasts.splice(idx, 1);
}
