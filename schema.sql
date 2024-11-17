-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Images table
CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Likes table
CREATE TABLE likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, image_id)
);

-- Create indexes
CREATE INDEX idx_images_user_id ON images(user_id);
CREATE INDEX idx_likes_user_id ON likes(user_id);
CREATE INDEX idx_likes_image_id ON likes(image_id);

-- Update updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_images_updated_at
    BEFORE UPDATE ON images
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own record" ON users
    FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Admins can view all records" ON users
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin');

-- RLS Policies for images table
CREATE POLICY "Anyone can view images" ON images
    FOR SELECT
    USING (true);

CREATE POLICY "Users can insert own images" ON images
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own images" ON images
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own images" ON images
    FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can update all images" ON images
    FOR UPDATE
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can delete all images" ON images
    FOR DELETE
    USING (auth.jwt() ->> 'role' = 'admin');

-- RLS Policies for likes table
CREATE POLICY "Users can view own likes" ON likes
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own likes" ON likes
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes" ON likes
    FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all likes" ON likes
    FOR SELECT
    USING (auth.jwt() ->> 'role' = 'admin');

-- Create views for common queries
CREATE VIEW user_likes_count AS
SELECT image_id, COUNT(*) as likes_count
FROM likes
GROUP BY image_id;

CREATE VIEW user_liked_images AS
SELECT u.id as user_id, i.*
FROM users u
JOIN likes l ON u.id = l.user_id
JOIN images i ON l.image_id = i.id;