/** Missing tokens are accepted only when the server explicitly advertises open access. */
export async function canOpenViewer(token: string, request: typeof fetch = fetch): Promise<boolean> {
  if (token) return true; // The server still verifies it on every protected endpoint.
  const response = await request('/api/auth', { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not read server access settings');
  const mode: unknown = await response.json();
  return typeof mode === 'object' && mode !== null && 'required' in mode && mode.required === false;
}
