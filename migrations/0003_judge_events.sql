-- Append-only judge events. Separate from legacy and load test results.
CREATE TABLE IF NOT EXISTS battle_pairs (
 code TEXT PRIMARY KEY, red TEXT NOT NULL, white TEXT NOT NULL, CHECK(red<>white)
);
CREATE TABLE IF NOT EXISTS judge_events (
 seq INTEGER PRIMARY KEY AUTOINCREMENT,
 operation_id TEXT NOT NULL UNIQUE,
 code TEXT NOT NULL REFERENCES battle_pairs(code),
 judge_id TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>=1),
 action TEXT NOT NULL CHECK(action IN ('add','edit','remove','restore')),
 winner TEXT NOT NULL,
 notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(code,judge_id,revision)
);
CREATE INDEX IF NOT EXISTS judge_events_lookup ON judge_events(code,judge_id,revision);
CREATE VIEW IF NOT EXISTS current_judges AS SELECT e.* FROM judge_events e WHERE NOT EXISTS (SELECT 1 FROM judge_events n WHERE n.code=e.code AND n.judge_id=e.judge_id AND n.revision>e.revision);
CREATE TRIGGER IF NOT EXISTS judge_events_no_update BEFORE UPDATE ON judge_events BEGIN SELECT RAISE(ABORT,'Audit events immutable'); END;
CREATE TRIGGER IF NOT EXISTS judge_events_no_delete BEFORE DELETE ON judge_events BEGIN SELECT RAISE(ABORT,'Audit events immutable'); END;
