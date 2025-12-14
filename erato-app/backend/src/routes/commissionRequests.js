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
    query('budget_min').optional().isFloat({ min: 0 }),
    query('budget_max').optional().isFloat({ min: 0 }),
    query('sort_by').optional().isIn(['recent', 'budget_high', 'budget_low', 'bids_low', 'deadline_soon']),
    query('styles').optional().isString(), // Comma-separated style IDs
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
      const budgetMin = req.query.budget_min ? parseFloat(req.query.budget_min) : null;
      const budgetMax = req.query.budget_max ? parseFloat(req.query.budget_max) : null;
      const sortBy = req.query.sort_by || 'recent';
      const styles = req.query.styles ? req.query.styles.split(',').filter(s => s.trim()) : null;

      let requestQuery = supabaseAdmin
        .from('commission_requests')
        .select(`
          *,
          client:users!commission_requests_client_id_fkey(id, username, avatar_url, full_name),
          awarded_artist:users!commission_requests_awarded_to_fkey(id, username, avatar_url)
        `, { count: 'exact' })
        .eq('status', status);

      // Budget filters
      if (budgetMin !== null) {
        requestQuery = requestQuery.or(`budget_max.gte.${budgetMin},budget_max.is.null`);
      }
      if (budgetMax !== null) {
        requestQuery = requestQuery.or(`budget_min.lte.${budgetMax},budget_min.is.null`);
      }

      // Style filters - check if preferred_styles array contains any of the requested styles
      if (styles && styles.length > 0) {
        requestQuery = requestQuery.overlaps('preferred_styles', styles);
      }

      // Sorting
      switch (sortBy) {
        case 'budget_high':
          requestQuery = requestQuery.order('budget_max', { ascending: false, nullsFirst: false });
          break;
        case 'budget_low':
          requestQuery = requestQuery.order('budget_min', { ascending: true, nullsFirst: false });
          break;
        case 'bids_low':
          requestQuery = requestQuery.order('bid_count', { ascending: true });
          break;
        case 'deadline_soon':
          requestQuery = requestQuery.order('deadline', { ascending: true, nullsFirst: false });
          break;
        case 'recent':
        default:
          requestQuery = requestQuery.order('created_at', { ascending: false });
          break;
      }

      // Apply pagination
      requestQuery = requestQuery.range(offset, offset + limit - 1);

      const { data: requests, error, count } = await requestQuery;

      if (error) throw error;

      // If user is authenticated and is an artist, mark which requests they've already bid on
      let enrichedRequests = requests || [];
      if (req.user) {
        const { data: artistCheck } = await supabaseAdmin
          .from('artists')
          .select('id')
          .eq('id', req.user.id)
          .maybeSingle();

        if (artistCheck) {
          const requestIds = enrichedRequests.map(r => r.id);
          const { data: userBids } = await supabaseAdmin
            .from('commission_request_bids')
            .select('request_id, status')
            .eq('artist_id', req.user.id)
            .in('request_id', requestIds);

          const bidMap = new Map(userBids?.map(b => [b.request_id, b.status]) || []);
          enrichedRequests = enrichedRequests.map(req => ({
            ...req,
            user_bid_status: bidMap.get(req.id) || null,
            has_applied: bidMap.has(req.id)
          }));
        }
      }

      res.json({
        requests: enrichedRequests,
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit)
        },
        filters: {
          status,
          budget_min: budgetMin,
          budget_max: budgetMax,
          sort_by: sortBy,
          styles: styles
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get artist's own bids (MUST be before /:id route)
router.get('/bids/my', authenticate, async (req, res, next) => {
  try {
    const { data: bids, error } = await supabaseAdmin
      .from('commission_request_bids')
      .select(`
        *,
        request:commission_requests!commission_request_bids_request_id_fkey(
          id,
          title,
          description,
          status,
          budget_min,
          budget_max,
          deadline,
          client:users!commission_requests_client_id_fkey(id, username, avatar_url, full_name)
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

// Get client's own commission requests with bids (MUST be before /:id route)
router.get('/my-requests', authenticate, async (req, res, next) => {
  try {
    const { data: requests, error } = await supabaseAdmin
      .from('commission_requests')
      .select(`
        *,
        client:users!commission_requests_client_id_fkey(id, username, avatar_url, full_name),
        awarded_artist:users!commission_requests_awarded_to_fkey(id, username, avatar_url, full_name),
        bids:commission_request_bids(
          *,
          artist:users!commission_request_bids_artist_id_fkey(id, username, avatar_url, full_name)
        )
      `)
      .eq('client_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Enrich with bid statistics
    const enrichedRequests = (requests || []).map(request => ({
      ...request,
      pending_bids_count: request.bids?.filter(b => b.status === 'pending').length || 0,
      total_bids_count: request.bids?.length || 0
    }));

    res.json({ requests: enrichedRequests });
  } catch (error) {
    next(error);
  }
});

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
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('request_id', req.params.id)
        .neq('id', req.params.bidId)
        .eq('status', 'pending');

      // Update request status
      await supabaseAdmin
        .from('commission_requests')
        .update({
          status: 'awarded',
          awarded_to: bid.artist_id,
          awarded_at: new Date().toISOString()
        })
        .eq('id', req.params.id);

      // Create a commission from the accepted bid
      const { data: commission, error: commissionError } = await supabaseAdmin
        .from('commissions')
        .insert({
          client_id: request.client_id,
          artist_id: bid.artist_id,
          details: `Commission request: ${request.title}`,
          budget: bid.bid_amount,
          deadline_text: bid.estimated_delivery_days ? `${bid.estimated_delivery_days} days` : null,
          status: 'pending',
          final_price: bid.bid_amount
        })
        .select()
        .single();

      if (commissionError) throw commissionError;

      // Create or get conversation
      const { data: existingConv } = await supabaseAdmin
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', request.client_id);

      let conversation = null;
      if (existingConv && existingConv.length > 0) {
        for (const conv of existingConv) {
          const { data: participants } = await supabaseAdmin
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conv.conversation_id);

          if (participants?.some(p => p.user_id === bid.artist_id)) {
            const { data: foundConv } = await supabaseAdmin
              .from('conversations')
              .select('*')
              .eq('id', conv.conversation_id)
              .single();
            conversation = foundConv;
            break;
          }
        }
      }

      if (!conversation) {
        const { data: newConv } = await supabaseAdmin
          .from('conversations')
          .insert({ commission_id: commission.id })
          .select()
          .single();
        conversation = newConv;

        await supabaseAdmin.from('conversation_participants').insert([
          { conversation_id: conversation.id, user_id: request.client_id },
          { conversation_id: conversation.id, user_id: bid.artist_id }
        ]);
      }

      // Notify artist
      await NotificationService.publish(bid.artist_id, {
        type: 'bid_accepted',
        title: 'Bid Accepted! 🎉',
        message: 'Your bid has been accepted and a commission has been created',
        action: { type: 'view_commission', id: commission.id },
        priority: 'high',
      });

      res.json({
        message: 'Bid accepted successfully',
        commission_id: commission.id,
        conversation_id: conversation.id
      });
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

// Cancel a commission request (clients only)
router.patch('/:id/cancel', authenticate, async (req, res, next) => {
  try {
    const { data: request } = await supabaseAdmin
      .from('commission_requests')
      .select('client_id, status')
      .eq('id', req.params.id)
      .single();

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the request creator can cancel it' });
    }

    if (request.status !== 'open') {
      return res.status(400).json({ error: 'Only open requests can be cancelled' });
    }

    // Update request status
    await supabaseAdmin
      .from('commission_requests')
      .update({
        status: 'cancelled',
        closed_at: new Date().toISOString()
      })
      .eq('id', req.params.id);

    // Get all pending bids and notify artists
    const { data: pendingBids } = await supabaseAdmin
      .from('commission_request_bids')
      .select('artist_id')
      .eq('request_id', req.params.id)
      .eq('status', 'pending');

    // Reject all pending bids
    await supabaseAdmin
      .from('commission_request_bids')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('request_id', req.params.id)
      .eq('status', 'pending');

    // Notify artists
    if (pendingBids && pendingBids.length > 0) {
      for (const bid of pendingBids) {
        await NotificationService.publish(bid.artist_id, {
          type: 'request_cancelled',
          title: 'Request Cancelled',
          message: 'A commission request you bid on has been cancelled',
          action: { type: 'view_requests' },
          priority: 'normal',
        });
      }
    }

    res.json({ message: 'Request cancelled successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;




