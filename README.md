# Home Dojo

A family points app for good behaviour. Each child has a monster that grows as they earn points. Points can be spent on monster outfits and real-world treats, and big reward goals unlock at points milestones.

It installs to the home screen of any phone or tablet. Everyone in the family sees the same points, live. It keeps working without wifi and syncs when it's back online.

## What's in it

- **Earn:** one-tap behaviour buttons with a chime and confetti.
- **Shop:** spend points on pets, hats, accessories, skins, backgrounds, house upgrades, furniture and real-world treats.
- **Monster:** the monster's **House** (four upgrade levels, where everything bought lives), a **Wardrobe** to wear what's been bought, and **Make** to choose a character (monster, dragon or robot), colour, eyes, mouth and name.
- **Trophies:** reward trophies, level medals, skill badges and collector badges, with a shelf for three favourites.
- **Week:** a weekly summary.
- **Garden extras:** mystery eggs every 10 Dojos (stickers and rare colours), streak fire, a talking monster, secret taps on the sun and clouds, seasonal and birthday decorations, a shared family team jar, a calm bedtime screen and a toddler view.
- **Monster voices:** recorded clips in `voice.js` (built by `tools/build-voice.py` from `tools/voice-lines.txt` with Piper voice en-us-libritts-high speaker 780, CC BY 4.0, a bright and lively voice lifted slightly), played through Web Audio so they work where the browser has no speech; per-character speed and effects (dragon a little lower, robot ring-mod, pets squeaky) and a cheerful "boop-bee" before a monster talks. Browser speech is the fallback for unrecorded lines. Outside games voices play only on a tap; in games the monster says what to do and what to match. To add a line, add it to voice-lines.txt and rebuild.
- **Monster Islands** (`islands.js`): ⛵ on the lawn opens a map of each child's island plus a shared family island. Kids place ground and things square by square; pieces come free from Dojos (an island track, plus a themed set each month that is kept forever), from hatched eggs, and as Island specials bought with Dojo $ in the Shop. Brothers visit, wave, high-five, leave a sticker on the welcome sign, and help build only after the owner says yes. Under-4s get big pieces and a Tidy broom. Saved on each child as `island` (via `set_monster`) and on the config as `familyIsland` (via `set_family_island`, so carers can build too). Admin mode can give or take single pieces.
- **Admin mode:** Settings → 🛠 Admin mode (parents only, behind the PIN) adds an Admin tab to each child: add or take Dojos (earn entries, bid "admin") or Dojo $ only (spend entries; negative = add), give or take away any shop item, pet, house or furniture (gifts cost nothing; taking back a bought item refunds its Dojo $), hatch or take back egg prizes, change today's game tries, clear high scores. Any game can be tried; admin games don't count. Lasts until turned off or the app is closed.
- **Games:** nine short games in the 🎮 Play tab, unlocked by monster level (Peekaboo pals from the start, Bubble pop, Feed the monster and Monster racing at 2, Memory match and Monster puzzle at 3, Catch the stars at 4, Monster jump at 5, Copy the monster at 6). Each is skill-based: points for speed and accuracy, ×2/×3 streak bonuses, and a saved high score per child (`best` on the kid record). They never give Dojos. Settings has an on/off switch and a daily limit per child (default 3, 0 = no limit).
- **Carers' guide:** the 📖 button on the home screen. Edit `docs/carers-guide.md`, run `python3 tools/build-guide.py`, then bump `VERSION` in `sw.js`. `{1}` and `{2}` become the children's names in the app.
- **Shop prices** fall into four tiers: Quick (3–8 Dojo $), Save a bit (10–20), Save up (22–45) and Mega (60+).

## How it fits together

| Part | What it does | Cost |
|---|---|---|
| This repository, served by **GitHub Pages** | The app itself: plain HTML, CSS and JavaScript, no build step | Free |
| **Supabase** | Sign-in, the family database and live sync | Free tier |
| A service worker (`sw.js`) | Offline use and automatic updates | – |

The family's data lives only in Supabase. Nothing personal is stored in this repository.

## Who can do what

- **Parents** (admins) can give points and dress monsters. They can also spend treats, mark goals as given, change settings, invite people, remove people, and back up or restore.
- **Carers** can give points and change a monster's look, outfit, name, trophy shelf and hatched eggs. They can undo a point they gave within 15 minutes.

The access rules are enforced by the database (`supabase/schema.sql`), not just by the app.

## One-time setup

1. **Supabase.** Create a project. Open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, and press **Run**.
2. **Supabase sign-in settings.** In **Authentication → URL Configuration**, set **Site URL** to the app's address (for example `https://YOURNAME.github.io/home-dojo/`) and add the same address under **Redirect URLs**.
3. **Connect the app to the database.** Put the Project URL and the anon public key (from **Project Settings → API**) into `config.js`.
4. **Hosting.** In the GitHub repository, go to **Settings → Pages**. Set **Source** to *Deploy from a branch*, choose **main** and **/ (root)**, then save. A minute later the app is live at the address above.
5. **First parent.** Open the address, create an account, then choose **Start a new family**. To bring over points from the earlier version, tap **Restore a backup file** on the set-up screen.
6. **Everyone else.** Go to **Settings → Invite a parent** or **Invite a carer**, and send them the link.

## Installing on a phone or tablet

- **iPhone or iPad:** open the address in Safari, tap **Share**, then **Add to Home Screen**.
- **Android:** open it in Chrome and tap **Install app** (or menu ⋮ → **Add to Home screen**).

## Backups

Supabase stores everything online. A parent can also use **Settings → Backups → Download backup** to save a file of every setting and point to Files, iCloud or Google Drive. **Restore from a file** puts settings back and adds any history that's missing; it never deletes anything. The app reminds parents if a month passes without a backup.

Free Supabase projects pause after 7 days with no use at all. Daily use keeps it awake. If it ever pauses, press **Restore** in the Supabase dashboard.

## Making changes

- App screens and logic: `app.js`
- Behaviour menu, shop items and monster drawings: `monsters.js`
- Look and feel: `styles.css`
- `app.js` also runs inside a claude.ai artifact: a page that sets `window.HD_HOST` supplies its own storage instead of Supabase.
- After changing any file, bump `VERSION` in `sw.js`. Installed copies will then show a "new version is ready" banner.

## Licences

Supabase JS client (MIT) is in `vendor/`. The Fredoka and Atkinson Hyperlegible fonts (SIL Open Font Licence) are in `fonts/`.
The voice clips in `voice.js` were made with the Piper voice "en-us-libritts-high" by Michael Hansen (rhasspy/piper), trained on the LibriTTS dataset; both are licensed CC BY 4.0. The clips are pitched and filtered.
