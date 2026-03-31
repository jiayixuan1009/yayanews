function getAdminToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('admin_token') || '';
}

export function setAdminToken(token: string) {
  localStorage.setItem('admin_token', token);
}

export async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAdminToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // All API calls need to be prefixed with the Next.js basePath '/admin' so nginx routes
  // them to location /admin → port 3003, and the admin server (basePath=/admin) can find them.
  // CORRECT: /api/admin/pipeline → /admin/api/admin/pipeline
  // WRONG:   /api/admin/pipeline → /admin/api/pipeline (drops the 'admin' segment)
  let finalUrl = url;
  if (finalUrl.startsWith('/api/')) {
    finalUrl = '/admin' + finalUrl;
  }
  
  return fetch(finalUrl, { ...options, headers });
}
