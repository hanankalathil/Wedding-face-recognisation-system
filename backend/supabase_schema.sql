-- Supabase SQL Schema for Wedding Face Recognition System
-- Run this script in your Supabase SQL Editor to set up required tables, indexes, and permissions.

-- 1. Persons Table
CREATE TABLE IF NOT EXISTS persons (
    id TEXT PRIMARY KEY,
    representative_embedding JSONB NOT NULL,
    avatar_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Photos Metadata Table
CREATE TABLE IF NOT EXISTS photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_path TEXT UNIQUE NOT NULL,
    url_path TEXT UNIQUE NOT NULL,
    filename TEXT NOT NULL,
    category TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Person Photos Junction Table
CREATE TABLE IF NOT EXISTS person_photos (
    person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    PRIMARY KEY (person_id, photo_url)
);

-- 4. Couple Photos Table
CREATE TABLE IF NOT EXISTS couple_photos (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    category TEXT NOT NULL,
    url TEXT NOT NULL,
    path TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Couple Categories Table
CREATE TABLE IF NOT EXISTS couple_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    sort_order INT DEFAULT 0
);

-- 6. Couple Settings Table
CREATE TABLE IF NOT EXISTS couple_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_person_photos_pid ON person_photos(person_id);
CREATE INDEX IF NOT EXISTS idx_couple_photos_cat ON couple_photos(category);

-- Grant privileges to service_role and postgres
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
