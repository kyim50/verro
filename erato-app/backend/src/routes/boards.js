import express from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get all boards for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const { type, parent_id } = req.query;
    
    // Simple query - just get boards
    let query = supabaseAdmin
      .from('boards')
      .select('*')
      .eq('user_id', req.user.id);

    if (type) {
      query = query.eq('board_type', type);
    }

    if (parent_id) {
      query = query.eq('parent_board_id', parent_id);
    } else {
      query = query.is('parent_board_id', null);
    }

    const { data: boards, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // Batch fetch all board artworks data
    const boardIds = boards.map(b => b.id);
    
    // Get all board artworks in one query
    const { data: allBoardArtworks } = await supabaseAdmin
      .from('board_artworks')
      .select('id, board_id, artwork_id, created_at')
      .in('board_id', boardIds)
      .order('created_at', { ascending: false });

    // Group by board_id and get counts
    const boardArtworksMap = new Map();
    const boardCountsMap = new Map();
    
    allBoardArtworks?.forEach(ba => {
      if (!boardArtworksMap.has(ba.board_id)) {
        boardArtworksMap.set(ba.board_id, []);
        boardCountsMap.set(ba.board_id, 0);
      }
      const boardArtworks = boardArtworksMap.get(ba.board_id);
      if (boardArtworks.length < 4) {
        boardArtworks.push(ba);
      }
      boardCountsMap.set(ba.board_id, boardCountsMap.get(ba.board_id) + 1);
    });

    // Get all unique artwork IDs
    const artworkIds = [...new Set(allBoardArtworks?.map(ba => ba.artwork_id) || [])];
    
    // Batch fetch all artwork details
    const { data: allArtworks } = artworkIds.length > 0
      ? await supabaseAdmin
          .from('artworks')
          .select('id, title, image_url, thumbnail_url')
          .in('id', artworkIds)
      : { data: [] };

    const artworksMap = new Map(allArtworks?.map(a => [a.id, a]) || []);

    // Combine all data
    const boardsWithData = boards.map(board => {
      const boardArtworks = boardArtworksMap.get(board.id) || [];
      const artworksWithDetails = boardArtworks.map(ba => ({
        ...ba,
        artworks: artworksMap.get(ba.artwork_id) || null
      }));

      return {
        ...board,
        artworks: [{ count: boardCountsMap.get(board.id) || 0 }],
        board_artworks: artworksWithDetails
      };
    });

    res.json(boardsWithData);
  } catch (error) {
    console.error('Error fetching boards:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single board with details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { data: board, error: boardError } = await supabaseAdmin
      .from('boards')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (boardError) throw boardError;

    // Check if user has access
    const hasAccess = board.user_id === req.user.id || board.is_public;

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Parallel fetch user info, board artworks, and artwork details
    const [userResult, boardArtworksResult] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('id, username, avatar_url')
        .eq('id', board.user_id)
        .single(),
      supabaseAdmin
        .from('board_artworks')
        .select('id, artwork_id, created_at')
        .eq('board_id', board.id)
        .order('created_at', { ascending: false })
    ]);

    const { data: user } = userResult;
    const { data: boardArtworks } = boardArtworksResult;

    // Get artwork details
    let artworksWithDetails = [];
    if (boardArtworks && boardArtworks.length > 0) {
      const artworkIds = boardArtworks.map(ba => ba.artwork_id);
      
      // Batch fetch artworks
      const { data: artworks } = await supabaseAdmin
        .from('artworks')
        .select('id, title, image_url, thumbnail_url, artist_id, aspect_ratio')
        .in('id', artworkIds);

      // Get unique artist IDs (artist_id in artworks is the user_id)
      const userIds = [...new Set(artworks?.map(a => a.artist_id).filter(Boolean) || [])];

      // Batch fetch artists and users in parallel
      const [artistsResult, artistUsersResult] = await Promise.all([
        userIds.length > 0
          ? supabaseAdmin
              .from('artists')
              .select('id, user_id')
              .in('id', userIds)
          : { data: [] },
        userIds.length > 0
          ? supabaseAdmin
              .from('users')
              .select('id, username, avatar_url')
              .in('id', userIds)
          : { data: [] }
      ]);

      const { data: artists } = artistsResult;
      const { data: artistUsers } = artistUsersResult;

      const artworksMap = new Map(artworks?.map(a => [a.id, a]) || []);
      const artistsMap = new Map(artists?.map(a => [a.id, a]) || []);
      const artistUsersMap = new Map(artistUsers?.map(u => [u.id, u]) || []);

      artworksWithDetails = boardArtworks.map(ba => {
        const artwork = artworksMap.get(ba.artwork_id);
        if (!artwork) return { ...ba, artworks: null };
        
        // artist_id in artworks is the user_id, so find artist by id (which equals user_id)
        const artist = artistsMap.get(artwork.artist_id);
        const artistUser = artistUsersMap.get(artwork.artist_id);

        return {
          ...ba,
          artworks: {
            ...artwork,
            artists: artist ? {
              ...artist,
              users: artistUser
            } : null
          }
        };
      });
    }

    res.json({
      ...board,
      users: user,
      board_artworks: artworksWithDetails
    });
  } catch (error) {
    console.error('Error fetching board:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new board
router.post('/', authenticate, async (req, res) => {
  try {
    const { 
      name, 
      description, 
      is_public = false, 
      board_type = 'general',
      parent_board_id = null
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Board name is required' });
    }

    // If creating a sub-board, verify parent exists and user owns it
    if (parent_board_id) {
      const { data: parentBoard, error: parentError } = await supabaseAdmin
        .from('boards')
        .select('user_id')
        .eq('id', parent_board_id)
        .single();

      if (parentError || !parentBoard) {
        return res.status(404).json({ error: 'Parent board not found' });
      }

      if (parentBoard.user_id !== req.user.id) {
        return res.status(403).json({ error: 'You can only create sub-boards in your own boards' });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('boards')
      .insert({
        user_id: req.user.id,
        name,
        description,
        is_public,
        board_type,
        parent_board_id
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating board:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update board
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, description, is_public, board_type } = req.body;

    // Verify ownership
    const { data: board, error: fetchError } = await supabaseAdmin
      .from('boards')
      .select('user_id, board_type')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    if (board.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this board' });
    }

    // Prevent updating "Created" board type and name
    if (board.board_type === 'created') {
      // Only allow updating description and visibility for Created board
      if (name !== undefined || board_type !== undefined) {
        return res.status(403).json({
          error: 'Cannot rename or change type of auto-generated "Created" board'
        });
      }
    }

    const updates = {};
    if (name !== undefined && board.board_type !== 'created') updates.name = name;
    if (description !== undefined) updates.description = description;
    if (is_public !== undefined) updates.is_public = is_public;
    if (board_type !== undefined && board.board_type !== 'created') updates.board_type = board_type;

    const { data, error } = await supabaseAdmin
      .from('boards')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error updating board:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete board
router.delete('/:id', authenticate, async (req, res) => {
  try {
    // Verify ownership
    const { data: board, error: fetchError } = await supabaseAdmin
      .from('boards')
      .select('user_id, board_type')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    if (board.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this board' });
    }

    // Prevent deletion of "Created" board
    if (board.board_type === 'created') {
      return res.status(403).json({
        error: 'Cannot delete auto-generated "Created" board'
      });
    }

    const { error } = await supabaseAdmin
      .from('boards')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ message: 'Board deleted successfully' });
  } catch (error) {
    console.error('Error deleting board:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save artwork to board
router.post('/:id/artworks', authenticate, async (req, res) => {
  try {
    const { artwork_id } = req.body;

    if (!artwork_id) {
      return res.status(400).json({ error: 'artwork_id is required' });
    }

    // Verify board ownership
    const { data: board, error: fetchError } = await supabaseAdmin
      .from('boards')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    if (board.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to add artworks to this board' });
    }

    // Check if artwork already exists in board
    const { data: existing } = await supabaseAdmin
      .from('board_artworks')
      .select('id')
      .eq('board_id', req.params.id)
      .eq('artwork_id', artwork_id)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'Artwork already in this board' });
    }

    // Add artwork to board
    const { data, error } = await supabaseAdmin
      .from('board_artworks')
      .insert({
        board_id: req.params.id,
        artwork_id: artwork_id
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error('Error adding artwork to board:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove artwork from board
router.delete('/:id/artworks/:artwork_id', authenticate, async (req, res) => {
  try {
    // Verify board ownership
    const { data: board, error: fetchError } = await supabaseAdmin
      .from('boards')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    if (board.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to remove artworks from this board' });
    }

    const { error } = await supabaseAdmin
      .from('board_artworks')
      .delete()
      .eq('board_id', req.params.id)
      .eq('artwork_id', req.params.artwork_id);

    if (error) throw error;

    res.json({ message: 'Artwork removed from board' });
  } catch (error) {
    console.error('Error removing artwork from board:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add collaborator to board
router.post('/:id/collaborators', authenticate, async (req, res) => {
  try {
    const { user_id, role = 'viewer' } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // Verify board ownership
    const { data: board, error: fetchError } = await supabaseAdmin
      .from('boards')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    if (board.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only board owner can add collaborators' });
    }

    const { data, error } = await supabaseAdmin
      .from('board_collaborators')
      .insert({
        board_id: req.params.id,
        user_id,
        role
      })
      .select(`
        *,
        users(id, username, avatar_url)
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'User is already a collaborator' });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Error adding collaborator:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove collaborator from board
router.delete('/:id/collaborators/:collaborator_id', authenticate, async (req, res) => {
  try {
    // Verify board ownership
    const { data: board, error: fetchError } = await supabaseAdmin
      .from('boards')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    if (board.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only board owner can remove collaborators' });
    }

    const { error } = await supabaseAdmin
      .from('board_collaborators')
      .delete()
      .eq('id', req.params.collaborator_id);

    if (error) throw error;

    res.json({ message: 'Collaborator removed successfully' });
  } catch (error) {
    console.error('Error removing collaborator:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;