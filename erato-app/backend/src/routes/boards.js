import express from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get all boards for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const { type, parent_id } = req.query;
    
    let query = supabaseAdmin
      .from('boards')
      .select(`
        *,
        board_artworks(
          id,
          artwork_id,
          artworks(
            id,
            title,
            image_url,
            thumbnail_url
          )
        )
      `)
      .eq('user_id', req.user.id);

    if (type) {
      query = query.eq('board_type', type);
    }

    if (parent_id) {
      query = query.eq('parent_board_id', parent_id);
    } else {
      query = query.is('parent_board_id', null);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // Count artworks for each board
    const boardsWithCount = data.map(board => ({
      ...board,
      artworks: [{ count: board.board_artworks?.length || 0 }]
    }));

    res.json(boardsWithCount);
  } catch (error) {
    console.error('Error fetching boards:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single board with details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('boards')
      .select(`
        *,
        users(id, username, avatar_url),
        board_artworks(
          id,
          artworks(
            id,
            title,
            image_url,
            thumbnail_url,
            artists(
              id,
              users(id, username, avatar_url)
            )
          )
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    // Check if user has access
    const hasAccess = data.user_id === req.user.id || data.is_public;

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(data);
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
      parent_board_id = null,
      cover_image_url = null
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
        parent_board_id,
        cover_image_url
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
    const { name, description, is_public, board_type, cover_image_url } = req.body;

    // Verify ownership
    const { data: board, error: fetchError } = await supabaseAdmin
      .from('boards')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    if (board.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this board' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (is_public !== undefined) updates.is_public = is_public;
    if (board_type !== undefined) updates.board_type = board_type;
    if (cover_image_url !== undefined) updates.cover_image_url = cover_image_url;

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
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    if (board.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this board' });
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
      .single();

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