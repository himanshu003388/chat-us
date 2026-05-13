import { createServerClient } from '@supabase/ssr';

interface CookieOptions {
  path?: string;
  expires?: Date;
  domain?: string;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  httpOnly?: boolean;
}

export const supabaseClient = (context: { request: { headers: { get: (key: string) => string | null } }; cookies: { set: (name: string, value: string, options?: CookieOptions) => void } }) => {
  return createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          const cookieHeader = context.request.headers.get('Cookie') ?? '';
          return parseCookieHeader(cookieHeader);
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            context.cookies.set(name, value, options)
          );
        },
      },
    }
  );
};

function parseCookieHeader(cookieHeader: string): Array<{ name: string; value: string }> {
  if (!cookieHeader) return [];
  return cookieHeader.split(';').map(cookie => {
    const [name, ...rest] = cookie.split('=');
    return { name: name?.trim() ?? '', value: rest.join('=').trim() };
  });
}