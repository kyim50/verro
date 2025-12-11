import { cache } from './cache.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send a push notification to a user if they have a stored Expo token.
 * Falls back silently if no token exists or the token is invalid.
 */
export async function sendPushToUser(userId, { title, body, data = {}, sound = 'default', priority = 'high' } = {}) {
  try {
    const tokenData = await cache.get(`push_tokens:${userId}`);
    const pushToken = tokenData?.token;

    if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
      return false;
    }

    const payload = {
      to: pushToken,
      title: title || 'Notice',
      body: body || '',
      sound,
      priority,
      data,
    };

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Expo push send failed:', text);
      return false;
    }

    const result = await response.json();
    if (result?.data?.status === 'error') {
      console.error('Expo push error:', result?.data);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
}

