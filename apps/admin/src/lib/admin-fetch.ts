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
  
  // Smoothly upgrade legacy fetch URLs (/api/admin/*) to the correct basePath URL (/admin/api/*)
  let finalUrl = url;
  if (finalUrl.startsWith('/api/admin/')) {
    finalUrl = finalUrl.replace('/api/admin/', '/admin/api/');
  } else if (finalUrl === '/api/admin') {
    finalUrl = '/admin/api';
  }
  
  return fetch(finalUrl, { ...options, headers });
}
