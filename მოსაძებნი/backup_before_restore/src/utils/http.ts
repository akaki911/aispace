
/**
 * Fetch wrapper that always includes credentials for API calls
 */
export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { 
    credentials: 'include', 
    ...init 
  });
}

/**
 * JSON fetch wrapper
 */
export async function apiJson<T = any>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(input, {
    headers: {
      'Content-Type': 'application/json',
      ...init.headers
    },
    ...init
  });
  
  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}
