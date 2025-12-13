import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { cache, cacheKeys } from '../utils/cache.js';

const router = express.Router();

// Get all packages for an artist (public)
router.get('/artist/:artistId', async (req, res) => {
  try {
    const { artistId } = req.params;

    // Try cache first
    const cacheKey = `artist:${artistId}:packages`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get active packages with their add-ons
    const { data: packages, error } = await supabaseAdmin
      .from('commission_packages')
      .select(`
        *,
        addons:commission_package_addons(*)
      `)
      .eq('artist_id', artistId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    
    // Ensure thumbnail_url is set from example_image_urls if available
    if (packages) {
      packages.forEach(pkg => {
        if (!pkg.thumbnail_url && pkg.example_image_urls && pkg.example_image_urls.length > 0) {
          pkg.thumbnail_url = pkg.example_image_urls[0];
        }
        if (!pkg.image_url && pkg.example_image_urls && pkg.example_image_urls.length > 0) {
          pkg.image_url = pkg.example_image_urls[0];
        }
      });
    }

    if (error) throw error;

    // Cache for 5 minutes
    await cache.set(cacheKey, packages || [], 300);

    res.json(packages || []);
  } catch (error) {
    console.error('Error fetching artist packages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get artist's commission settings (public)
router.get('/settings/:artistId', async (req, res) => {
  try {
    const { artistId } = req.params;

    const { data: settings, error } = await supabaseAdmin
      .from('artist_commission_settings')
      .select('*')
      .eq('artist_id', artistId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;

    // If no settings exist, return defaults
    if (!settings) {
      return res.json({
        artist_id: artistId,
        max_queue_slots: 5,
        allow_waitlist: false,
        is_open: true,
        status_message: null,
        terms_of_service: null,
        will_draw: [],
        wont_draw: [],
        avg_response_hours: null
      });
    }

    res.json(settings);
  } catch (error) {
    console.error('Error fetching commission settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get current queue count for artist (public)
router.get('/queue/:artistId', async (req, res) => {
  try {
    const { artistId } = req.params;

    // Count active commissions (pending, accepted, in_progress)
    const { data, error } = await supabaseAdmin
      .from('commissions')
      .select('id', { count: 'exact', head: true })
      .eq('artist_id', artistId)
      .in('status', ['pending', 'accepted', 'in_progress']);

    if (error) throw error;

    // Get max slots
    const { data: settings } = await supabaseAdmin
      .from('artist_commission_settings')
      .select('max_queue_slots, allow_waitlist')
      .eq('artist_id', artistId)
      .maybeSingle();

    const maxSlots = settings?.max_queue_slots || 5;
    const currentCount = data || 0;
    const allowWaitlist = settings?.allow_waitlist || false;

    res.json({
      current: currentCount,
      max: maxSlots,
      available: Math.max(0, maxSlots - currentCount),
      is_full: currentCount >= maxSlots,
      allow_waitlist: allowWaitlist
    });
  } catch (error) {
    console.error('Error fetching queue status:', error);
    res.status(500).json({ error: error.message });
  }
});

// === ARTIST ONLY ROUTES (requires authentication and artist verification) ===

// Middleware to verify user is an artist
const verifyArtist = async (req, res, next) => {
  try {
    console.log('VerifyArtist - Looking up artist for user_id:', req.user.id);

    // Note: artists.id IS the user_id (artists table primary key IS the user_id)
    const { data: artist, error } = await supabaseAdmin
      .from('artists')
      .select('id')
      .eq('id', req.user.id)
      .maybeSingle();

    console.log('VerifyArtist - Query result:', { artist, error: error?.message });

    if (error) {
      console.error('VerifyArtist - Database error:', error);
      return res.status(500).json({ error: 'Database error: ' + error.message });
    }

    if (!artist) {
      console.log('VerifyArtist - No artist found for user_id:', req.user.id);
      return res.status(403).json({ error: 'Only artists can manage commission packages. Please complete artist onboarding first.' });
    }

    console.log('VerifyArtist - Success! Artist ID:', artist.id);
    req.artistId = artist.id;
    next();
  } catch (error) {
    console.error('Error verifying artist:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get my packages (including inactive)
router.get('/my-packages', authenticate, verifyArtist, async (req, res) => {
  try {
    const { data: packages, error } = await supabaseAdmin
      .from('commission_packages')
      .select(`
        *,
        addons:commission_package_addons(*)
      `)
      .eq('artist_id', req.artistId)
      .order('display_order', { ascending: true });

    if (error) throw error;

    res.json(packages || []);
  } catch (error) {
    console.error('Error fetching my packages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new package
router.post('/create', authenticate, verifyArtist, async (req, res) => {
  try {
    const {
      name,
      description,
      base_price,
      estimated_delivery_days,
      revision_count,
      example_image_urls,
      custom_form_fields,
      is_active = true,
      display_order = 0
    } = req.body;

    if (!name || !base_price) {
      return res.status(400).json({ error: 'name and base_price are required' });
    }

    if (base_price < 0) {
      return res.status(400).json({ error: 'base_price must be positive' });
    }

    const { data: newPackage, error } = await supabaseAdmin
      .from('commission_packages')
      .insert({
        artist_id: req.artistId,
        name,
        description,
        base_price,
        estimated_delivery_days,
        revision_count: revision_count || 2,
        example_image_urls: example_image_urls || [],
        custom_form_fields: custom_form_fields || null,
        is_active,
        display_order
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'You already have a package with this name' });
      }
      throw error;
    }

    // Invalidate cache
    const cacheKey = `artist:${req.artistId}:packages`;
    await cache.del(cacheKey);

    res.status(201).json(newPackage);
  } catch (error) {
    console.error('Error creating package:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a package
router.put('/:packageId', authenticate, verifyArtist, async (req, res) => {
  try {
    const { packageId } = req.params;
    const {
      name,
      description,
      base_price,
      estimated_delivery_days,
      revision_count,
      example_image_urls,
      custom_form_fields,
      is_active,
      display_order
    } = req.body;

    // Verify ownership
    const { data: existingPackage, error: fetchError } = await supabaseAdmin
      .from('commission_packages')
      .select('artist_id')
      .eq('id', packageId)
      .maybeSingle();

    if (fetchError || !existingPackage) {
      return res.status(404).json({ error: 'Package not found' });
    }

    if (existingPackage.artist_id !== req.artistId) {
      return res.status(403).json({ error: 'Not authorized to update this package' });
    }

    // Build updates object
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (base_price !== undefined) {
      if (base_price < 0) {
        return res.status(400).json({ error: 'base_price must be positive' });
      }
      updates.base_price = base_price;
    }
    if (estimated_delivery_days !== undefined) updates.estimated_delivery_days = estimated_delivery_days;
    if (revision_count !== undefined) updates.revision_count = revision_count;
    if (example_image_urls !== undefined) {
      updates.example_image_urls = example_image_urls;
    }
    if (custom_form_fields !== undefined) updates.custom_form_fields = custom_form_fields || null;
    if (is_active !== undefined) updates.is_active = is_active;
    if (display_order !== undefined) updates.display_order = display_order;

    const { data: updatedPackage, error } = await supabaseAdmin
      .from('commission_packages')
      .update(updates)
      .eq('id', packageId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'You already have a package with this name' });
      }
      throw error;
    }

    // Invalidate cache
    const cacheKey = `artist:${req.artistId}:packages`;
    await cache.del(cacheKey);

    res.json(updatedPackage);
  } catch (error) {
    console.error('Error updating package:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a package
router.delete('/:packageId', authenticate, verifyArtist, async (req, res) => {
  try {
    const { packageId } = req.params;

    // Verify ownership
    const { data: existingPackage, error: fetchError } = await supabaseAdmin
      .from('commission_packages')
      .select('artist_id')
      .eq('id', packageId)
      .maybeSingle();

    if (fetchError || !existingPackage) {
      return res.status(404).json({ error: 'Package not found' });
    }

    if (existingPackage.artist_id !== req.artistId) {
      return res.status(403).json({ error: 'Not authorized to delete this package' });
    }

    const { error } = await supabaseAdmin
      .from('commission_packages')
      .delete()
      .eq('id', packageId);

    if (error) throw error;

    // Invalidate cache
    const cacheKey = `artist:${req.artistId}:packages`;
    await cache.del(cacheKey);

    res.json({ message: 'Package deleted successfully' });
  } catch (error) {
    console.error('Error deleting package:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add add-on to a package
router.post('/:packageId/addons', authenticate, verifyArtist, async (req, res) => {
  try {
    const { packageId } = req.params;
    const { name, description, price } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'name and price are required' });
    }

    if (price < 0) {
      return res.status(400).json({ error: 'price must be positive' });
    }

    // Verify package ownership
    const { data: pkg, error: packageError } = await supabaseAdmin
      .from('commission_packages')
      .select('artist_id')
      .eq('id', packageId)
      .maybeSingle();

    if (packageError || !pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }

    if (pkg.artist_id !== req.artistId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: addon, error } = await supabaseAdmin
      .from('commission_package_addons')
      .insert({
        package_id: packageId,
        name,
        description,
        price
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'This package already has an add-on with this name' });
      }
      throw error;
    }

    // Invalidate cache
    const cacheKey = `artist:${req.artistId}:packages`;
    await cache.del(cacheKey);

    res.status(201).json(addon);
  } catch (error) {
    console.error('Error creating add-on:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete an add-on
router.delete('/addons/:addonId', authenticate, verifyArtist, async (req, res) => {
  try {
    const { addonId } = req.params;

    // Get addon with package info to verify ownership
    const { data: addon, error: fetchError } = await supabaseAdmin
      .from('commission_package_addons')
      .select(`
        *,
        package:commission_packages(artist_id)
      `)
      .eq('id', addonId)
      .maybeSingle();

    if (fetchError || !addon) {
      return res.status(404).json({ error: 'Add-on not found' });
    }

    if (addon.package.artist_id !== req.artistId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { error } = await supabaseAdmin
      .from('commission_package_addons')
      .delete()
      .eq('id', addonId);

    if (error) throw error;

    // Invalidate cache
    const cacheKey = `artist:${req.artistId}:packages`;
    await cache.del(cacheKey);

    res.json({ message: 'Add-on deleted successfully' });
  } catch (error) {
    console.error('Error deleting add-on:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update or create commission settings
router.post('/settings', authenticate, verifyArtist, async (req, res) => {
  try {
    const {
      max_queue_slots,
      allow_waitlist,
      is_open,
      status_message,
      terms_of_service,
      will_draw,
      wont_draw,
      avg_response_hours
    } = req.body;

    // Check if settings exist
    const { data: existing } = await supabaseAdmin
      .from('artist_commission_settings')
      .select('artist_id')
      .eq('artist_id', req.artistId)
      .maybeSingle();

    const settingsData = {
      artist_id: req.artistId
    };

    if (max_queue_slots !== undefined) settingsData.max_queue_slots = max_queue_slots;
    if (allow_waitlist !== undefined) settingsData.allow_waitlist = allow_waitlist;
    if (is_open !== undefined) settingsData.is_open = is_open;
    if (status_message !== undefined) settingsData.status_message = status_message;
    if (terms_of_service !== undefined) settingsData.terms_of_service = terms_of_service;
    if (will_draw !== undefined) settingsData.will_draw = will_draw;
    if (wont_draw !== undefined) settingsData.wont_draw = wont_draw;
    if (avg_response_hours !== undefined) settingsData.avg_response_hours = avg_response_hours;

    let result;
    if (existing) {
      // Update
      const { data, error } = await supabaseAdmin
        .from('artist_commission_settings')
        .update(settingsData)
        .eq('artist_id', req.artistId)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insert
      const { data, error } = await supabaseAdmin
        .from('artist_commission_settings')
        .insert(settingsData)
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    res.json(result);
  } catch (error) {
    console.error('Error updating commission settings:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
