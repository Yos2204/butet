# Butet (standalone app)

A voice assistant with a talking holographic face, powered by the Claude API. It installs to a phone's home screen.

## What it does

- Say "Butet" (WAKE mode) or tap the face, then talk. Butet answers out loud while its face lip-syncs.
- Claude is the brain (Haiku 5.5 by default, Sonnet 5.5 with "Smarter answers"), reached through Puter.js. Butet can set timers, save notes, and read the time and battery.
- Settings, notes and chat history stay on the phone.

## What you need

- A free Puter account (https://puter.com). Tap Sign in under Settings. Puter's user-pays model gives each account a free monthly allowance, so there is no API key and no bill. If the allowance runs out, it refills next month.
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
- Messages go to Claude through Puter's servers.
- No web search in the free version, so no live news or weather.

## Files

- `index.html`: layout and styles
- `app.js`: voice in/out, wake word, Claude API calls, tools
- `avatar.js`: the animated face
- `sw.js`, `manifest.webmanifest`, `icon*`: install-to-home-screen support
