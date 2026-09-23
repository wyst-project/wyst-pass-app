# Wyst Pass for Windows

The desktop app of Wyst Pass, a password manager where the server never sees anything readable

Wyst Pass stores logins, passwords, two factor codes, secure notes and cards, sorted in folders, and the whole vault is encrypted and decrypted on your own machine, the server only ever holds bytes it cannot read

This repository holds the Windows and macOS app and the code it is built on, the server is not part of it, and the app talks to any server that answers the small contract described below

## What is in here

```
src/           the shared front end code, crypto, TOTP, service detection, vault UI, translations
desktop/       the app itself, Tauri 2 with a Rust shell and a React front
```

The app reaches the shared code through the `@` alias, which points at `src`, the same layout the Wyst web dashboard uses, so the vault behaves the same in both places

## How the encryption works

- your master password never leaves the machine and is never sent anywhere
- it derives a wrapping key with PBKDF2 over SHA-256, 600 000 iterations and a 16 byte random salt
- a random AES-256-GCM vault key is generated once, wrapped with that derived key, and only the wrapped form is stored
- every item is encrypted on its own with the vault key, AES-256-GCM with a fresh 12 byte IV
- the server receives the salt, the wrapped key, the iteration count and a list of ciphertexts, nothing else
- two factor secrets live inside the encrypted item, the codes are computed locally, RFC 6238
- if the master password is lost there is no recovery, the vault can only be deleted and started again, which is the point of the design

The whole crypto surface is in [src/lib/pass/crypto.ts](src/lib/pass/crypto.ts), it uses the Web Crypto API and nothing else

## What the app adds on top of the web vault

- **an installer that is the app**, the same single file shows the wizard, installs itself into `%LOCALAPPDATA%`, creates the shortcuts, registers in the installed applications list and uninstalls itself later, no administrator rights anywhere
- **a tray icon** with open, lock and quit, a close button that hides the window when you want it to, and a start with the system that opens minimized
- **notifications of our own**, a transparent window at the bottom right of the main screen, stacking up to three cards with a soft chime, on auto lock, on a launch into the tray, at the end of an install, on a new version and on a session that expired
- **offline access**, the app keeps an encrypted copy of what the server last sent, the same bytes and nothing in clear, so the master password still opens the vault in read only when the server cannot be reached

## Running it

Node 20 or newer, Rust stable from https://rustup.rs, and the Visual Studio Build Tools with the C++ workload on Windows or the Xcode Command Line Tools on macOS, the full list is at https://v2.tauri.app/start/prerequisites/

```bash
cd desktop
npm install
npm run icons
npm run app:dev
```

`npm run icons` only has to run once, it generates the icons from `app-icon.png`, and in dev the app talks to `http://localhost:3001`

Building the installer is `npm run app:build` on Windows and `npm run app:build:mac` on macOS, the details are in [desktop/README.md](desktop/README.md)

## Pointing the app somewhere else

The build freezes the addresses, two variables are enough

| variable | what it is | default |
| --- | --- | --- |
| `VITE_API_URL` | the server the app talks to | `https://api.wyst.lol` |
| `VITE_WEB_URL` | the site the app links to for the account pages | `https://wyst.lol` |

```bash
VITE_API_URL=https://api.example.com VITE_WEB_URL=https://example.com npm run app:build
```

## The server contract

Any server can stand behind this app, it needs to accept a bearer token on `Authorization` and answer these routes, everything encrypted staying opaque to it

| route | what it does |
| --- | --- |
| `POST /api/auth/login` | signs in, may answer that an email code or a 2FA code is needed |
| `POST /api/auth/verify-login-code` | finishes a sign in that asked for the code sent by email |
| `POST /api/auth/2fa/verify-login` | finishes a sign in protected by an authenticator app |
| `GET /api/pass/vault` | returns `{ exists, kdf, salt, iterations, wrappedKey, wrapIv, items }` |
| `POST /api/pass/vault` | stores that material the first time a vault is created |
| `PUT /api/pass/vault/key` | replaces the material when the master password changes |
| `DELETE /api/pass/vault` | destroys the vault, guarded by the account password |
| `GET /api/pass/items` | returns `[{ id, iv, ciphertext, createdAt, updatedAt }]` |
| `POST /api/pass/items` | stores one `{ iv, ciphertext }` and answers with its id |
| `PUT /api/pass/items/:id` | replaces one ciphertext |
| `DELETE /api/pass/items/:id` | removes one item |
| `GET /api/users/id/:id` | the account behind the session, for the avatar and the name |
| `DELETE /api/sessions/:id` | signs the device out |

A server that stores `iv` and `ciphertext` as opaque strings is a valid server, it has no way to read an item and no way to help a user who lost the master password

## Security notes

- the vault key only exists in memory while the app is unlocked, the auto lock delay is a setting and locking wipes it
- the local copy used offline holds the same ciphertexts as the server, it is written encrypted and never in clear
- the app ships no updater key and no telemetry, it talks to the server you point it at and to nothing else
- found something that looks wrong, please read [SECURITY.md](SECURITY.md) before opening a public issue

## Contributing

Issues and pull requests are welcome, the code carries no comments on purpose, so names and structure have to say what happens, and a change is expected to keep `npx tsc --noEmit -p .` clean in `desktop`

## Credits

Built with [Tauri](https://tauri.app), [React](https://react.dev), [Vite](https://vite.dev), [Tailwind CSS](https://tailwindcss.com), [lucide](https://lucide.dev) and [ogl](https://github.com/oframe/ogl), brand marks come from [Simple Icons](https://simpleicons.org), see [NOTICE](NOTICE)

## License

Apache License 2.0, see [LICENSE](LICENSE)
