export const shotApi = <T>(path: string, options?: RequestInit) =>
  fetch(`${process.env.SHOT_API_URL}${path}`, options).then(r => r.json() as T);

export const microApi = <T>(path: string, options?: RequestInit) =>
  fetch(`${process.env.SHOT_API_URL}${path}`, options).then(r => r.json() as T);
