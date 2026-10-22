# Gugah! (youth sermon games)

Live polls, quizzes, word clouds, a verse puzzle, a team tap race, anonymous questions and private prayer requests for the weekly youth sermon. Made for HKBP youth: Bahasa Indonesia, Batak Toba and English.

Live at https://yos2204.github.io/butet/youth/

## How it works

- The teacher opens Gugah! on a laptop connected to the projector and presses Present. The big screen shows a QR code and a 4-letter room code.
- Youth scan the code with their phones (no app, no account) and pick a nickname, or a random funny one.
- The teacher moves through the session with the arrow keys or a clicker. Answers, votes and reactions appear live on the big screen.
- Jarvis (the voice assistant in this repo) can host: turn on 🤖 Jarvis on the stage and it reads questions, greets players, announces answers and winners, and can answer anonymous questions aloud (needs a Claude API key).
- At the end, "End session and save results" downloads every answer, question and prayer request as a text file.

## Weekly workflow

Open "The weekly plan for teachers" on the home screen. In short: pick the passage, let Claude draft the session from your notes ("Make one from my sermon") or start from a ready-made one, share the link with the other teachers, present on Sunday, follow up on the questions and prayer requests during the week.

## Technical notes

- Phones talk to the teacher's browser directly over WebRTC using PeerJS (free public signalling server 0.peerjs.com, with its TURN relay). There is no server of our own and nothing is stored online.
- Sessions are saved in the teacher's browser. "Share" puts the whole session inside a link (#k=...). Another app on this site can hand over a session file with `?kit=path/to/file.json`.
- Session JSON: `{"title","verse","date","acts":[...]}`; activity types: slide, poll, quiz, words, scale, open, verse, tap, qa, prayer, board (see `kits.js` for examples).
- Batak Toba strings in `i18n.js` should be checked by a native speaker.
