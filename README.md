# Butet (standalone app)

A voice assistant with a talking holographic face, powered by the Claude API. It installs to a phone's home screen.

## What it does

- Say "Butet" (WAKE mode) or tap the face, then talk. Butet answers out loud while its face lip-syncs.
- Claude Opus 5.5 is the brain. Butet can search the web, set timers, save notes, and read the time, battery, and location.
- Settings, notes and chat history stay on the phone.

## What you need

- A Claude API key from https://console.anthropic.com/settings/keys with some credit on the account. Each question costs about 1 to 2 cents; web searches add a little.
- The app must be served over HTTPS (any static host works: GitHub Pages, Netlify, Cloudflare Pages).
- Microphone permission when the browser asks.

## Hosting

Upload this whole folder as-is to a static host. No build step.

- **GitHub Pages:** put the files at the root of a repository, then Settings → Pages → Deploy from branch → `main` / root.
- **Netlify Drop:** drag this folder onto https://app.netlify.com/drop.

## Install on your phone

Open the link, then use "Add to Home Screen" (Safari share menu on iPhone, or the menu in Chrome on Android).

## Limits

- Web apps can't listen with the screen locked or in the background. WAKE mode keeps the screen on while the app is open.
- On some iPhones, speech recognition doesn't work from the home-screen icon. If the mic does nothing, open the link in Safari instead.
- The API key is stored in the browser on this phone. Don't install it on a shared device.

## Files

- `index.html`: layout and styles
- `app.js`: voice in/out, wake word, Claude API calls, tools
- `avatar.js`: the animated face
- `sw.js`, `manifest.webmanifest`, `icon*`: install-to-home-screen support
