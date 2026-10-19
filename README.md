# Jarvis (standalone app)

A voice assistant with a talking holographic face, powered by the Claude API. It installs to a phone's home screen.

## What it does

- Say "Jarvis" (WAKE mode) or tap the face, then talk. Jarvis answers out loud while its face lip-syncs.
- Claude is the brain. By default it uses your own Claude API key (Claude Opus 5.5, with web search). A free backup mode runs Claude through a Puter account (no web search).
- Jarvis can set timers, save notes, and read the time, battery and location.
- Settings, notes and chat history stay on the phone.

## Languages

Jarvis only speaks Bahasa Indonesia, Bahasa Batak Toba and English. The ID/EN button sets which language the microphone listens for (ID covers Batak Toba too, since phones have no Batak speech recognition). Replies in Indonesian or Batak Toba are read with the phone's Indonesian voice; English replies use the English voice.

## What you need

- A Claude API key from https://console.anthropic.com/settings/keys with some credit. Paste it in Settings. Each question costs about 1 to 2 cents; web searches add a little.
- Or, for free mode: pick "Free Puter account" under Brain in Settings and tap Sign in. Each Puter account gets a free monthly allowance.
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
- The API key is stored in the browser on this phone only. Don't install it on a shared device.
- In free mode, messages go to Claude through Puter's servers, and there's no web search.

## Files

- `index.html`: layout and styles
- `app.js`: voice in/out, wake word, Claude API calls, tools
- `avatar.js`: the animated face
- `sw.js`, `manifest.webmanifest`, `icon*`: install-to-home-screen support
