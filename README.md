# 🍕 Pizza Tracker

A personal web app for logging every pizza place you visit — search for a shop,
pull in its name, address and website, then rate it and write down what you
thought.

Everything runs on your own machine. Your notes live in a SQLite file and your
photos live in a folder, both under `data/`.

---

## Quick start

```bash
npm install
```

Set a login password (needed before the app will let you in):

```bash
npm run set-password
```

Then, for day-to-day use:

```bash
npm run build && npm start
```

Open **http://localhost:3001**.

While changing the code, use the dev server instead (hot reload on the front
end, auto-restart on the back end):

```bash
npm run dev
```

That serves the UI on **http://localhost:5173** and the API on port 3001.

---

## Using it

The app has four tabs along the bottom:

| Tab | What's there |
| --- | --- |
| **Search** | Find a place on Google and add it, or add one by hand |
| **Visited** | Everything with a visit date or a rating |
| **Planned** | Everything without either — plus **Pick random** |
| **Settings** | Appearance, data, account |

A place moves from Planned to Visited the moment you give it a rating or a visit
date. Nothing to file manually.

### Search tab

1. **Search** for a place in the top box. The *Near* field narrows it to a city
   or neighborhood.
2. **Add** a result. Saving pulls in, automatically:
   - name, address, website, phone and coordinates
   - the **Google rating** and how many reviews it's based on
   - a **synopsis** — Google's editorial blurb, falling back to their
     AI-generated overview when there's no editorial one
   - a **cover photo** from the place's Google listing
   - the restaurant's **logo**, fetched from its own website

   All of it is downloaded and stored locally, so the app keeps working offline
   and nothing hotlinks to Google.
3. **Click the card** to open the detail panel and record your own take:
   - **Overall rating** — 0.5 to 5 stars, click the left or right half of a star.
     Clicking the same spot again clears it.
   - **Crust / Sauce / Cheese / Value** — optional 0–10 sliders. The app shows
     the average of whichever ones you filled in. The ✕ next to a slider resets
     it to "not rated" (different from scoring it 0).
   - **Date visited** and **Would return?**
   - **Notes** — free text.
   - **Photos** — added from your phone or disk; they're downscaled in the
     browser before upload so a 12 MB photo doesn't become a 12 MB request.

   Edits save automatically about half a second after you stop typing. The
   header shows *Saving…* / *Saved*.

4. **Sort and filter** your collection with the toolbar — by rating, most recent
   visit, name, or whether you'd go back.

**Can't find it?** The *Add manually* box below the search results takes a name,
address, website and phone. It still tries to match the place on Google to fill
in the rating, synopsis and logo — untick that box for somewhere genuinely
unlisted (a food truck, a pop-up) so it doesn't attach the wrong listing.

### Planned tab

**Pick random** pulls one place off the list as a suggestion, with its rating,
synopsis, a directions link and its website. *Pick again* re-rolls and never
hands you the same place twice in a row.

### Settings tab

- **Theme** — System (follows your device), Light, or Dark
- **Text size** — four steps; scales every bit of text in the app
- **Show synopsis on cards** — off gives a denser list
- **Opening tab** — which tab the app starts on
- **Export JSON**, place and photo counts
- **Sign out**, and **Sign out everywhere** to end every session

Settings are stored in your browser, so they're per-device rather than shared.

### Refresh

The **Refresh** button in the drawer's *From Google* section re-pulls the
synopsis, rating, cover photo and logo. Use it when a place has been open a
while and its rating has moved, or when something failed the first time.

Refresh also **overwrites the address, website and phone** with Google's current
values, so if you've hand-corrected any of those, expect them to be replaced.
Your rating, sub-scores, notes, visit date, would-return flag and your own
photos are never touched.

Entries saved before you added an API key have no Google place ID. Refresh
handles that: it looks the place up by name and address first, links it, and
enriches it from there.

### About the logo

