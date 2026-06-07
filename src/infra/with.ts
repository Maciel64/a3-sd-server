export async function withRetry<T>(
	fn: () => T,
	options?: { maxRetry?: number },
) {
	const maxRetry = options?.maxRetry || 3;

	let i = 0;
	while (i < maxRetry) {
		try {
			return await fn();
		} catch (_e) {
			i++;
		}
	}

	throw new Error("Max retry reached");
}

export async function withTimeout<T>(
	fn: (signal: AbortSignal) => T,
	options?: { timeoutMs?: number },
) {
	const controller = new AbortController();

	const timeout = setTimeout(() => {
		controller.abort();
		throw new Error("Timeout reached");
	}, options?.timeoutMs || 5000);

	try {
		return await fn(controller.signal);
	} finally {
		clearTimeout(timeout);
	}
}
