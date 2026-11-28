ALTER TABLE judge_events ADD COLUMN restored_from_seq INTEGER REFERENCES judge_events(seq);
