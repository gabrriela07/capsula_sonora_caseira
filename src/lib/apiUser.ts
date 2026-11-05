/**
 * Usuário dinâmico do Last.fm.
 *
 * Ordem de prioridade:
 *   1) ?user=nome na URL (é salvo para as próximas visitas)
 *   2) usuário salvo no navegador
 *   3) LASTFM_USER padrão do servidor (quando definido)
 *
 * Ao ser importado, este módulo acrescenta ?user= automaticamente em todas as
 * chamadas para /api/, sem precisar alterar o restante do código.
 */
const STORAGE_KEY = 'capsula:lastfm:user';
const VALIDO = /^[a-z0-9_-]{2,32}$/;

export const normalizarUsuario = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();

function lerDaUrl(): string {
  return normalizarUsuario(new URLSearchParams(window.location.search).get('user'));
}

export function getLastFmUser(): string {
  const daUrl = lerDaUrl();
  if (VALIDO.test(daUrl)) {
    try { localStorage.setItem(STORAGE_KEY, daUrl); } catch { /* sem localStorage */ }
    return daUrl;
  }
  try {
    const salvo = normalizarUsuario(localStorage.getItem(STORAGE_KEY));
    return VALIDO.test(salvo) ? salvo : '';
  } catch {
    return '';
  }
}

/** Troca o usuário, atualiza a URL (link compartilhável) e recarrega a página. */
export function setLastFmUser(user: string): boolean {
  const novo = normalizarUsuario(user);
  if (!VALIDO.test(novo)) return false;
  try { localStorage.setItem(STORAGE_KEY, novo); } catch { /* sem localStorage */ }
  const url = new URL(window.location.href);
  url.searchParams.set('user', novo);
  window.location.assign(url.toString());
  return true;
}

/** Remove o usuário salvo e volta para o padrão do servidor. */
export function clearLastFmUser() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* sem localStorage */ }
  const url = new URL(window.location.href);
  url.searchParams.delete('user');
  window.location.assign(url.toString());
}

/** Link para compartilhar a cápsula do usuário atual. */
export function shareLink(user = getLastFmUser()): string {
  const url = new URL(window.location.origin + window.location.pathname);
  if (user) url.searchParams.set('user', user);
  return url.toString();
}

function comUsuario(url: URL): URL {
  const user = getLastFmUser();
  if (user && url.origin === window.location.origin && url.pathname.startsWith('/api/') && !url.searchParams.has('user')) {
    url.searchParams.set('user', user);
  }
  return url;
}

// Intercepta fetch uma única vez
const marcador = '__capsulaUserFetch';
const janela = window as unknown as Record<string, unknown>;
if (!janela[marcador]) {
  janela[marcador] = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      if (input instanceof Request) {
        const url = comUsuario(new URL(input.url, window.location.href));
        return original(url.toString() === input.url ? input : new Request(url.toString(), input), init);
      }
      const url = comUsuario(new URL(String(input), window.location.href));
      return original(url.toString(), init);
    } catch {
      return original(input, init);
    }
  };
}
