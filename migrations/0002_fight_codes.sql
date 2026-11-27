-- Foundation only. Apply to test DB first; do not enforce until competition rules are approved.
CREATE TABLE IF NOT EXISTS registered_fights (
 fight_code TEXT PRIMARY KEY NOT NULL CHECK(length(fight_code) BETWEEN 1 AND 100),
 red_fighter TEXT NOT NULL,
 white_fighter TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 CHECK(red_fighter <> white_fighter)
);
