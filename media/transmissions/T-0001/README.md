# T-0001 — Purtata corporatriștilor

Media recovery checklist:

- [ ] `lyrics.png` — 3,487,332 bytes
- [ ] `video.mp4` — 12,981,931 bytes
- [ ] `cover.jpeg` — 13,396 bytes
- [ ] `audio.mp3` — 2,722,328 bytes

These four source objects are present in the production storage metadata but are absent from the available restore project's Transmission-media bucket. The production project's storage API previously returned HTTP 402 (cached egress quota exceeded), so no files have been claimed as recovered. The original source references are retained in `content/transmissions.json`.
