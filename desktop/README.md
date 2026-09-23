# Wyst Pass, the desktop app

Tauri 2 with a Rust shell and a Vite plus React front, and the front reuses the shared code of the repository, `src/lib/pass` for the crypto, the TOTP codes and the service detection, `src/components/pass` for the vault itself, plus the translations and the API client, all reached through the `@` alias that points at `../src`

Three screens:

- **First launch wizard**, in the spirit of the BetterDiscord installer, welcome and terms, sign in to the account, options for start with the system and live in the tray, then the install with its progress bar and its log
- **Sign in** when the session is gone
- **The vault**, the same `PassWorkspace` the web dashboard uses, with the account menu for settings, site and sign out

**Notifications** live in `src-tauri/src/notify.rs` and `notification.html`, a window of our own at the bottom right of the main screen, transparent, always on top, never stealing the focus, stacking up to three cards with an optional image, a title, a body, an action button, a bar that runs down and a pause while the mouse is over it, together with a soft chime synthesized in WebAudio, and they fire on auto lock, on a launch into the tray, at the end of an install, on a new version and on a session that expired, all of it switchable in the settings of the app

**Offline**, the vault keeps a local copy of what the server last sent, the same encrypted bytes and nothing in clear, in `vault-cache.json` next to the app data, so when the server cannot be reached the master password opens that copy in read only, and the app retries as soon as the window comes back

**The native side** in `src-tauri/src/lib.rs` is a borderless window with our own title bar, a tray icon with open, lock and quit, a close button that hides when the option is on, a single instance guard, and a start with the system that passes `--minimized`

## Requirements

- Node 20 or newer
- Rust stable from https://rustup.rs
- Windows, Visual Studio Build Tools with the C++ workload
- macOS, Xcode Command Line Tools through `xcode-select --install`

The full list is at https://v2.tauri.app/start/prerequisites/

## Running in dev

```bash
npm install
npm run icons
npm run app:dev
```

`npm run icons` only has to run once, it generates `src-tauri/icons` from `app-icon.png`, and in dev the app talks to `http://localhost:3001` and expects the server to accept the origin `http://localhost:1420`

## Building the installer

```bash
VITE_API_URL=https://api.example.com VITE_WEB_URL=https://example.com npm run app:build
```

On Windows **the installer is the app**, the same idea as the BetterDiscord installer, the build writes `src-tauri/target/release/setup/Wyst Pass Setup.exe`, and that single file run from anywhere shows the wizard, copies itself into `%LOCALAPPDATA%\Programs\Wyst Pass`, creates the Start menu and desktop shortcuts, registers itself in the installed applications list, sets the start with the system if asked, then chains the sign in and the options before launching the installed copy, and uninstalling from the applications list opens the same window again with `--uninstall`, everything sitting in `src-tauri/src/setup.rs` and none of it asking for administrator rights, WebView2 being the only thing that has to be there already, which it is on an up to date Windows 10 or 11

On macOS, `npm run app:build:mac` produces `Wyst Pass.app` and the DMG in `src-tauri/target/release/bundle/`

Signing is not wired in, `bundle.windows.certificateThumbprint` means nothing without a bundle, so sign the exe with `signtool` after the build, and use `bundle.macOS.signingIdentity` on macOS, see https://v2.tauri.app/distribute/

## Releasing

Keep the same version in `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`, publish the files wherever you host them, and the title bar of the app shows an update notice as soon as the server announces a newer version than the one running
