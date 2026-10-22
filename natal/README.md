# Natal Naposo (youth Christmas app)

Installable web app for the Naposobulung's Christmas season, in Bahasa Indonesia, Batak Toba and English.
Live at https://yos2204.github.io/butet/natal/ once merged to main.

- **Home:** countdown to the Natal Naposo evening and Christmas, today's Advent door, a three-language greeting to share.
- **Advent:** 25 doors (1 to 25 Dec) with a thought, a Bible link and a daily challenge; ticks and streaks stay on the phone.
- **Schedule:** the season's events; each one can be added to the phone calendar.
- **Programme:** the 19 Dec rundown, plus a full-screen MC screen where a Jarvis-style voice reads each introduction.
- **Kado Silang:** secret gift draw. Each person gets a private link; nobody sees the whole list.
- **Quiz:** solo Christmas quiz, or open `christmas-quiz.json` as a live session in Gugah (`../youth/`).
- **Batak words:** a guess-the-meaning game and word list.

Edit dates, times and all text in `data.js`. After changes, bump `?v=` in `index.html` and `CACHE` in `sw.js`.
Preview a day in Advent with `?today=2026-12-05`. Batak Toba wording should be checked by a fluent elder.
