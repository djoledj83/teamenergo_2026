# Placeholder content — needs real data before launch

The design this site was built from described a different company (a Ukrainian
power-transmission firm). Everything below is either invented by that template
or was left as a note-to-self in the original files. It is seeded so the admin
panel has rows to edit, but none of it is true.

## Must be replaced

| Where | Current value | Note |
|---|---|---|
| `contact.phone` setting | *(empty)* | The old site showed `+380 11 123 4567`. **+380 is Ukraine's country code** — it came from the template. Left empty rather than guessed. |
| `company.foundedYear` setting | *(empty)* | Hero badge literally read "Trusted energy partner since (pa br godina)". |
| Homepage stats (4 rows) | all `0`, **unpublished** | The originals — 500+ projects, 1,200 MW capacity, 3,500 km of lines, 99.98% grid reliability — belonged to the template. Seeded unpublished so nothing false is shown until real figures are entered. |
| Projects / Reference | *none seeded* | The three on the old site were `Naslov projekta 1/2/3` with `Opis projekta 1 u 2, 3 recenice…`. Nothing real to migrate. |
| Service descriptions | *(empty)* | The six service names are real (taken from the footer), but no descriptions existed anywhere. |
| Team members | *none seeded* | No team data existed. |
| News, gallery | *none seeded* | Categories seeded, no content. |

## Carried over as-is

These are genuine and were kept, with the Serbian Y/Z keyboard typos fixed
(`kanaliyacije` → `kanalizacija`, `iyvori` → `izvori`, `poyiv` → `poziv`):

- Six services: Telekomunikacije, Energetika, Vodovod i kanalizacija,
  Obnovljivi izvori energije, Sistemi tehničke zaštite, E-mobilnost
- Company description and hero paragraph
- Two testimonial quotes (Aleksandar Radivojević, Teamenergo d.o.o.)
- Fourteen client names for the ticker bar
- Email `info@teamenergo.com` and the Zemun address

## Images

Every image on the old site was hot-linked from somewhere else — Unsplash,
`grocka.rs`, `arquitecturaviva.com`, and a LinkedIn CDN URL carrying an expiry
token. Three of those hosts were not even allow-listed, so they were failing to
render.

They are temporarily allow-listed in `apps/web/image-hosts.config.mjs` so the
site renders during development. Once the media library lands, every image
becomes a local upload and that file should shrink to nothing.
