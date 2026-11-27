CREATE TABLE fight_results (
 request_id TEXT PRIMARY KEY,
 competition TEXT NOT NULL CHECK (competition IN ('pie','log')),
 fight_code TEXT NOT NULL,
 red_fighter TEXT NOT NULL,
 white_fighter TEXT NOT NULL,
 winner TEXT NOT NULL,
 loser TEXT NOT NULL,
 tasting_notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 CHECK (red_fighter <> white_fighter),
 CHECK ((winner=red_fighter AND loser=white_fighter) OR (winner=white_fighter AND loser=red_fighter))
);
CREATE INDEX fight_results_code ON fight_results(competition,fight_code);