Google Places has no business-logo field — `iconMaskBaseUri` is a generic
category pin, not the restaurant's mark. So the logo comes from the shop's own
website instead: the app reads its `<link rel="apple-touch-icon">` / favicon
tags, picks the largest and most logo-like candidate, and falls back to
`/favicon.ico`. That works on most restaurant sites, but a place with no
website, a broken site, or only a generic icon won't get one, and the card just
shows the cover photo.

### Photo attribution

Google's terms require Place Photos to be shown with their author's name, so
the cover photo carries a `Photo: …` credit on both the card and the detail
panel. Your own uploaded photos have no such credit and take priority as the
card image when you've added one.

---

## Connecting Google Places

Out of the box, search runs against a small built-in list of well-known
pizzerias so the app is usable immediately. **That list is unverified sample
data** — the addresses and phone numbers were written by hand and may be wrong
or out of date. Treat it as a demo, not a source of truth.

To search all of Google Places instead:

1. Go to the [Google Cloud console](https://console.cloud.google.com/) and
   create a project (or pick an existing one).
2. Enable **Places API (New)** under *APIs & Services → Library*.
3. Enable billing on the project. Google requires a billing account for the
   Places API even though it includes a monthly free allowance — check
   [current Places API pricing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)
   before you rely on it, since the terms change.
4. Under *APIs & Services → Credentials*, create an **API key**.
5. Restrict the key: set *API restrictions* to **Places API (New)**. This app
   calls Google from the server, not the browser, so an HTTP-referrer
   restriction will **not** work — leave application restrictions off for local
   use, or use an IP restriction if you host it somewhere fixed.
6. Copy the key into a `.env` file at the project root:

   ```bash
   cp .env.example .env
   ```

   ```
   GOOGLE_MAPS_API_KEY=your-key-here
   ```

7. Restart the app. The "Demo search" banner disappears, and the startup log
   reads `search: Google Places`.

The key is read only by the Node process and is never sent to the browser.
`.env` is gitignored.

Anything you already saved keeps working, and **Refresh** will link those older
entries to Google and fill in their synopsis, rating, photo and logo.

### What each search costs

Google bills Text Search by which fields you ask for, in tiers. This app is
arranged to keep the expensive tier off the per-search path:

| Call | When | Fields |
| --- | --- | --- |
| Text Search | Every search you run | Basic details plus rating — one call per search, not per result |
| Place Details | Once, when you **save** or **Refresh** a place | Synopsis, photos, rating |
| Place Photo | Once per saved place | The cover image |
| Text Search (ID only) | Refreshing a place with no Google ID | Free tier |

Enriching on save rather than on search is deliberate: pulling synopses for all
20 results of every search would bill the priciest tier 20 times over. Check
[current pricing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)
for the actual numbers — the tiers and free allowance change.

---

## Accounts and login

The app is single-user and protected by one password.

```bash
npm run set-password
```

The prompt is hidden as you type. The password is hashed with **scrypt** and
only the hash is written to `.env` — the plaintext is never stored. Restart the
server afterwards. Run the same command any time to change it.

Until a password is set, every API route returns 401 and the UI shows a setup
notice, so an unconfigured instance never serves your data.

**What's protected:** every `/api/*` route *and* `/uploads/*`. Your photos are
behind the login too, not public files anyone can guess the URL of.

**Sessions** last 30 days, in an httpOnly `SameSite=Lax` cookie. The cookie value
is random and only its SHA-256 is stored, so a stolen database can't be used to
forge a session. *Sign out* ends the current device; `POST /api/auth/logout-all`
ends every session everywhere — use it if you change the password or think one
leaked.

**Brute force:** 8 failed attempts from one IP triggers a 15-minute lockout.

## Deploying with Docker

A full walkthrough, from nothing installed to a running container. If you just
want the commands, jump to the [cheat sheet](#compose-cheat-sheet).

### What you'll end up with

| Piece | Detail |
| --- | --- |
| Container | `pizza-tracker`, restarts automatically |
| Address | `http://127.0.0.1:3001` on the host |
| Data | Docker named volume `pizza-data` |
| Secrets | `.env` on the host, never baked into the image |
| Base | `node:24-alpine`, no compiler toolchain, runs as non-root |

---

### Step 1 — Install Docker

You need **Docker Engine** and **Compose v2**. Compose v2 is the `docker compose`
subcommand (a space, not a hyphen); the old `docker-compose` binary won't
understand this file.

- **macOS** — [Docker Desktop](https://docs.docker.com/desktop/install/mac-install/).
  Install it, launch it, and wait for the whale icon in the menu bar to stop
  animating. Docker Desktop bundles Compose v2.
- **Linux** — follow
  [Docker's install guide](https://docs.docker.com/engine/install/) for your
  distribution, then add yourself to the `docker` group so you don't need `sudo`:
  `sudo usermod -aG docker $USER` and log out and back in.
- **Windows** — [Docker Desktop with the WSL 2 backend](https://docs.docker.com/desktop/install/windows-install/).

Check it's working:

```bash
docker --version && docker compose version && docker info --format '{{.ServerVersion}}'
```

All three must print something. If the last one errors, the Docker daemon isn't
running — start Docker Desktop, or `sudo systemctl start docker` on Linux.

---

### Step 2 — Create your `.env`

Compose reads secrets from a `.env` file **next to `docker-compose.yml`**, not
from whatever directory you're standing in. Create it with a terminal rather
than a GUI editor — Finder hides file extensions, so a file that looks like
`.env` may actually be `.env.txt`:

```bash
cd /path/to/pizza-tracker && cp .env.example .env
```

`.env` is gitignored, so cloning this repo onto a server never brings one with
it. Create it on each machine you deploy to.

Open `.env` and set your Google key:

```
GOOGLE_MAPS_API_KEY=AIza...your-key...
```

Leave `AUTH_PASSWORD_HASH=` empty for now; step 4 fills it in. Ignore `HOST`,
`PORT` and `TRUST_PROXY` in this file — `docker-compose.yml` sets those itself,
and its values win.

Without a Google key the app still runs, but search falls back to a small
built-in demo list. See [Connecting Google Places](#connecting-google-places).

---

### Step 3 — Build the image

```bash
docker compose build
```

First build takes a few minutes; later ones are much faster thanks to layer
caching. It runs in two stages: the front end is compiled in one, and only the
built output is copied into the runtime image, so vite, typescript and the
`@types` packages never ship.

Watch for this line partway through — it's a deliberate check that the base
image's Node provides the built-in SQLite module the app stores everything in:

```
node:sqlite OK on v24.x.x
```

If the build stops there instead, see
[Build fails at the `node:sqlite` check](#build-fails-at-the-nodesqlite-check).

---

### Step 4 — Set your login password

```bash
docker compose run --rm pizza-tracker npm run hash-password
```

It prompts twice (hidden, minimum 10 characters) and prints a line like:

```
AUTH_PASSWORD_HASH=scrypt:65536:8:1:<16-byte-salt-in-base64>:<64-byte-hash-in-base64>
```

Copy that whole line into `.env`, replacing the empty `AUTH_PASSWORD_HASH=`.

**Why `hash-password` and not `set-password`?** `set-password` writes to a `.env`
*inside* the container, which is thrown away when the container is removed.
`hash-password` only prints — the hash belongs in the host's `.env`, which
Compose passes in as an environment variable.

The plaintext password is never stored anywhere. Only this scrypt hash is, and
it can't be reversed. Lose the password and you set a new one — there's no
recovery.

No interactive terminal (a CI job, a script)? Pipe it, accepting that the
password lands in your shell history:

```bash
printf 'your-password\n' | docker compose run --rm -T pizza-tracker npm run hash-password -- --stdin
```

---

### Step 5 — Start it

```bash
docker compose up -d
```

Confirm it came up healthy — the `STATUS` column should reach `healthy` within
about 15 seconds:

```bash
docker compose ps
```

```bash
docker compose logs pizza-tracker
```

You're looking for:

```
Pizza Tracker on http://0.0.0.0:3001 — search: Google Places
```

If it says `search: demo data`, your `GOOGLE_MAPS_API_KEY` isn't reaching the
container. If it warns that no login password is set, `AUTH_PASSWORD_HASH` isn't
either — in both cases check `.env`, then `docker compose up -d --force-recreate`.

Now open **http://localhost:3001** and sign in with the password from step 4.

---

### Day-to-day operations

```bash
docker compose logs -f pizza-tracker      # follow logs, Ctrl-C to stop watching
docker compose restart pizza-tracker      # restart without rebuilding
docker compose stop                       # stop, keep everything
docker compose up -d                      # start again
docker compose down                       # stop and remove the container (volume kept)
docker compose exec pizza-tracker sh      # shell inside the running container
```

`docker compose down` is safe — it removes the container but leaves the
`pizza-data` volume alone. `docker compose down -v` also deletes the volume,
**and your entire pizza history with it**.

Count what's stored, without opening the app:

```bash
docker compose exec pizza-tracker node -e "const {DatabaseSync}=require('node:sqlite'); const d=new DatabaseSync('/app/data/pizza.db'); console.log(d.prepare('SELECT COUNT(*) c FROM places').get().c + ' places')"
```

---

### Updating after a code change

```bash
docker compose build && docker compose up -d
```

The volume is untouched by rebuilds, so ratings, notes and photos carry over.
Your `.env` isn't in the image either, so the password and API key survive too.

**Changing the password** means a fresh hash: rerun step 4, replace the line in
`.env`, then `docker compose up -d --force-recreate`. Existing sessions stay
valid across a password change — use **Sign out everywhere** in Settings to end
them.

---

### Backups

Two things need backing up, and the volume is only one of them:

| What | Where | Contains |
| --- | --- | --- |
| Volume `pizza-data` | Managed by Docker | Database and photos |
| `.env` | Your project folder | Password hash and API key |

Back up the volume to a tarball in the current directory:

```bash
docker run --rm -v pizza-data:/data -v "$PWD:/backup" alpine tar czf /backup/pizza-backup.tar.gz -C /data .
```

Check it actually contains something before trusting it:

```bash
tar tzf pizza-backup.tar.gz | head
```

You should see `./pizza.db` and `./uploads/`. Copy `.env` somewhere safe as
well — restoring the volume without it leaves you unable to log in.

**Restoring.** Stop the app first so nothing writes mid-restore. This wipes the
volume's current contents:

```bash
docker compose stop
```

```bash
docker run --rm -v pizza-data:/data -v "$PWD:/backup" alpine sh -c "rm -rf /data/* && tar xzf /backup/pizza-backup.tar.gz -C /data"
```

```bash
docker compose up -d
```

To find the volume on disk instead: `docker volume inspect pizza-data`. On
macOS that path lives inside Docker Desktop's VM and isn't directly browsable,
so use the tarball approach there.

---

### Reaching it from another machine

By default the container publishes to `127.0.0.1:3001`, so it's reachable from
the server itself and nothing else. Running Docker on a server and browsing from
a desktop needs one of the following.

#### Option 1 — SSH tunnel (encrypted, no config change)

Best choice for occasional access, and the only one of these that's encrypted
without extra setup. On your **desktop**:

```bash
ssh -N -L 3001:127.0.0.1:3001 root@your-server
```

Leave that running and open **http://localhost:3001** on the desktop. Traffic
rides inside SSH, so nothing crosses the network in the clear and the server's
port stays closed. Nothing on the server changes.

#### Option 2 — publish on the LAN (unencrypted)

Add to `.env` on the server:

```
BIND_ADDRESS=0.0.0.0
```

Then:

```bash
docker compose up -d --force-recreate
```

Now reach it at `http://your-server-ip:3001`.

Understand the tradeoff: **this is plain HTTP.** Your password is sent in the
clear on login, and the session cookie isn't marked `Secure` because there's no
HTTPS. Anyone able to watch traffic on that network can read both. Acceptable on
a trusted home LAN; not acceptable over anything else, and never on the open
internet.

If the server has a firewall, open the port — e.g. `ufw allow 3001/tcp`.

#### Option 3 — TLS reverse proxy (the real answer)

For anything beyond occasional LAN use, terminate HTTPS in front of the app and
leave `BIND_ADDRESS` at its default so only the proxy can reach it. See
[Putting it on the internet](#putting-it-on-the-internet) below — that also
covers hostnames and certificates.

### Putting it on the internet

The compose file publishes to `127.0.0.1:3001` deliberately — reachable from the
host, not from the network. **Keep that binding** and put a TLS-terminating
reverse proxy in front.

This matters more than it might seem: the session cookie is only marked `Secure`
when the request arrives over HTTPS. Serve the app over plain HTTP across a
network and your password and session cookie travel in the clear.
`TRUST_PROXY=1` is already set in `docker-compose.yml` so the app reads the real
client IP and scheme from `X-Forwarded-*` headers — without it, rate limiting
would see every request as coming from the proxy.

**Caddy** is the least work, since it gets certificates automatically. A
`Caddyfile` next to your compose file:

```
pizza.example.com {
    reverse_proxy 127.0.0.1:3001
}
```

To run Caddy in Docker alongside the app, add this to `docker-compose.yml` and
change the app's `ports` to `expose: ["3001"]` so only Caddy can reach it:

```yaml
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
    depends_on:
      - pizza-tracker
```

...with `caddy-data:` added under the top-level `volumes:` key, and the
`reverse_proxy` target changed to `pizza-tracker:3001` so it resolves over the
compose network.

**nginx**, if you already run one:

```nginx
server {
    listen 443 ssl;
    server_name pizza.example.com;

    # ssl_certificate / ssl_certificate_key via certbot

    client_max_body_size 30M;   # photo uploads

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

The `X-Forwarded-Proto` header is what makes the `Secure` cookie flag work, and
`client_max_body_size` needs raising or photo uploads fail with a 413.

**Cloudflare Tunnel** avoids opening any inbound port at all, which is a good fit
for a home server — point a tunnel at `http://localhost:3001`.

Before you expose it, check off:

- [ ] HTTPS terminates in front of the app
- [ ] Compose still publishes to `127.0.0.1`, or the port is firewalled to the proxy
- [ ] A long password is set (10 characters is the floor, not a target)
- [ ] Your Google API key is restricted to the Places API in the Cloud console
- [ ] You have a backup, and you've checked it isn't empty

What this doesn't give you: multi-user accounts, 2FA, account recovery, or audit
logging. It's a solid lock on a personal app, not a hardened multi-tenant service.

---

### Deploying to a remote server

Copy the project (excluding `node_modules`, `data` and `.env`), then run steps
2–5 on the server:

```bash
rsync -av --exclude node_modules --exclude data --exclude .env --exclude .git ./ user@server:/opt/pizza-tracker/
```

Create a fresh `.env` on the server rather than copying yours, so the password
hash and key aren't sitting in two places.

**Building on an Apple Silicon Mac for an x86 server won't work by default** —
the image architecture has to match the machine that runs it. Building on the
server itself is simplest. To build locally instead, target the platform
explicitly:

```bash
docker buildx build --platform linux/amd64 -t pizza-tracker .
```

Or add `platform: linux/amd64` under the service in `docker-compose.yml`.
Emulated cross-platform builds are noticeably slower than native ones.

---

### Troubleshooting

#### `TLS handshake timeout` pulling the base image

```
ERROR [internal] load metadata for docker.io/library/node:24-alpine
failed to do request: Head "https://registry-1.docker.io/v2/library/node/manifests/24-alpine":
net/http: TLS handshake timeout
```

Nothing to do with this project — the Docker daemon can't reach Docker Hub.
Check connectivity first:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://registry-1.docker.io/v2/
```

`401` is the healthy answer (the registry wants auth for that path). A hang or
timeout means the network is the problem. In order of likelihood:

- **MTU mismatch.** The classic cause of TLS timeouts specifically, on VPS,
  VPN-attached and tunnelled hosts. If the host interface MTU is below 1500,
  Docker's bridge needs to match. Compare them:

  ```bash
  ip link show | grep -E 'mtu' | grep -E 'eth0|ens|enp|docker0'
  ```

  If the host is e.g. 1450 and `docker0` is 1500, set the daemon's MTU in
  `/etc/docker/daemon.json` and restart Docker:

  ```json
  { "mtu": 1450 }
  ```

- **DNS.** `getent hosts registry-1.docker.io` should resolve. If not, add a
  resolver to `/etc/docker/daemon.json`: `{ "dns": ["1.1.1.1", "8.8.8.8"] }`.
- **A firewall or proxy** blocking outbound 443 to Docker Hub. Behind a proxy,
  configure it for the *daemon*, not just your shell — `docker build` runs in the
  daemon, so `HTTPS_PROXY` in your shell has no effect.
- **Transient.** Simply retry before digging.

**If you've built successfully before**, the base image is already local and you
can build without contacting the registry at all, using the classic builder:

```bash
DOCKER_BUILDKIT=0 docker compose build
```

BuildKit re-resolves image tags against the registry even when the image is
cached; the classic builder uses the local copy.

#### The log says `.env not found. Continuing without it.`

Versions before this line was removed printed that on every container boot. It
came from Node inside the container, where `.env` is deliberately absent — it is
**not** Compose failing to read your host `.env`, and it is not an error.

What actually tells you whether your values arrived is the next line:

| Log line | Meaning |
| --- | --- |
| `search: Google Places` | The API key arrived |
| `search: demo data (no GOOGLE_MAPS_API_KEY set)` | It did not |
| *(no password warning)* | The password hash arrived |
| `⚠ No login password set` | It did not |

#### Build fails at the `node:sqlite` check

```
Error: Cannot find module 'node:sqlite'
```

The base image's Node doesn't expose the built-in SQLite module unflagged. This
check exists so you find out at build time rather than on the first request.
Edit both `FROM` lines in the `Dockerfile` to a newer Node:

```dockerfile
FROM node:25-alpine AS client
FROM node:25-alpine AS runtime
```

`node:24-alpine` (Node 24.18.0) is verified working, so you should not hit this
unless you've changed the base image.

#### `env file .env not found`, or your key/password aren't reaching the app

Compose reads `.env` from the **project directory** — the folder containing
`docker-compose.yml` — not from wherever you happen to be standing. Run
`docker compose` from that folder, or point at it explicitly:

```bash
docker compose --project-directory /path/to/pizza-tracker up -d
```

See exactly what Compose resolved, which settles this in one command:

```bash
docker compose config
```

If `GOOGLE_MAPS_API_KEY` and `AUTH_PASSWORD_HASH` show empty there, the file
isn't being read. The usual reasons:

- **You're in the wrong directory.** `ls -a` should list `.env` beside
  `docker-compose.yml`.
- **The filename is wrong.** A GUI text editor may have saved `.env.txt` or
  `.env.rtf` — Finder hides extensions by default, so it looks right. Check with
  `ls -a`, and prefer `cp .env.example .env` in a terminal.
- **`.env` isn't in your clone.** It's gitignored on purpose, so cloning the repo
  onto a server never brings it. Create it there.
- **A stale container.** Environment changes need
  `docker compose up -d --force-recreate`, not `restart`.

Confirm what the container actually received:

```bash
docker compose exec pizza-tracker printenv GOOGLE_MAPS_API_KEY AUTH_PASSWORD_HASH
```

A missing `.env` no longer aborts the deployment — the app starts, logs which
values are unset, and shows the setup screen until a password hash is provided.

#### The app shows "No password has been set yet"

`AUTH_PASSWORD_HASH` is empty or isn't reaching the container. Confirm the
container actually sees it:

```bash
docker compose exec pizza-tracker printenv AUTH_PASSWORD_HASH
```

Empty output means `.env` isn't being read — check the file is beside
`docker-compose.yml` and rerun `docker compose up -d --force-recreate`.

#### Login always says the password is incorrect

Usually a mangled hash. It must start with `scrypt:` and contain exactly six
colon-separated fields, on one line with no quotes and no spaces. If yours
contains `$` characters it came from an older version — regenerate it with
step 4.

#### "Too many failed attempts"

Eight wrong passwords from one IP triggers a 15-minute lockout. Wait it out, or
clear it by restarting: `docker compose restart pizza-tracker`.

#### Everything vanished after a rebuild

The volume wasn't mounted — check `docker volume ls` lists `pizza-data`, and
that `docker-compose.yml` still has the `pizza-data:/app/data` mapping. If you
ran `docker compose down -v`, the data is gone; restore from a backup.

#### `port is already allocated`

Something else holds 3001. Find it with `lsof -nP -iTCP:3001 -sTCP:LISTEN`, or
change the host side of the mapping to e.g. `"127.0.0.1:3010:3001"` — only the
number left of the colon needs changing.

#### Status stuck at `unhealthy`

```bash
docker compose logs --tail 50 pizza-tracker
```

The healthcheck calls `/api/auth/session` inside the container. A crash loop
usually means the volume isn't writable or an environment variable is malformed.

#### Search says "demo data" despite setting a key

The key isn't reaching the container, or it's on the wrong line. Verify with
`docker compose exec pizza-tracker printenv GOOGLE_MAPS_API_KEY`, then recreate
the container — environment changes need `up -d --force-recreate`, not
`restart`.

#### Can't reach it from another device

That's the intended default. The compose file binds to `127.0.0.1`, so only the
host can connect. Put a reverse proxy in front, or change the mapping to
`"3001:3001"` accepting that the traffic is unencrypted.

---

### Compose cheat sheet

> **Run these one at a time.** Steps 1–4 are a setup sequence with a manual step
> in the middle — pasting the whole list into a shell at once skips it, and you
> end up with an app that has no key and no password.

**1. Create the config**

```bash
cp .env.example .env
```

**2. Add your Google key** — edit `.env` and set `GOOGLE_MAPS_API_KEY=`.

**3. Build**

```bash
docker compose build
```

**4. Generate a password hash**

```bash
docker compose run --rm pizza-tracker npm run hash-password
```

**5. Paste the printed `AUTH_PASSWORD_HASH=` line into `.env`.** Nothing works
until you do; the command only prints it.

**6. Start**

```bash
docker compose up -d
```

Then, for everyday use:

```bash
docker compose ps
```

```bash
docker compose logs -f pizza-tracker
```

```bash
docker compose build && docker compose up -d --force-recreate
```

```bash
docker compose down
```

### What's in the image

- **Two-stage build** — the dev toolchain stays in the build stage.
- **No native modules.** Storage is Node's built-in `node:sqlite`, so there's no
  compiler in the image and nothing to rebuild per architecture.
- **Runs as the non-root `node` user.**
- **Healthcheck** on `/api/auth/session`, which answers without a cookie.
- **`/app/data` is the volume** — database and photos.

## Exposing it to the internet (without Docker)

Running from `npm start` rather than a container? The same rules apply — see
[Putting it on the internet](#putting-it-on-the-internet) for reverse proxy
configs and the pre-flight checklist. Two settings differ when there's no
container:

1. **Leave `HOST` alone** if your reverse proxy runs on the same machine; it can
   reach `127.0.0.1:3001` fine. Only set `HOST=0.0.0.0` when the proxy lives
   elsewhere, and firewall the port so only the proxy can reach it.
2. **Set `TRUST_PROXY=1` in `.env`** yourself. The compose file sets this for
   you; a bare `npm start` doesn't.

## Your data

| What | Where |
| --- | --- |
| Places, ratings, notes | `data/pizza.db` (SQLite) |
| Photos | `data/uploads/` |

**To back up, copy the whole `data/` folder.** The **Export** button in the
toolbar downloads your places as JSON, which is handy for reading or moving the
text data elsewhere, but it does not contain the photo files.

`data/` is gitignored, so your pizza opinions won't end up in a commit.

To wipe everything and start over, stop the app and delete `data/`.

---

## Project layout

```
server/
  index.js          Express API + serves the built front end
  auth.js           Sessions, login routes, rate limiting, auth middleware
  password.js       scrypt hashing and verification
  db.js             SQLite schema and connection
  places/
    index.js        Search: Google Places provider + demo provider
    enrich.js       Place Details, cover photo, and Google-ID resolution
    logo.js         Finds and downloads a logo from the restaurant's website
    demo-data.js    The built-in sample pizzerias
client/
  public/
    favicon.svg     Pizza-slice tab icon
  src/
    App.tsx         Tab routing, auth gate, shared place state
    settings.ts     Theme / text size, persisted to localStorage
    components/
      TabBar          Bottom navigation
      SearchPanel     Google search and add
      CustomEntryForm Manual add for unlisted places
      PlaceList       Shared list with filters and sorting
      PlannedTab      Planned list plus Pick random
      SettingsTab     Appearance, data, account
      PlaceDetail     Editing drawer
      PlaceCard, StarRating, ScoreSlider, LoginScreen
    api.ts          Typed fetch wrappers
    styles.css      All styling (light/dark, scalable type)
scripts/dev.mjs     Runs the API and Vite together
data/               Created on first run — your database and photos
```

### Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | API + Vite dev server with reload |
| `npm run build` | Type-check and build the front end |
| `npm start` | Serve the built app and API on port 3001 |
| `npm run set-password` | Set or change the login password (writes to `.env`) |
| `npm run hash-password` | Print a password hash without writing — for Docker |

### API

Everything below requires a valid session cookie.

| Route | Purpose |
| --- | --- |
| `GET /api/auth/session` | Whether a password is set and you're signed in (public) |
| `POST /api/auth/login` | Sign in with `{ password }` (public) |
| `POST /api/auth/logout` | Sign out this device (public) |
| `POST /api/auth/logout-all` | End every session everywhere |
| `GET /api/search?q=&near=` | Search Google Places or the demo list |
| `GET /api/places` | Everything you've saved |
| `POST /api/places` | Save a place (re-adding an existing one is a no-op) |
| `PATCH /api/places/:id` | Update ratings, notes, visit details |
| `DELETE /api/places/:id` | Delete a place and its photos |
| `POST /api/places/:id/refresh` | Re-pull synopsis, rating, cover photo and logo |
| `POST /api/places/:id/photos` | Upload a photo as a base64 data URL |
| `DELETE /api/photos/:id` | Delete one photo |
| `GET /api/export` | Download all places as JSON |

---

## Notes

- Requires **Node 22.5+** (it uses the built-in `node:sqlite` module). Built and
  tested on Node 25.
- There are no native dependencies to compile — `express` is the only runtime
  package on the server. Auth uses Node's built-in `crypto`, so there's no
  session or password library to keep patched.
- Back up `data/` **and** `.env` — `.env` holds the password hash and your API
  key, and neither is in the database.
