-- Comprehensive Art Styles & Genres Seed Script
-- Run this script to populate the art_styles table with a wide variety of styles

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS art_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert comprehensive list of art styles
-- Using ON CONFLICT to prevent duplicates if run multiple times
INSERT INTO art_styles (name, slug, description) VALUES
  -- Character Art Styles
  ('Anime', 'anime', 'Japanese animation style with distinctive features'),
  ('Manga', 'manga', 'Japanese comic book style'),
  ('Chibi', 'chibi', 'Cute, small character style with oversized heads'),
  ('Kemono', 'kemono', 'Anthropomorphic animal characters'),
  ('Furry', 'furry', 'Anthropomorphic animal art'),
  ('Realism', 'realism', 'Photorealistic artwork'),
  ('Semi-Realistic', 'semi-realistic', 'Mix of realistic and stylized'),
  ('Cartoon', 'cartoon', 'Cartoon and comic style'),
  ('Disney Style', 'disney-style', 'Classic Disney animation style'),
  ('Pixar Style', 'pixar-style', '3D animated Pixar-style characters'),
  ('Western Cartoon', 'western-cartoon', 'Western animation style'),
  ('Anime Realistic', 'anime-realistic', 'Realistic anime style'),
  ('Kawaii', 'kawaii', 'Cute Japanese aesthetic'),
  ('Moe', 'moe', 'Cute character art style'),
  
  -- Traditional Art Mediums
  ('Watercolor', 'watercolor', 'Watercolor painting style'),
  ('Oil Painting', 'oil-painting', 'Traditional oil painting'),
  ('Acrylic', 'acrylic', 'Acrylic painting'),
  ('Gouache', 'gouache', 'Opaque watercolor painting'),
  ('Pastel', 'pastel', 'Soft pastel artwork'),
  ('Charcoal', 'charcoal', 'Charcoal drawing'),
  ('Pencil', 'pencil', 'Pencil sketch and drawing'),
  ('Ink', 'ink', 'Ink drawing and illustration'),
  ('Pen & Ink', 'pen-ink', 'Pen and ink illustration'),
  ('Marker', 'marker', 'Marker art'),
  ('Colored Pencil', 'colored-pencil', 'Colored pencil artwork'),
  
  -- Digital Art Styles
  ('Digital Painting', 'digital-painting', 'Digital painting techniques'),
  ('Digital Art', 'digital-art', 'General digital artwork'),
  ('Vector', 'vector', 'Vector art style'),
  ('Pixel Art', 'pixel-art', 'Pixel-based artwork'),
  ('Low Poly', 'low-poly', 'Low polygon 3D style'),
  ('Isometric', 'isometric', 'Isometric perspective art'),
  ('Flat Design', 'flat-design', 'Minimalist flat design'),
  ('Gradient Art', 'gradient-art', 'Gradient-based artwork'),
  ('Glitch Art', 'glitch-art', 'Digital glitch aesthetic'),
  ('Vaporwave', 'vaporwave', 'Vaporwave aesthetic'),
  ('Synthwave', 'synthwave', 'Synthwave/outrun style'),
  
  -- 3D Art
  ('3D Modeling', '3d-modeling', 'Three-dimensional models'),
  ('3D Rendering', '3d-rendering', '3D rendered artwork'),
  ('3D Character', '3d-character', '3D character modeling'),
  ('Sculpture', 'sculpture', '3D sculpted artwork'),
  ('Blender', 'blender', 'Blender 3D artwork'),
  ('ZBrush', 'zbrush', 'ZBrush sculpting'),
  
  -- Illustration Styles
  ('Illustration', 'illustration', 'General illustration'),
  ('Concept Art', 'concept-art', 'Concept art and design'),
  ('Character Design', 'character-design', 'Character design and development'),
  ('Portrait', 'portrait', 'Portrait artwork'),
  ('Landscape', 'landscape', 'Landscape art'),
  ('Still Life', 'still-life', 'Still life artwork'),
  ('Architectural', 'architectural', 'Architectural illustration'),
  ('Technical Drawing', 'technical-drawing', 'Technical and engineering drawings'),
  ('Medical Illustration', 'medical-illustration', 'Medical and scientific illustration'),
  ('Botanical', 'botanical', 'Botanical and nature illustration'),
  
  -- Genre/Thematic Styles
  ('Fantasy', 'fantasy', 'Fantasy and magical themes'),
  ('Sci-Fi', 'sci-fi', 'Science fiction style'),
  ('Horror', 'horror', 'Dark and horror-themed art'),
  ('Cyberpunk', 'cyberpunk', 'Cyberpunk aesthetic'),
  ('Steampunk', 'steampunk', 'Steampunk style'),
  ('Medieval', 'medieval', 'Medieval and historical art'),
  ('Victorian', 'victorian', 'Victorian era style'),
  ('Gothic', 'gothic', 'Gothic art style'),
  ('Dark Fantasy', 'dark-fantasy', 'Dark fantasy themes'),
  ('Post-Apocalyptic', 'post-apocalyptic', 'Post-apocalyptic themes'),
  ('Space', 'space', 'Space and cosmic themes'),
  ('Nature', 'nature', 'Nature and wildlife art'),
  ('Animal', 'animal', 'Animal artwork'),
  ('Pet Portrait', 'pet-portrait', 'Pet and animal portraits'),
  
  -- Abstract & Modern Art
  ('Abstract', 'abstract', 'Abstract and non-representational'),
  ('Minimalist', 'minimalist', 'Minimalist art style'),
  ('Surrealism', 'surrealism', 'Surrealist art'),
  ('Impressionism', 'impressionism', 'Impressionist painting style'),
  ('Expressionism', 'expressionism', 'Expressionist art'),
  ('Pop Art', 'pop-art', 'Pop art style'),
  ('Art Deco', 'art-deco', 'Art Deco style'),
  ('Art Nouveau', 'art-nouveau', 'Art Nouveau style'),
  ('Cubism', 'cubism', 'Cubist art style'),
  ('Modern Art', 'modern-art', 'Modern art movement'),
  ('Contemporary', 'contemporary', 'Contemporary art'),
  
  -- Specialized Styles
  ('Logo Design', 'logo-design', 'Logo and branding design'),
  ('Typography', 'typography', 'Typography and lettering'),
  ('Calligraphy', 'calligraphy', 'Calligraphy and hand lettering'),
  ('Graffiti', 'graffiti', 'Graffiti and street art'),
  ('Tattoo Design', 'tattoo-design', 'Tattoo design and flash art'),
  ('Comic Book', 'comic-book', 'Comic book style'),
  ('Webtoon', 'webtoon', 'Webtoon style'),
  ('Manhwa', 'manhwa', 'Korean comic style'),
  ('Manhua', 'manhua', 'Chinese comic style'),
  ('NSFW', 'nsfw', 'Adult/mature content'),
  ('SFW', 'sfw', 'Safe for work content'),
  
  -- Art Techniques
  ('Cell Shading', 'cell-shading', 'Cell shading technique'),
  ('Soft Shading', 'soft-shading', 'Soft shading technique'),
  ('Hard Shading', 'hard-shading', 'Hard edge shading'),
  ('Painterly', 'painterly', 'Painterly brushwork style'),
  ('Sketch', 'sketch', 'Sketch and line art'),
  ('Rendered', 'rendered', 'Fully rendered artwork'),
  ('Monochrome', 'monochrome', 'Single color artwork'),
  ('Full Color', 'full-color', 'Full color artwork'),
  
  -- Cultural & Regional Styles
  ('Japanese', 'japanese', 'Japanese art style'),
  ('Chinese', 'chinese', 'Chinese art style'),
  ('Korean', 'korean', 'Korean art style'),
  ('Western', 'western', 'Western art style'),
  ('European', 'european', 'European art style'),
  ('American', 'american', 'American art style')
ON CONFLICT (name) DO NOTHING;

-- Verify the insert
SELECT COUNT(*) as total_styles FROM art_styles;

-- Display all inserted styles
SELECT name, slug, description FROM art_styles ORDER BY name;

