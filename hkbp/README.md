# Sada HKBPS (HKBP Singapore church app)

One installable phone app (iPhone and Android) for the whole congregation, in Bahasa Indonesia, Batak Toba and English.
Live at https://yos2204.github.io/butet/hkbp/ once merged to main. Try it with sample data: `https://yos2204.github.io/butet/hkbp/?demo=1`
(demo logins 80000001 to 80000009, password `demo`; demo data stays on that phone only).

## What is in it

- **Categorial groups (sermonic):** Sunday School, Youth (Naposobulung), Mothers (Ina), Fathers (Ama), Sailors & Workers. Same format for each (Materials, News, Events, Members) with its own colour, icon and verse. Members read; the chair reads and updates.
- **Natal Naposo on the Youth page:** a card opens the youth Christmas app (`../natal/`: Advent, schedule, evening programme, Kado Silang, quiz, Batak words) inside the app. Teachers and Teacher Makers also get the live Christmas quiz for the projector (Gugah).
- **Warta sections:** the Tata Ibadah header and the Reflection each have one upload button that fills every field in that section; the Reflection can also be filled from the daily bread.
- **Berita Pelayanan:** the Home card (#/berita). Only the Secretary (and the admin) posts it, by uploading a Word, PDF or Excel file or an online link; the text can be checked before saving. Stored in hk_updates with kind `berita`, and the Warta fills its Berita Pelayanan section from it. Elders' updates stay under Kabar Parhalado.
- **Warta Keuangan (Treasurer):** a fill-in form laid out like the 18 Oct Warta (A. Persembahan, B. Persembahan Bulanan, C. Dana Pembangunan Gereja). Each offering has one or more currency rows (any ISO code, searchable picker, amount box), rows and sections can be added or removed, and empty parts print as -. The Treasurer has no generic file upload.
- **Guides:** picture guides for the Secretary, Treasurer and Chairman are in the project files (hkbp-singapore/guides). The demo data makes 80000002 Chairman, 80000003 Secretary and 80000004 Treasurer, so the guides can be re-shot.
- **Warta service times:** default 13.30 - 15.30; start and end are picked from a list or typed.
- **Service sections (non-sermonic):** Multimedia, Congregation, Elders & Pastor (Parhalado), Band, Song Leader, Musicians, plus any the admin adds. Each has a monthly roster: upload .docx, .doc, .pdf, .xlsx, .xls, .csv, a photo, or an online Excel / Google Sheets link. The app reads the table, highlights the signed-in member's name and lists "My duties" on the home screen. The section chair uploads; everyone can read.
- **Member list upload (admin / maker):** Excel or CSV with Name, Nickname, Date of Birth, Phone (Singapore), Password, Groups, Chair of, Admin, WhatsApp. Download the template in the app (More, Members & birthdays). Uploading again updates people by phone number. Passwords are stored hashed.
- **Daily Bread:** elders and the pastor write it, or let Claude draft it (key in Settings, or automatically by the server job). Share to WhatsApp in one tap.
- **Birthdays:** shown to everyone; the birthday person gets a personal notification.
- **Elders' updates:** posts from the Parhalado, for the whole congregation or elders only, with pinning.
- **Calendar:** church and group events with reminders, "add to phone calendar" (.ics with alarm) and Google Calendar links.

## Roles

| Who | Can |
|---|---|
| Anyone (not signed in) | Daily bread, church-wide updates and events, Tata Ibadah and service rosters. Opening a category or the office asks for phone number and password |
| Member | Read their own groups, all service rosters, daily bread, updates, events, birthdays |
| Chair of a group or section | The above, plus add and change that group's materials, news, events and rosters; sees phone numbers of that group |
| Elder / pastor (member of Parhalado) | Read every group, write daily bread and elders' updates, add church-wide events |
| Admin (maker) | Everything, including uploading the member list and adding sections |
| Teacher Maker (Youth, Sunday School) | Posts materials, news, events and polls in that class and adds teachers (phone checked once per session). Starting Makers: Sunday School = YB, Dien Pasaribu; Youth = YB, Richard Siburian, St. Royen Gultom |
| Teacher (Youth, Sunday School) | Reads everything in the class and starts or ends polls. In these two classes the chair no longer posts |

## Going live (free, about 20 minutes)

Until step 2 is done the app runs in demo mode, with data only on each phone.

1. **Database:** create a free project at https://supabase.com (region: Singapore). Open SQL Editor, paste all of `backend/schema.sql`, Run. Then run
   `select hk_make_admin('Your Name', '8xxxxxxx', 'a-strong-password');`
   Use a new, empty Supabase project: the script locks all functions in it except the app's own.
2. **Connect the app:** Supabase, Project Settings, API. Put the Project URL and the `anon public` key into `config.js` (both are public by design). Never put the `service_role` key in the app.
3. **Phone notifications:** create a VAPID key pair (`npx web-push generate-vapid-keys`). Public key into `config.js` (`vapidPublicKey`).
4. **Notifications:** the Supabase Edge Function `hkbp-notify` (backend/edge/hkbp-notify/index.ts) runs every 15 minutes from the database (pg_cron). Its push keys and cron key are created on the server; the admin saves the Claude API key in the app's daily bread setup. Nothing to set up in GitHub.
5. Sign in as the admin, upload the member list, and share the link. Members install it to the home screen and tap "Turn on notifications".

## Notifications and WhatsApp

- **Phone:** daily bread at 06:00 Singapore time, birthday wish at 08:00 (only to the birthday person), event reminders at each event's reminder time, and announcements posted with "send a notification". iPhone needs iOS 16.4+ and the app added to the home screen first. GitHub can delay scheduled runs by a few minutes, and pauses them after 60 days without repo activity (re-enable in the Actions tab).
- **WhatsApp, free:** every daily bread, post and event has a WhatsApp button that opens WhatsApp with the text ready, so a chair can send it to the church group in one tap.
- **WhatsApp, automatic (optional, paid):** WhatsApp does not allow apps to post into groups. Automatic sending to individual members who opted in needs the WhatsApp Business Cloud API: a Meta Business account, a phone number not used on normal WhatsApp, an approved message template with one `{{1}}` body text, and a small fee per message. Then add `WA_TOKEN`, `WA_PHONE_ID`, `WA_TEMPLATE` secrets and the job sends the daily bread to every member marked "WhatsApp: Yes".

## Files

`index.html` (layout and styles), `app.js` (screens), `store.js` (data: demo or Supabase), `parse.js` (file readers, loaded from cdnjs when needed), `i18n.js` (texts), `config.js` (settings), `sw.js` (offline and push), `backend/` (database and notification job).
After changes, bump `?v=` in `index.html` and `CACHE` in `sw.js`.

## Notes

- The app uses the official HKBP logo (`logo.png`, from YB). Home-screen icons are the logo on white (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`).
- Personal data (birthdays, phone numbers) lives only in the church's Supabase database, never in this public repository. Members should agree to their data being used (PDPA).
- Batak Toba texts in `i18n.js` should be checked by a fluent elder; missing Batak texts fall back to English.

## Secretary, Treasurer and Chairman

Private categories: only the office holders (added by the admin by phone number in the app) and the admin see them, enforced in the database (`hk__office`, `hk__sees`). Opening one asks for the phone number once per session. Holders upload files (up to 10 MB, `hk_files`) and share them to WhatsApp through a pop-up.

The Treasurer writes the weekly Warta Keuangan. The Secretary's Warta Jemaat builder (`#/warta`) fills in birthdays, finance, the Tata Ibadah theme, the service team (last week's next-Sunday column plus rosters), elders' updates and calendar events, carries the organisation list and offering info from the previous Warta, and makes a 2-page A4 landscape PDF (html2canvas + jsPDF, loaded on demand) that is saved in the Secretary files and shared to WhatsApp.

## Warta Jemaat builder (Secretary)

- The PDF copies the secretary's Word layout (A4 landscape, Arial Narrow, letterhead art in `warta/`, fonts in `fonts/`).
- Preview shows the real PDF pages.
- Every field has an upload button (.docx, .doc, .pdf, .xlsx, .xls or an online link). "Upload all relevant files from a folder" reads many files at once, fills each part it recognises and opens the preview.
- Weekly roster: paste the Google Sheets link once in "Service team"; each week the jobs for this and next Sunday are read from it.
- The cover reflection is filled from the daily bread of that Sunday.
- Warta Keuangan is typed by the treasurer only (parts A, B and C). The PDF cannot be made until it is in; the treasurer sees a reminder on the home page.
