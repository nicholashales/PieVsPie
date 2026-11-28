# Registered fight cards

Wait for the owner's approved roster and ordered pairings before importing or printing 2026 cards. `roster.mjs` contains the established provisional fighter aliases and stable numeric IDs. Preserve an ID and its alias once a code is issued. Add new roster entries and artwork together if the final roster requires them. Keep supermarket and product mappings in a private organiser file.

Create a JSON file containing `version: 1` and a `fights` array. Each item supplies `code`, `redId` and `whiteId`. This example is for a disposable local test:

```json
{
  "version": 1,
  "fights": [
    {"code": "LOCAL-ONLY-01", "redId": 1, "whiteId": 2}
  ]
}
```

Choose distinct codes using letters, digits, underscores and hyphens. Codes are case-sensitive to users and unique across spellings that differ only by case. `DEMO-`, `TEST-` and `ARENA-TEST-` are reserved prefixes. Use unpredictable codes for the printed event, since possession grants the ability to read and correct a battle. Check the red and white order as part of print proofing.

Run `npm run fight-cards -- /path/to/manifest.json /path/to/new-output-directory`. It generates `register.sql` and a printable `fight-cards.html` without contacting a server or overwriting an existing output directory. QR codes always encode `https://pievspie.online/arena/?code=…`. Each visible fight card contains only the aliases, corners and code. Print from the browser and scan samples at the intended print size.

Review the entire manifest before importing. Repeating an identical import preserves the existing registrations and their active flags. Conflicting pairings or case variants reject the whole generated insert. An issued code's ordered pairing is permanent. If an organiser needs to retire one, deactivate it through the approved operational process, preserve its history, and generate a fresh code for the replacement. Install the latest migrations and run the import against a disposable local database first.
