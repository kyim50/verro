import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Constants from 'expo-constants';

/**
 * Custom hook for tracking user engagement with artworks
 * Automatically tracks views and provides methods for other engagement types
 */
export const useEngagementTracking = (artworkId, options = {}) => {
  const { token, user } = useAuth();
  const {
    trackView = true, // Automatically track views
    trackDuration = true, // Track time spent viewing
    source = 'unknown', // Where the engagement happened (e.g., 'home_feed', 'search', 'artist_profile')
  } = options;

  const viewStartTime = useRef(null);
  const hasTrackedView = useRef(false);
  const durationInterval = useRef(null);

  const apiUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL ||
                 process.env.EXPO_PUBLIC_API_URL ||
                 'https://api.verrocio.com/api';

  /**
   * Track engagement event
   */
  const trackEngagement = useCallback(async (type, extraMetadata = {}) => {
    if (!token || !user || !artworkId) return;

    try {
      const duration = viewStartTime.current
        ? Math.floor((Date.now() - viewStartTime.current) / 1000)
        : null;

      await fetch(`${apiUrl}/engagement/track`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artwork_id: artworkId,
          engagement_type: type,
          duration_seconds: duration,
          metadata: {
            source,
            ...extraMetadata,
          },
        }),
      });
    } catch (error) {
      console.error('Error tracking engagement:', error);
      // Fail silently - don't disrupt user experience
    }
  }, [token, user, artworkId, source, apiUrl]);

  /**
   * Track view event
   */
  const trackViewEvent = useCallback(() => {
    if (!hasTrackedView.current && trackView) {
      trackEngagement('view');
      hasTrackedView.current = true;
      viewStartTime.current = Date.now();
    }
  }, [trackView, trackEngagement]);

  /**
   * Track click event (when user taps on artwork)
   */
  const trackClick = useCallback((metadata = {}) => {
    trackEngagement('click', metadata);
  }, [trackEngagement]);

  /**
   * Track like event
   */
  const trackLike = useCallback((metadata = {}) => {
    trackEngagement('like', metadata);
  }, [trackEngagement]);

  /**
   * Track save event (save to board)
   */
  const trackSave = useCallback((metadata = {}) => {
    trackEngagement('save', metadata);
  }, [trackEngagement]);

  /**
   * Track share event
   */
  const trackShare = useCallback((metadata = {}) => {
    trackEngagement('share', metadata);
  }, [trackEngagement]);

  /**
   * Track commission inquiry event
   */
  const trackCommissionInquiry = useCallback((metadata = {}) => {
    trackEngagement('commission_inquiry', metadata);
  }, [trackEngagement]);

  // Auto-track view on mount
  useEffect(() => {
    if (artworkId && user && token) {
      trackViewEvent();
    }

    return () => {
      // Clear interval on unmount
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, [artworkId, user, token, trackViewEvent]);

  return {
    trackClick,
    trackLike,
    trackSave,
    trackShare,
    trackCommissionInquiry,
    trackEngagement, // For custom engagement types
  };
};

/**
 * Hook for batch tracking multiple engagements
 */
export const useBatchEngagementTracking = () => {
  const { token, user } = useAuth();
  const pendingEngagements = useRef([]);
  const batchTimeout = useRef(null);

  const apiUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL ||
                 process.env.EXPO_PUBLIC_API_URL ||
                 'https://api.verrocio.com/api';

  /**
   * Send batch of engagements to server
   */
  const flushBatch = useCallback(async () => {
    if (pendingEngagements.current.length === 0) return;

    const engagementsToSend = [...pendingEngagements.current];
    pendingEngagements.current = [];

    try {
      await fetch(`${apiUrl}/engagement/batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          engagements: engagementsToSend,
        }),
      });
    } catch (error) {
      console.error('Error tracking batch engagement:', error);
    }
  }, [token, apiUrl]);

  /**
   * Add engagement to batch
   */
  const addToBatch = useCallback((artworkId, type, metadata = {}) => {
    if (!token || !user) return;

    pendingEngagements.current.push({
      artwork_id: artworkId,
      engagement_type: type,
      metadata,
    });

    // Clear existing timeout
    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
    }

    // Send batch after 2 seconds of inactivity or when 10 items accumulated
    if (pendingEngagements.current.length >= 10) {
      flushBatch();
    } else {
      batchTimeout.current = setTimeout(flushBatch, 2000);
    }
  }, [token, user, flushBatch]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (batchTimeout.current) {
        clearTimeout(batchTimeout.current);
      }
      flushBatch();
    };
  }, [flushBatch]);

  return {
    addToBatch,
    flushBatch,
  };
};

export default useEngagementTracking;
