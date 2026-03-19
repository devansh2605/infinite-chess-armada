-- Run this in your Supabase SQL editor

-- ============================================================
-- profiles: one row per user, created automatically on signup
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username     VARCHAR(20) NOT NULL UNIQUE,
  rating       INTEGER NOT NULL DEFAULT 1500,
  games_played INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_rating_idx ON public.profiles (rating DESC);

-- Auto-create profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- games
-- ============================================================
CREATE TABLE IF NOT EXISTS public.games (
  id                    TEXT PRIMARY KEY NOT NULL,
  room_code             CHAR(6) UNIQUE,
  status                TEXT NOT NULL DEFAULT 'lobby',
  mode                  TEXT NOT NULL DEFAULT 'Rated',
  creator_id            UUID REFERENCES public.profiles(id),
  player1               UUID REFERENCES public.profiles(id),
  player2               UUID REFERENCES public.profiles(id),
  player3               UUID REFERENCES public.profiles(id),
  player4               UUID REFERENCES public.profiles(id),
  player1_rating_start  INTEGER,
  player2_rating_start  INTEGER,
  player3_rating_start  INTEGER,
  player4_rating_start  INTEGER,
  engine_slots          JSONB NOT NULL DEFAULT '{}',
  engine_levels         JSONB NOT NULL DEFAULT '{}',
  minutes               SMALLINT NOT NULL DEFAULT 5,
  increment             SMALLINT NOT NULL DEFAULT 5,
  moves                 TEXT,
  left_fens             TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  right_fens            TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  left_reserve_white    TEXT,
  left_reserve_black    TEXT,
  right_reserve_white   TEXT,
  right_reserve_black   TEXT,
  left_promoted_pieces  TEXT,
  right_promoted_pieces TEXT,
  left_last_move        TEXT DEFAULT '[]',
  right_last_move       TEXT DEFAULT '[]',
  left_color_to_play    TEXT DEFAULT 'white',
  right_color_to_play   TEXT DEFAULT 'white',
  left_last_time        BIGINT,
  right_last_time       BIGINT,
  clocks                TEXT DEFAULT '0,0,0,0',
  resign_state          TEXT DEFAULT '0,0,0,0',
  draw_state            TEXT DEFAULT '0,0,0,0',
  termination           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS games_room_code_idx ON public.games (room_code) WHERE room_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS games_status_idx    ON public.games (status);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "games_select_all" ON public.games;
CREATE POLICY "games_select_all" ON public.games FOR SELECT USING (true);

-- ============================================================
-- rating_history
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rating_history (
  id           BIGSERIAL PRIMARY KEY,
  game_id      TEXT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slot         SMALLINT NOT NULL CHECK (slot BETWEEN 1 AND 4),
  rating_before INTEGER NOT NULL,
  rating_after  INTEGER NOT NULL,
  result        TEXT NOT NULL CHECK (result IN ('win','loss','draw')),
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rating_history_player_idx ON public.rating_history (player_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS rating_history_game_idx   ON public.rating_history (game_id);
