import express from 'express';
import { query, validationResult, body } from 'express-validator';
import { supabaseAdmin } from '../config/supabase.js';
import { optionalAuth, authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get all artists with enhanced filters
router.get(
  '/',
  optionalAuth,
  [
    query('search').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('style').optional().isUUID(), // Filter by art style ID
    query('styles').optional().isString(), // Comma-separated style IDs
    query('commission_type').optional().isString(), // Filter by commission type
    query('price_min').optional().isFloat({ min: 0 }).toFloat(),
    query('price_max').optional().isFloat({ min: 0 }).toFloat(),
    query('turnaround_max').optional().isInt({ min: 1 }).toInt(), // Max days
    query('language').optional().isString(), // Filter by language
    query('similar_to').optional().isUUID(), // Find artists similar to this artist ID
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        search: searchQuery,
        limit = 50,
        style: styleId,
        styles: stylesParam,
        commission_type,
        price_min,
        price_max,
        turnaround_max,
        language,
        similar_to
      } = req.query;

      // Handle "find similar artists" feature
      if (similar_to) {
        // Get the reference artist's styles
        const { data: refArtist } = await supabaseAdmin
          .from('artists')
          .select('primary_style_id')
          .eq('id', similar_to)
          .single();

        if (!refArtist) {
          return res.status(404).json({ error: 'Reference artist not found' });
        }

        // Get artists with similar styles
        let similarQuery = supabaseAdmin
          .from('artists')
          .select(`
            *,
            users(id, username, avatar_url, full_name, bio),
            primary_style:art_styles!artists_primary_style_id_fkey(id, name, slug)
          `)
          .in('commission_status', ['open', 'limited'])
          .neq('id', similar_to);

        if (refArtist.primary_style_id) {
          // Find artists with same primary style or related styles
          const { data: styleArtists } = await supabaseAdmin
            .from('artist_art_styles')
            .select('artist_id')
            .eq('style_id', refArtist.primary_style_id);

          const similarArtistIds = styleArtists?.map(s => s.artist_id) || [];
          if (similarArtistIds.length > 0) {
            similarQuery = similarQuery.in('id', similarArtistIds);
          } else {
            similarQuery = similarQuery.eq('primary_style_id', refArtist.primary_style_id);
          }
        }

        if (req.user) {
          similarQuery = similarQuery.neq('id', req.user.id);
        }

        const { data: artists, error } = await similarQuery
          .order('rating', { ascending: false })
          .limit(limit);

        if (error) throw error;
        return res.json({ artists: artists || [] });
      }

      // Build base query
      // Note: We'll apply commission_status filter AFTER search to ensure search works
      let artistQuery = supabaseAdmin
        .from('artists')
        .select(`
          *,
          users(id, username, avatar_url, full_name, bio),
          primary_style:art_styles!artists_primary_style_id_fkey(id, name, slug),
          art_styles:artist_art_styles(style:art_styles(id, name, slug))
        `);

      // Text search filter
      if (searchQuery && searchQuery.trim().length > 0) {
        const trimmedQuery = searchQuery.trim();
        const searchPattern = `%${trimmedQuery}%`;
        
        console.log('Searching for artists with query:', trimmedQuery);
        console.log('Search pattern:', searchPattern);
        
        // Search users table for matching usernames or full names
        // Use separate queries and combine results (more reliable than .or())
        // Note: artists.id = users.id (artists table uses user_id as primary key)
        const usernameQuery = supabaseAdmin
          .from('users')
          .select('id, username')
          .ilike('username', searchPattern);
        
        const nameQuery = supabaseAdmin
          .from('users')
          .select('id, full_name')
          .ilike('full_name', searchPattern);
        
        const [usernameResult, nameResult] = await Promise.all([
          usernameQuery,
          nameQuery
        ]);
        
        const { data: usersByUsername, error: usernameError } = usernameResult;
        const { data: usersByName, error: nameError } = nameResult;

        console.log('Username search results:', usersByUsername?.length || 0);
        if (usernameError) {
          console.error('Username search error:', usernameError);
        }
        console.log('Name search results:', usersByName?.length || 0);
        if (nameError) {
          console.error('Name search error:', nameError);
        }
        
        // Combine results and remove duplicates
        const allUserIds = [
          ...(usersByUsername || []).map(u => u.id),
          ...(usersByName || []).map(u => u.id)
        ];
        const uniqueUserIds = [...new Set(allUserIds)];
        
        console.log('Found matching users:', uniqueUserIds.length);
        console.log('User IDs:', uniqueUserIds);
        if (usersByUsername?.length > 0) {
          console.log('Sample usernames found:', usersByUsername.slice(0, 3).map(u => u.username));
        }
        if (usersByName?.length > 0) {
          console.log('Sample names found:', usersByName.slice(0, 3).map(u => u.full_name));
        }
        
        if (uniqueUserIds.length > 0) {
          // Verify these users are actually artists
          const { data: existingArtists, error: artistCheckError } = await supabaseAdmin
            .from('artists')
            .select('id')
            .in('id', uniqueUserIds);
          
          console.log('Artists found for user IDs:', existingArtists?.length || 0);
          if (artistCheckError) {
            console.error('Error checking artists:', artistCheckError);
          }
          
          const artistIds = existingArtists?.map(a => a.id) || [];
          console.log('Valid artist IDs:', artistIds);
          
          if (artistIds.length > 0) {
            // artists.id = users.id, so we can directly filter
            artistQuery = artistQuery.in('id', artistIds);
            console.log('Filtering artists by user IDs:', artistIds.length);
          } else {
            // Users found but they're not artists
            console.log('Users found but none are artists, returning empty');
            return res.json({ artists: [] });
          }
        } else {
          // No matching users, return empty
          console.log('No matching users found, returning empty artists array');
          return res.json({ artists: [] });
        }
      }

      // Art style filter
      if (styleId) {
        // Get artists with this style
        const { data: styleArtists } = await supabaseAdmin
          .from('artist_art_styles')
          .select('artist_id')
          .eq('style_id', styleId);

        const styleArtistIds = styleArtists?.map(s => s.artist_id) || [];
        if (styleArtistIds.length > 0) {
          artistQuery = artistQuery.in('id', styleArtistIds);
        } else {
          return res.json({ artists: [] });
        }
      } else if (stylesParam) {
        // Multiple styles (OR logic - artist has any of these styles)
        const styleIds = stylesParam.split(',').filter(id => id.trim());
        if (styleIds.length > 0) {
          const { data: styleArtists } = await supabaseAdmin
            .from('artist_art_styles')
            .select('artist_id')
            .in('style_id', styleIds);

          const styleArtistIds = [...new Set(styleArtists?.map(s => s.artist_id) || [])];
          if (styleArtistIds.length > 0) {
            artistQuery = artistQuery.in('id', styleArtistIds);
          } else {
            return res.json({ artists: [] });
          }
        }
      }

      // Commission type filter
      if (commission_type) {
        artistQuery = artistQuery.contains('commission_types', [commission_type]);
      }

      // Price range filter
      if (price_min !== undefined) {
        artistQuery = artistQuery.gte('min_price', price_min);
      }
      if (price_max !== undefined) {
        artistQuery = artistQuery.lte('max_price', price_max);
      }

      // Turnaround time filter
      if (turnaround_max !== undefined) {
        artistQuery = artistQuery.lte('avg_turnaround_days', turnaround_max);
      }

      // Language filter
      if (language) {
        artistQuery = artistQuery.contains('languages', [language]);
      }

      // Apply commission_status filter (only show open/limited when not searching)
      // When searching, we want to find all artists first, then filter
      if (!searchQuery || searchQuery.trim().length === 0) {
        artistQuery = artistQuery.in('commission_status', ['open', 'limited']);
      } else {
        // When searching, include all commission statuses but prioritize open/limited
        // We'll filter in the results if needed
      }

      // Exclude current user if authenticated
      if (req.user) {
        artistQuery = artistQuery.neq('id', req.user.id);

        // Exclude swiped artists
        const { data: swipedArtists } = await supabaseAdmin
          .from('swipes')
          .select('artist_id')
          .eq('user_id', req.user.id);

        const swipedIds = swipedArtists?.map(s => s.artist_id) || [];
        if (swipedIds.length > 0) {
          artistQuery = artistQuery.not('id', 'in', `(${swipedIds.join(',')})`);
        }
      }

      const { data: artists, error } = await artistQuery
        .order('rating', { ascending: false })
        .limit(parseInt(limit));
      
      // Filter by commission_status after search if we have search results
      let filteredArtists = artists || [];
      if (searchQuery && searchQuery.trim().length > 0) {
        // When searching, prioritize open/limited but also show others
        filteredArtists = filteredArtists.filter(a => 
          ['open', 'limited', 'closed'].includes(a.commission_status)
        );
      } else {
        // When not searching, only show open/limited
        filteredArtists = filteredArtists.filter(a => 
          ['open', 'limited'].includes(a.commission_status)
        );
      }

      if (error) {
        console.error('Error fetching artists:', error);
        throw error;
      }
      
      console.log('Returning artists:', filteredArtists?.length || 0);
      res.json({ artists: filteredArtists || [] });
    } catch (error) {
      next(error);
    }
  }
);

