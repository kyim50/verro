-- Commission Packages Table
-- Allows artists to create predefined commission types with pricing and details
CREATE TABLE IF NOT EXISTS commission_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,

  -- Package details
  name VARCHAR(100) NOT NULL, -- e.g., "Headshot", "Full Body", "Character Design"
  description TEXT,
  base_price DECIMAL(10, 2) NOT NULL,

  -- Delivery and revisions
  estimated_delivery_days INTEGER, -- How many days to complete
  revision_count INTEGER DEFAULT 2, -- Number of included revisions

  -- Package settings
  is_active BOOLEAN DEFAULT true, -- Can be toggled on/off
  display_order INTEGER DEFAULT 0, -- For sorting packages

  -- Example images for this package type
  example_image_urls TEXT[], -- Array of image URLs

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_artist_package_name UNIQUE(artist_id, name)
);

-- Commission Package Add-ons Table
-- Additional options clients can purchase with a package
CREATE TABLE IF NOT EXISTS commission_package_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES commission_packages(id) ON DELETE CASCADE,

  name VARCHAR(100) NOT NULL, -- e.g., "Extra Character", "Complex Background", "Commercial Use"
  description TEXT,
  price DECIMAL(10, 2) NOT NULL, -- Additional cost

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_package_addon_name UNIQUE(package_id, name)
);

-- Update commissions table to support packages
ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES commission_packages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS selected_addons JSONB DEFAULT '[]'::jsonb, -- Array of addon IDs with details
  ADD COLUMN IF NOT EXISTS final_price DECIMAL(10, 2); -- Total price including add-ons

-- Artist Commission Settings
-- Global settings for an artist's commission availability
CREATE TABLE IF NOT EXISTS artist_commission_settings (
  artist_id UUID PRIMARY KEY REFERENCES artists(id) ON DELETE CASCADE,

  -- Queue settings
  max_queue_slots INTEGER DEFAULT 5, -- How many commissions can be active at once
  allow_waitlist BOOLEAN DEFAULT false, -- Can clients join a waitlist when slots are full

  -- Availability
  is_open BOOLEAN DEFAULT true, -- Are commissions open
  status_message TEXT, -- e.g., "On hiatus until March", "Open for commissions!"

  -- Terms
  terms_of_service TEXT, -- Artist's custom ToS
  will_draw TEXT[], -- Array of things the artist will draw
  wont_draw TEXT[], -- Array of things the artist won't draw

  -- Response time
  avg_response_hours INTEGER, -- Average response time in hours

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_commission_packages_artist ON commission_packages(artist_id);
CREATE INDEX IF NOT EXISTS idx_commission_packages_active ON commission_packages(artist_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_commission_package_addons_package ON commission_package_addons(package_id);
CREATE INDEX IF NOT EXISTS idx_commissions_package ON commissions(package_id);
CREATE INDEX IF NOT EXISTS idx_artist_commission_settings_open ON artist_commission_settings(artist_id) WHERE is_open = true;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_commission_packages_updated_at
  BEFORE UPDATE ON commission_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_artist_commission_settings_updated_at
  BEFORE UPDATE ON artist_commission_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
