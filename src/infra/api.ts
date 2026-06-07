export const shotApi = <T>(path: string, options?: RequestInit) =>
	fetch(`${process.env.SHOT_API_URL}${path}`, options).then(async (r) => {
		const res = (await r.json()) as T;

		if (!r.ok) throw new Error(JSON.stringify(res));

		return res;
	});

export const microApi = <T>(path: string, options?: RequestInit) =>
	fetch(`${path}`, options).then((r) => r.json() as T);
