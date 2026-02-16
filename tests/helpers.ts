import { app } from "../src/index";

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

export async function request(path: string, options: RequestOptions = {}) {
  const { method = "GET", body, headers = {} } = options;

  const requestInit: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body) {
    requestInit.body = JSON.stringify(body);
  }

  const response = await app.fetch(
    new Request(`http://localhost${path}`, requestInit)
  );

  const data = await response.json();
  return { status: response.status, data };
}

export const api = {
  get: (path: string) => request(path, { method: "GET" }),
  post: (path: string, body: unknown) => request(path, { method: "POST", body }),
  patch: (path: string, body: unknown) => request(path, { method: "PATCH", body }),
  delete: (path: string) => request(path, { method: "DELETE" }),
};
