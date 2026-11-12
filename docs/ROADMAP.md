# Hamsafar roadmap: future features

Planned after launch (2 December 2026). Not built yet.

## AI features (Claude API)

These need an Anthropic API account, `ANTHROPIC_API_KEY` in Vercel and a spending limit. Every feature must keep working without the key.

| # | Feature | What it does | Est. cost / month* |
|---|---|---|---|
| 1 | Search in your own words | Urdu, Roman Urdu or English ("kal subah 8 baje Bahria Phase 7 se NUST, sirf female driver") fills in from, to, date, time and women-only | Haiku 5.5 ~$1 · Opus 5.5 ~$40 |
| 2 | Chat safety guard | Checks driver-rider chat messages for harassment, threats, money scams or moving off the platform; warns or blocks, and files serious cases as safety reports | Haiku 5.5 ~$0.20 · Opus 5.5 ~$8 |
| 3 | WhatsApp support reply drafts | Drafts replies in the admin WhatsApp inbox in the user's language, from the FAQs and their account status; an admin reviews and sends | Haiku 5.5 ~$0.25 · Opus 5.5 ~$10 |
| 4 | ID check helper (admin) | Reads CNIC photos, compares them with the typed details and flags mismatches. ID photos would go to an outside AI service: update the privacy policy and consent text first | Haiku 5.5 ~$0.30 · Opus 5.5 ~$13 |
| 5 | Weekly demand insights | Turns searches that found no ride into "where to recruit drivers" | cents |

\* Estimated at 10,000 searches, 5,000 chat messages, 1,000 support drafts and 500 ID checks a month, at November 2026 prices. Test both models on 50–100 real examples before choosing.

Suggested order: 1 and 2 first (best demo, and they back up the safety promise), then 3, 5, 4.

## Other planned work
- Google Play release: needs the D-U-N-S number after SECP incorporation ($25)
- iPhone app: Apple Developer, $99 a year
- Switch map tiles from OpenStreetMap to a provider with a free tier (MapTiler or similar) before traffic grows
- Ride alerts by push first, WhatsApp only for people without the app
- Organisation subscriptions and invoicing (the main revenue plan)
