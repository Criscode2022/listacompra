import { escapeHtml, type Scope } from "./domain.mts";

const SCOPE_LABELS: Record<Scope, string> = {
  "tasks:read": "Ver la lista de la compra",
  "tasks:write": "Añadir, editar y borrar productos",
  "users:read": "Ver la cuenta",
  "users:write": "Administrar cuentas",
};

export function loginPage(input: {
  requestId: string;
  clientName: string;
  scopes: Scope[];
  error?: string;
}): string {
  const scopes = input.scopes
    .map((scope) => `<li>${escapeHtml(SCOPE_LABELS[scope] ?? scope)}</li>`)
    .join("");
  const error = input.error
    ? `<p class="error" role="alert">${escapeHtml(input.error)}</p>`
    : "";
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>Autorizar Lista de la compra</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: "Segoe UI", sans-serif; background: #ececf1; color: #1d1d1f; }
    main { max-width: 420px; margin: 48px auto; background: #fff; border-radius: 20px; padding: 28px; box-shadow: 0 10px 30px rgba(0,0,0,.08); }
    h1 { font-size: 1.35rem; margin: 0 0 8px; }
    p, li { line-height: 1.45; }
    label { display: block; font-weight: 650; margin: 14px 0 6px; }
    input { width: 100%; box-sizing: border-box; border: 1px solid #d2d2d7; border-radius: 12px; padding: 12px; font-size: 1rem; }
    button { margin-top: 18px; width: 100%; border: 0; border-radius: 999px; background: #007aff; color: #fff; font-weight: 650; padding: 12px 16px; font-size: 1rem; }
    .error { background: #fff1f0; color: #b42318; border-radius: 12px; padding: 10px 12px; }
    ul { padding-left: 18px; }
  </style>
</head>
<body>
  <main>
    <h1>Autorizar el acceso</h1>
    <p><strong>${escapeHtml(input.clientName)}</strong> quiere usar tu lista de la compra.</p>
    <ul>${scopes}</ul>
    ${error}
    <form method="post" action="/authorize">
      <input type="hidden" name="request_id" value="${escapeHtml(input.requestId)}">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="username" required>
      <label for="password">Contraseña</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <button type="submit">Permitir acceso</button>
    </form>
  </main>
</body>
</html>`;
}

export function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>No se pudo autorizar</title>
</head>
<body>
  <main>
    <h1>No se pudo autorizar</h1>
    <p>${escapeHtml(message)}</p>
  </main>
</body>
</html>`;
}
