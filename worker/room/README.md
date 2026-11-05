# PW Counter room relay

A tiny Cloudflare Worker with one Durable Object per 4-digit room code. It forwards text messages between the two phones in a room and stores nothing (no storage calls, no timers, so the object hibernates when idle). Each code is its own Durable Object, so any number of pairs can play at once. A phone connects as `?role=host` (it showed the code) or `?role=guest` (it joined), with a per-tab `&sid=`. A second host on a code is refused (close code 4002, the page picks another code), a second guest or a third phone too (4001); the same tab reconnecting after a network drop (same `sid`) replaces its own stale socket instead (the old one closes with 4000), messages over 4 KB close the socket (1009), and only the site (`https://pwcounter.dalek.coffee`) or a loopback page may connect.

The Workers Free plan supports SQLite-backed Durable Objects and WebSocket hibernation; it has daily free limits on requests and duration, which a counter easily stays under.

## Deploy (owner steps)

From this folder (`worker/room`):

1. `npx wrangler login`
2. `npx wrangler deploy`
3. Copy the printed address (`https://pwcounter-room.<your-subdomain>.workers.dev`) into `js/room-config.js` as `ROOM_URL`, bump the version, and push.

Check it: open `https://pwcounter-room.<your-subdomain>.workers.dev/health` (answers `ok`).
