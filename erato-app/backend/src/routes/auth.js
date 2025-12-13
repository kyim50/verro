import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// Register
router.post(
  '/register',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('username').isLength({ min: 3, max: 30 }).trim(),
    body('password').isLength({ min: 8 }),
    body('fullName').optional().trim(),
    body('userType').isIn(['artist', 'client', 'both']),
    body('avatar_url').optional().trim(), // Will be added on profile picture page
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, username, password, fullName, userType, avatar_url } = req.body;

      console.log('Registration attempt:', { email, username, userType, hasPassword: !!password });

      // Check if user exists using admin client
      const { data: existingUsers, error: checkError } = await supabaseAdmin
        .from('users')
        .select('id, email, username')
        .or(`email.eq.${email},username.eq.${username}`);

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing users:', checkError);
        throw checkError;
      }

      if (existingUsers && existingUsers.length > 0) {
        const existingEmail = existingUsers.find(u => u.email === email);
        const existingUsername = existingUsers.find(u => u.username === username);
        
        if (existingEmail) {
          console.log('Registration failed: Email already exists', email);
          throw new AppError('Email already exists', 409);
        }
        if (existingUsername) {
          console.log('Registration failed: Username already exists', username);
          throw new AppError('Username already exists', 409);
        }
        console.log('Registration failed: Email or username already exists');
        throw new AppError('Email or username already exists', 409);
      }

      console.log('No existing user found, proceeding with registration...');

      // Create user in Supabase Auth
      console.log('Creating user in Supabase Auth...');
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email for development
      });

      if (authError) {
        console.error('Supabase Auth error:', authError);
        throw authError;
      }
      console.log('User created in Supabase Auth:', authData.user.id);

      // Create user in database using ADMIN client to bypass RLS
      console.log('Creating user in database...');
      const { data: user, error: dbError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authData.user.id,
          email,
          username,
          full_name: fullName,
          user_type: userType,
          avatar_url: avatar_url || '', // Optional - can be added on profile picture screen
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database error creating user:', dbError);
        // If user creation fails, delete the auth user
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        } catch (deleteError) {
          console.error('Error cleaning up auth user:', deleteError);
        }
        throw dbError;
      }
      console.log('User created in database:', user.id);

      // If user is an artist, create artist profile
      if (userType === 'artist' || userType === 'both') {
        await supabaseAdmin.from('artists').insert({
          id: user.id,
          commission_status: 'open',
        });
      }

      const token = generateToken(user.id);

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.full_name,
          userType: user.user_type,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Login
router.post(
  '/login',
  authLimiter,
  [
    body('email').notEmpty().withMessage('Email or username is required'),
    body('password').notEmpty(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email: emailOrUsername, password } = req.body;

      // Check if input is email or username
      let userEmail = emailOrUsername;
      const isEmail = emailOrUsername.includes('@');

      if (!isEmail) {
        // It's a username, fetch the user's email
        const { data: userData, error: userError } = await supabaseAdmin
          .from('users')
          .select('email')
          .eq('username', emailOrUsername)
          .single();

        if (userError || !userData) {
          throw new AppError('Invalid credentials', 401);
        }

        userEmail = userData.email;
      }

      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      });

      if (authError) {
        throw new AppError('Invalid credentials', 401);
      }

      // Get user from database using admin client
      const { data: user, error: dbError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (dbError || !user) {
        throw new AppError('User not found', 404);
      }

      const token = generateToken(user.id);

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.full_name,
          avatarUrl: user.avatar_url,
          userType: user.user_type,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get current user
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select(`
        *,
        artists(*)
      `)
      .eq('id', req.user.id)
      .single();

    if (error) throw error;

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// Update profile
router.put(
  '/profile',
  authenticate,
  [
    body('fullName').optional().trim(),
    body('bio').optional().trim(),
    body('avatarUrl').optional().isURL(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { fullName, bio, avatarUrl } = req.body;

      const updateData = {};
      if (fullName !== undefined) updateData.full_name = fullName;
      if (bio !== undefined) updateData.bio = bio;
      if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl;

      const { data: user, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', req.user.id)
        .select()
        .single();

      if (error) throw error;

      res.json({ message: 'Profile updated successfully', user });
    } catch (error) {
      next(error);
    }
  }
);

// Logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;