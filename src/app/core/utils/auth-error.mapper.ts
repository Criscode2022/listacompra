export interface AuthErrorLike {
  code?: string;
  message?: string;
  status?: number;
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'Email o contraseña incorrectos',
  INVALID_PASSWORD: 'Contraseña incorrecta',
  INVALID_EMAIL: 'Email no válido',
  USER_NOT_FOUND: 'Usuario no encontrado',
  USER_ALREADY_EXISTS: 'Ya existe una cuenta con este email',
  EMAIL_NOT_VERIFIED: 'Debes verificar tu email antes de iniciar sesión',
  PASSWORD_TOO_SHORT: 'La contraseña debe tener al menos 8 caracteres',
  PASSWORD_TOO_LONG: 'La contraseña no cumple los requisitos',
  TOO_MANY_REQUESTS: 'Demasiados intentos. Espera un momento e inténtalo de nuevo',
  invalid_credentials: 'Email o contraseña incorrectos',
  user_already_exists: 'Ya existe una cuenta con este email',
  email_exists: 'Ya existe una cuenta con este email',
  email_address_invalid: 'Email no válido',
  weak_password: 'La contraseña debe tener al menos 8 caracteres',
  user_not_found: 'Usuario no encontrado',
  email_not_confirmed: 'Debes verificar tu email antes de iniciar sesión',
  over_request_rate_limit: 'Demasiados intentos. Espera un momento e inténtalo de nuevo',
  session_expired: 'Tu sesión ha expirado. Inicia sesión de nuevo',
  session_not_found: 'No hay sesión activa',
};

const MESSAGE_FALLBACKS: [RegExp, string][] = [
  [/invalid email or password/i, 'Email o contraseña incorrectos'],
  [/invalid login|incorrect|wrong password/i, 'Email o contraseña incorrectos'],
  [/user already exists|already registered/i, 'Ya existe una cuenta con este email'],
  [/email already|email exists/i, 'Ya existe una cuenta con este email'],
  [/invalid email/i, 'Email no válido'],
  [/password.*(short|weak|requirements)/i, 'La contraseña debe tener al menos 8 caracteres'],
  [/too many|rate limit/i, 'Demasiados intentos. Espera un momento e inténtalo de nuevo'],
  [/email not confirmed|email verification/i, 'Debes verificar tu email antes de iniciar sesión'],
  [/user not found/i, 'Usuario no encontrado'],
];

function lookupCode(code: string): string | undefined {
  if (AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code];
  const upper = code.toUpperCase();
  if (AUTH_ERROR_MESSAGES[upper]) return AUTH_ERROR_MESSAGES[upper];
  const snake = code.toLowerCase().replace(/-/g, '_');
  if (AUTH_ERROR_MESSAGES[snake]) return AUTH_ERROR_MESSAGES[snake];
  return undefined;
}

function extractAuthError(error: unknown): AuthErrorLike {
  if (!error) return {};
  if (typeof error === 'string') return { message: error };

  if (error instanceof Error) {
    const e = error as Error & { code?: string; status?: number };
    return { code: e.code, message: e.message, status: e.status };
  }

  if (typeof error === 'object') {
    const e = error as Record<string, unknown>;
    let code = typeof e['code'] === 'string' ? e['code'] : undefined;
    let message = typeof e['message'] === 'string' ? e['message'] : undefined;
    let status = typeof e['status'] === 'number' ? e['status'] : undefined;

    const body = e['body'];
    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>;
      code = code ?? (typeof b['code'] === 'string' ? b['code'] : undefined);
      message = message ?? (typeof b['message'] === 'string' ? b['message'] : undefined);
    }

    return { code, message, status };
  }

  return {};
}

export function getAuthErrorMessage(error: unknown): string {
  const parsed = extractAuthError(error);

  if (parsed.code) {
    const message = lookupCode(parsed.code);
    if (message) return message;
  }

  if (parsed.status === 401) {
    return 'Email o contraseña incorrectos';
  }

  const msg = parsed.message ?? '';
  for (const [pattern, message] of MESSAGE_FALLBACKS) {
    if (pattern.test(msg)) return message;
  }

  return 'No se pudo completar la autenticación. Inténtalo de nuevo';
}
