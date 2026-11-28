CREATE UNIQUE INDEX registered_fights_code_nocase ON registered_fights(fight_code COLLATE NOCASE);
CREATE TRIGGER registered_fights_fixed_pair
BEFORE UPDATE OF fight_code, red_fighter, white_fighter ON registered_fights
WHEN OLD.fight_code <> NEW.fight_code OR OLD.red_fighter <> NEW.red_fighter OR OLD.white_fighter <> NEW.white_fighter
BEGIN
  SELECT RAISE(ABORT, 'Registered fight code and pairing are permanent');
END;
CREATE TRIGGER registered_fights_no_delete
BEFORE DELETE ON registered_fights
BEGIN
  SELECT RAISE(ABORT, 'Deactivate registered fights instead of deleting them');
END;
