import express from 'express';
import { query, body, validationResult } from 'express-validator';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { NotificationService } from '../utils/redisServices.js';
import { sendPushToUser } from '../utils/pushNotifications.js';

const router = express.Router();

// Get all commission requests (with filters)
router.get(
  '/',
  optionalAuth,
  [
    query('status').optional().isIn(['open', 'closed', 'awarded', 'cancelled']),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('page').optional().isInt({ min: 1 }).toInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const status = req.query.status || 'open';
      const limit = parseInt(req.query.limit) || 20;
      const page = parseInt(req.query.page) || 1;
      const offset = (page - 1) * limit;

      let requestQuery = supabaseAdmin
        .from('commission_requests')
        .select(`
          *,
          client:users!commission_requests_client_id_fkey(id, username, avatar_url, full_name),
          awarded_artist:artists!commission_requests_awarded_to_fkey(id, users:users!artists_id_fkey(id, username, avatar_url))
        `, { count: 'exact' })
        .eq('status', status)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: requests, error, count } = await requestQuery;

      if (error) throw error;

      res.json({
        requests: requests || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get single commission request with bids
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { data: request, error } = await supabaseAdmin
      .from('commission_requests')
      .select(`
        *,
        client:users!commission_requests_client_id_fkey(id, username, avatar_url, full_name),
        awarded_artist:artists!commission_requests_awarded_to_fkey(id, users:users!artists_id_fkey(id, username, avatar_url)),
        bids:commission_request_bids(
          *,
          artist:artists!commission_request_bids_artist_id_fkey(
            id,
            users:users!artists_id_fkey(id, username, avatar_url, full_name)
          )
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Increment view count
    await supabaseAdmin
      .from('commission_requests')
      .update({ view_count: (request.view_count || 0) + 1 })
      .eq('id', req.params.id);

    res.json(request);
  } catch (error) {
    next(error);
  }
});

// Create a commission request (clients only)
router.post(
  '/',
  authenticate,
  [
    body('title').isString().isLength({ min: 5, max: 200 }),
    body('description').isString().isLength({ min: 20 }),
    body('budget_min').optional().isFloat({ min: 0 }),
    body('budget_max').optional().isFloat({ min: 0 }),
    body('deadline').optional().isISO8601(),
    body('preferred_styles').optional().isArray(),
    body('reference_images').optional().isArray(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify user is a client (not an artist)
      const { data: artist } = await supabaseAdmin
        .from('artists')
        .select('id')
        .eq('id', req.user.id)
        .maybeSingle();

      if (artist) {
        return res.status(403).json({ error: 'Artists cannot create commission requests' });
      }

      const {
        title,
        description,
        budget_min,
        budget_max,
        deadline,
        preferred_styles = [],
        reference_images = []
      } = req.body;

      const { data: request, error } = await supabaseAdmin
        .from('commission_requests')
        .insert({
          client_id: req.user.id,
          title,
          description,
          budget_min: budget_min || null,
          budget_max: budget_max || null,
          deadline: deadline || null,
          preferred_styles: preferred_styles,
          reference_images: reference_images,
          status: 'open'
        })
        .select(`
          *,
          client:users!commission_requests_client_id_fkey(id, username, avatar_url, full_name)
        `)
        .single();

      if (error) throw error;

      // Notify artists who match the preferred styles
      if (preferred_styles.length > 0) {
        const { data: matchingArtists } = await supabaseAdmin
          .from('artist_art_styles')
          .select('artist_id')
          .in('style_id', preferred_styles);

        const artistIds = [...new Set(matchingArtists?.map(a => a.artist_id) || [])];
        
        for (const artistId of artistIds) {
          await NotificationService.publish(artistId, {
            type: 'new_commission_request',
            title: 'New Commission Request',
            message: `${req.user.username || 'A client'} posted a request matching your style`,
            action: { type: 'view_request', id: request.id },
            priority: 'normal',
          });
        }
      }

      res.status(201).json(request);
    } catch (error) {
      next(error);
    }
  }
);

// Submit a bid on a commission request (artists only)
router.post(
  '/:id/bids',
  authenticate,
  [
    body('bid_amount').isFloat({ min: 0 }),
    body('estimated_delivery_days').optional().isInt({ min: 1 }),
    body('message').optional().isString().isLength({ max: 1000 }),
    body('portfolio_samples').optional().isArray(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify user is an artist
      const { data: artist } = await supabaseAdmin
        .from('artists')
        .select('id')
        .eq('id', req.user.id)
        .maybeSingle();

      if (!artist) {
        return res.status(403).json({ error: 'Only artists can submit bids' });
      }

      // Get the request
      const { data: request } = await supabaseAdmin
        .from('commission_requests')
        .select('client_id, status')
        .eq('id', req.params.id)
        .single();

      if (!request) {
        return res.status(404).json({ error: 'Request not found' });
      }

      if (request.status !== 'open') {
        return res.status(400).json({ error: 'This request is no longer accepting bids' });
      }

      // Check if artist already bid
      const { data: existingBid } = await supabaseAdmin
        .from('commission_request_bids')
        .select('id')
        .eq('request_id', req.params.id)
        .eq('artist_id', req.user.id)
        .maybeSingle();

      if (existingBid) {
        return res.status(400).json({ error: 'You have already submitted a bid on this request' });
      }

      const {
        bid_amount,
        estimated_delivery_days,
        message,
        portfolio_samples = []
      } = req.body;

      const { data: bid, error } = await supabaseAdmin
        .from('commission_request_bids')
        .insert({
          request_id: req.params.id,
          artist_id: req.user.id,
          bid_amount,
          estimated_delivery_days: estimated_delivery_days || null,
          message: message || null,
          portfolio_samples: portfolio_samples,
          status: 'pending'
        })
        .select(`
          *,
          artist:artists!commission_request_bids_artist_id_fkey(
            id,
            users:users!artists_id_fkey(id, username, avatar_url, full_name)
          )
        `)
        .single();

      if (error) throw error;

      // Notify client
      await NotificationService.publish(request.client_id, {
        type: 'new_bid',
        title: 'New Bid Received',
        message: 'An artist submitted a bid on your commission request',
        action: { type: 'view_request', id: req.params.id },
        priority: 'normal',
      });

      res.status(201).json(bid);
    } catch (error) {
      next(error);
    }
  }
);

// Accept a bid (clients only)
router.patch(
  '/:id/bids/:bidId/accept',
  authenticate,
  async (req, res, next) => {
    try {
      // Get the request
      const { data: request } = await supabaseAdmin
        .from('commission_requests')
        .select('client_id, status')
        .eq('id', req.params.id)
        .single();

      if (!request) {
        return res.status(404).json({ error: 'Request not found' });
      }

      if (request.client_id !== req.user.id) {
        return res.status(403).json({ error: 'Only the request creator can accept bids' });
      }

      // Get the bid
      const { data: bid } = await supabaseAdmin
        .from('commission_request_bids')
        .select('artist_id, status')
        .eq('id', req.params.bidId)
        .eq('request_id', req.params.id)
        .single();

      if (!bid) {
        return res.status(404).json({ error: 'Bid not found' });
      }

      if (bid.status !== 'pending') {
        return res.status(400).json({ error: 'This bid has already been processed' });
      }

      // Update bid status
      await supabaseAdmin
        .from('commission_request_bids')
        .update({ status: 'accepted' })
        .eq('id', req.params.bidId);

      // Reject all other bids
      await supabaseAdmin
        .from('commission_request_bids')
        .update({ status: 'rejected' })
        .eq('request_id', req.params.id)
        .neq('id', req.params.bidId)
        .eq('status', 'pending');

      // Update request status
      await supabaseAdmin
        .from('commission_requests')
        .update({
          status: 'awarded',
          awarded_to: bid.artist_id
        })
        .eq('id', req.params.id);

      // Notify artist
      await NotificationService.publish(bid.artist_id, {
        type: 'bid_accepted',
        title: 'Bid Accepted! 🎉',
        message: 'Your bid has been accepted',
        action: { type: 'view_request', id: req.params.id },
        priority: 'high',
      });

      res.json({ message: 'Bid accepted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// Withdraw a bid (artists only)
router.patch(
  '/:id/bids/:bidId/withdraw',
  authenticate,
  async (req, res, next) => {
    try {
      // Get the bid
      const { data: bid } = await supabaseAdmin
        .from('commission_request_bids')
        .select('artist_id, status')
        .eq('id', req.params.bidId)
        .eq('request_id', req.params.id)
        .single();

      if (!bid) {
        return res.status(404).json({ error: 'Bid not found' });
      }

      if (bid.artist_id !== req.user.id) {
        return res.status(403).json({ error: 'You can only withdraw your own bids' });
      }

      if (bid.status !== 'pending') {
        return res.status(400).json({ error: 'This bid cannot be withdrawn' });
      }

      await supabaseAdmin
        .from('commission_request_bids')
        .update({ status: 'withdrawn' })
        .eq('id', req.params.bidId);

      res.json({ message: 'Bid withdrawn successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// Get artist's bids
router.get('/bids/my', authenticate, async (req, res, next) => {
  try {
    // Verify user is an artist
    const { data: artist } = await supabaseAdmin
      .from('artists')
      .select('id')
      .eq('id', req.user.id)
      .maybeSingle();

    if (!artist) {
      return res.status(403).json({ error: 'Only artists can view bids' });
    }

    const { data: bids, error } = await supabaseAdmin
      .from('commission_request_bids')
      .select(`
        *,
        request:commission_requests!commission_request_bids_request_id_fkey(
          id,
          title,
          description,
          status,
          client:users!commission_requests_client_id_fkey(id, username, avatar_url)
        )
      `)
      .eq('artist_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ bids: bids || [] });
  } catch (error) {
    next(error);
  }
});

export default router;