// Get active commission packages for an artist (public)
router.get('/:id/packages', optionalAuth, async (req, res, next) => {
  try {
    const artistId = req.params.id;

    // Try cache
    const { cache } = await import('../utils/cache.js');
    const cacheKey = `artist:${artistId}:packages`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const { data: packages, error } = await supabaseAdmin
      .from('commission_packages')
      .select(`
        id,
        artist_id,
        name,
        description,
        base_price,
        estimated_delivery_days,
        revision_count,
        example_image_urls,
        is_active,
        display_order,
        addons:commission_package_addons(id, name, description, price)
      `)
      .eq('artist_id', artistId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    await cache.set(cacheKey, packages || [], 300);
    res.json(packages || []);
  } catch (error) {
    next(error);
  }
});

// Get artist profile
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    // Import cache utilities
    const { cache, cacheKeys } = await import('../utils/cache.js');

    // Try to get from cache
    const cacheKey = cacheKeys.artist(req.params.id);
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // First try to get the artist record
    const { data: artist, error } = await supabaseAdmin
      .from('artists')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    // Get the user data separately
    const userId = artist.user_id || artist.id;
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('id, username, avatar_url, full_name, bio')
      .eq('id', userId)
      .single();

    // Get artist's artworks
    const { data: artworks } = await supabaseAdmin
      .from('artworks')
      .select('*')
      .eq('artist_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Filter out empty portfolio images
    const portfolioImages = (artist.portfolio_images || []).filter(
      img => img && img.trim() !== ''
    );

    const response = {
      ...artist,
      portfolio_images: portfolioImages,
      user_id: userId,
      users: userData,
      artworks: artworks || []
    };

    // Cache for 10 minutes (cache and cacheKey already defined above)
    await cache.set(cacheKey, response, 600);

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Update artist profile (commission status, etc.)
router.put('/:id', authenticate, [
  body('commissionStatus').optional().isIn(['open', 'closed', 'limited']),
  body('minPrice').optional().isNumeric(),
  body('maxPrice').optional().isNumeric(),
  body('turnaroundDays').optional().isInt(),
  body('specialties').optional().isArray(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const artistId = req.params.id;

    // Verify user owns this artist profile
    if (req.user.id !== artistId) {
      return res.status(403).json({ error: 'You can only update your own artist profile' });
    }

    const { commissionStatus, minPrice, maxPrice, turnaroundDays, specialties } = req.body;

    // Get current commission status to detect changes
    const { data: currentArtist } = await supabaseAdmin
      .from('artists')
      .select('commission_status')
      .eq('id', artistId)
      .single();

    const updateData = {};
    if (commissionStatus !== undefined) updateData.commission_status = commissionStatus;
    if (minPrice !== undefined) updateData.min_price = minPrice;
    if (maxPrice !== undefined) updateData.max_price = maxPrice;
    if (turnaroundDays !== undefined) updateData.turnaround_days = turnaroundDays;
    if (specialties !== undefined) updateData.specialties = specialties;

    const { data: artist, error } = await supabaseAdmin
      .from('artists')
      .update(updateData)
      .eq('id', artistId)
      .select()
      .single();

    if (error) throw error;

    // Notify favorites when artist opens commissions
    if (commissionStatus !== undefined && 
        currentArtist?.commission_status === 'closed' && 
        (commissionStatus === 'open' || commissionStatus === 'limited')) {
      
      // Get all users who favorited this artist
      const { data: favorites } = await supabaseAdmin
        .from('favorite_artists')
        .select('user_id')
        .eq('artist_id', artistId);

      if (favorites && favorites.length > 0) {
        const { data: artistUser } = await supabaseAdmin
          .from('users')
          .select('username, full_name')
          .eq('id', artistId)
          .single();

        const { NotificationService } = await import('../utils/redisServices.js');
        const { sendPushToUser } = await import('../utils/pushNotifications.js');

        for (const favorite of favorites) {
          await NotificationService.publish(favorite.user_id, {
            type: 'favorite_artist_opened',
            title: 'Favorite Artist Opened Commissions! 🎨',
            message: `${artistUser?.username || 'An artist'} you favorited is now accepting commissions`,
            action: { type: 'view_artist', id: artistId },
            priority: 'high',
          });

          await sendPushToUser(favorite.user_id, {
            title: 'Favorite artist opened',
            body: `${artistUser?.username || 'An artist'} is now accepting commissions`,
            data: { type: 'artist', artistId },
          });
        }
      }
    }

    res.json({ message: 'Artist profile updated successfully', artist });
  } catch (error) {
    next(error);
  }
});

// Add artist to favorites
router.post('/:artistId/favorite', authenticate, async (req, res) => {
  try {
    const { artistId } = req.params;

    // Verify artist exists
    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('id')
      .eq('id', artistId)
      .maybeSingle();

    if (artistError || !artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    // Check if already favorited
    const { data: existing } = await supabaseAdmin
      .from('favorite_artists')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('artist_id', artistId)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'Artist already in favorites' });
    }

    // Add to favorites
    const { data: favorite, error } = await supabaseAdmin
      .from('favorite_artists')
      .insert({
        user_id: req.user.id,
        artist_id: artistId
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ message: 'Artist added to favorites', favorite });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove artist from favorites
router.delete('/:artistId/favorite', authenticate, async (req, res) => {
  try {
    const { artistId } = req.params;

    const { error } = await supabaseAdmin
      .from('favorite_artists')
      .delete()
      .eq('user_id', req.user.id)
      .eq('artist_id', artistId);

    if (error) throw error;

    res.json({ message: 'Artist removed from favorites' });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's favorite artists
router.get('/favorites/my-list', authenticate, async (req, res) => {
  try {
    // Get favorite artist IDs
    const { data: favorites, error: favError } = await supabaseAdmin
      .from('favorite_artists')
      .select('artist_id, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (favError) throw favError;

    if (!favorites || favorites.length === 0) {
      return res.json({ artists: [] });
    }

    const artistIds = favorites.map(f => f.artist_id);

    // Get artist details
    const { data: artists, error: artistError } = await supabaseAdmin
      .from('artists')
      .select(`
        *,
        users(id, username, avatar_url, full_name, bio)
      `)
      .in('id', artistIds);

    if (artistError) throw artistError;

    // Map with favorited_at timestamp
    const favoritesMap = new Map(favorites.map(f => [f.artist_id, f.created_at]));
    const artistsWithFavDate = artists?.map(artist => ({
      ...artist,
      favorited_at: favoritesMap.get(artist.id)
    })) || [];

    res.json({ artists: artistsWithFavDate });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if artist is favorited
router.get('/:artistId/favorite/status', authenticate, async (req, res) => {
  try {
    const { artistId } = req.params;

    const { data: favorite } = await supabaseAdmin
      .from('favorite_artists')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('artist_id', artistId)
      .maybeSingle();

    res.json({ is_favorited: !!favorite });
  } catch (error) {
    console.error('Error checking favorite status:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== DISCOVERY & MATCHING FEATURES ==========

// Get all art styles
router.get('/styles/list', optionalAuth, async (req, res) => {
  try {
    const { data: styles, error } = await supabaseAdmin
      .from('art_styles')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    res.json({ styles: styles || [] });
  } catch (error) {
    console.error('Error fetching art styles:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save style preference quiz results
router.post('/preferences/quiz', authenticate, async (req, res) => {
  try {
    const {
      preferred_styles, // Array of { style_id, weight } objects
      preferred_commission_types,
      price_range_min,
      price_range_max,
      preferred_turnaround_days,
      match_algorithm = 'weighted'
    } = req.body;

    // Verify user is a client (not an artist)
    const { data: artist } = await supabaseAdmin
      .from('artists')
      .select('id')
      .eq('id', req.user.id)
      .maybeSingle();

    if (artist) {
      return res.status(403).json({ error: 'Artists cannot set style preferences' });
    }

    // Upsert preferences
    const { data: preferences, error } = await supabaseAdmin
      .from('client_style_preferences')
      .upsert({
        user_id: req.user.id,
        preferred_styles: preferred_styles || [],
        preferred_commission_types: preferred_commission_types || [],
        price_range_min: price_range_min || null,
        price_range_max: price_range_max || null,
        preferred_turnaround_days: preferred_turnaround_days || null,
        match_algorithm,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) throw error;
    res.json(preferences);
  } catch (error) {
    console.error('Error saving style preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's style preferences
router.get('/preferences/quiz', authenticate, async (req, res) => {
  try {
    const { data: preferences, error } = await supabaseAdmin
      .from('client_style_preferences')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error) throw error;
    res.json(preferences || null);
  } catch (error) {
    console.error('Error fetching style preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get smart matched artists based on preferences
router.get('/matches/smart', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    // Get user's preferences
    const { data: preferences } = await supabaseAdmin
      .from('client_style_preferences')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!preferences) {
      // No preferences set, return top-rated artists
      const { data: artists } = await supabaseAdmin
        .from('artists')
        .select(`
          *,
          users(id, username, avatar_url, full_name, bio),
          primary_style:art_styles!artists_primary_style_id_fkey(id, name, slug)
        `)
        .in('commission_status', ['open', 'limited'])
        .neq('id', req.user.id)
        .order('rating', { ascending: false })
        .limit(limit);

      return res.json({ artists: artists || [], match_score: null });
    }

    // Build matching query
    let matchQuery = supabaseAdmin
      .from('artists')
      .select(`
        *,
        users(id, username, avatar_url, full_name, bio),
        primary_style:art_styles!artists_primary_style_id_fkey(id, name, slug),
        art_styles:artist_art_styles(style:art_styles(id, name, slug))
      `)
      .in('commission_status', ['open', 'limited'])
      .neq('id', req.user.id);

    // Apply style filters
    if (preferences.preferred_styles && preferences.preferred_styles.length > 0) {
      const styleIds = preferences.preferred_styles.map(p => p.style_id || p);
      const { data: styleArtists } = await supabaseAdmin
        .from('artist_art_styles')
        .select('artist_id')
        .in('style_id', styleIds);

      const styleArtistIds = [...new Set(styleArtists?.map(s => s.artist_id) || [])];
      if (styleArtistIds.length > 0) {
        matchQuery = matchQuery.in('id', styleArtistIds);
      } else {
        return res.json({ artists: [], match_score: null });
      }
    }

    // Apply price range filter
    if (preferences.price_range_min !== null) {
      matchQuery = matchQuery.gte('min_price', preferences.price_range_min);
    }
    if (preferences.price_range_max !== null) {
      matchQuery = matchQuery.lte('max_price', preferences.price_range_max);
    }

    // Apply turnaround filter
    if (preferences.preferred_turnaround_days !== null) {
      matchQuery = matchQuery.lte('avg_turnaround_days', preferences.preferred_turnaround_days);
    }

    // Apply commission type filter
    if (preferences.preferred_commission_types && preferences.preferred_commission_types.length > 0) {
      matchQuery = matchQuery.overlaps('commission_types', preferences.preferred_commission_types);
    }

    // Exclude swiped artists
    const { data: swipedArtists } = await supabaseAdmin
      .from('swipes')
      .select('artist_id')
      .eq('user_id', req.user.id);

    const swipedIds = swipedArtists?.map(s => s.artist_id) || [];
    if (swipedIds.length > 0) {
      matchQuery = matchQuery.not('id', 'in', `(${swipedIds.join(',')})`);
    }

    const { data: artists, error } = await matchQuery
      .order('rating', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Calculate match scores if weighted algorithm
    if (preferences.match_algorithm === 'weighted' && preferences.preferred_styles?.length > 0) {
      const artistsWithScores = (artists || []).map(artist => {
        let score = 0;
        const artistStyleIds = artist.art_styles?.map(a => a.style.id) || [];
        
        preferences.preferred_styles.forEach(pref => {
          const styleId = pref.style_id || pref;
          const weight = pref.weight || 1;
          if (artistStyleIds.includes(styleId) || artist.primary_style_id === styleId) {
            score += weight;
          }
        });

        return { ...artist, match_score: score };
      }).sort((a, b) => (b.match_score || 0) - (a.match_score || 0));

      return res.json({ artists: artistsWithScores, match_score: true });
    }

    res.json({ artists: artists || [], match_score: false });
  } catch (error) {
    console.error('Error fetching smart matches:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;