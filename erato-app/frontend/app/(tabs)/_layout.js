import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Constants from 'expo-constants';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store';
import { colors } from '../../constants/theme';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

function MessagesTabIcon({ color }) {
  const { token } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchUnreadCount = async () => {
      if (!token || !isMounted) return;
      try {
        const response = await axios.get(`${API_URL}/messages/conversations`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (isMounted) {
          const conversations = response.data.conversations || [];
          const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
          setUnreadCount(totalUnread);
        }
      } catch (error) {
        // Silently fail to avoid spamming console
        if (error.response?.status !== 429) {
          console.error('Error fetching unread count:', error.message);
        }
      }
    };

    // Fetch once on mount
    fetchUnreadCount();

    // Poll every 2 minutes instead of 30 seconds to avoid rate limiting
    const interval = setInterval(fetchUnreadCount, 120000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [token]);

  return (
    <View style={{ position: 'relative' }}>
      <Ionicons name="chatbubble" size={20} color={color} />
      {unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>{Math.min(unreadCount, 9)}{unreadCount > 9 ? '+' : ''}</Text>
        </View>
      )}
    </View>
  );
}

function CommissionsTabIcon({ color }) {
  const { token, user } = useAuthStore();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchPending = async () => {
      if (!token || !isMounted) return;
      try {
        const isArtist = user?.user_type === 'artist' || (user?.artists && (Array.isArray(user.artists) ? user.artists.length > 0 : !!user.artists));
        const params = isArtist
          ? { status: 'pending', type: 'received' }
          : { status: 'pending', type: 'sent' };
        const response = await axios.get(`${API_URL}/commissions`, {
          headers: { Authorization: `Bearer ${token}` },
          params,
        });
        if (!isMounted) return;
        const pending = response.data?.commissions?.length || 0;
        setPendingCount(pending);
      } catch (error) {
        if (error.response?.status !== 429) {
          console.error('Error fetching pending commissions:', error.message);
        }
      }
    };

    fetchPending();
    const interval = setInterval(fetchPending, 120000); // 2 minutes
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [token, user]);

  return (
    <View style={{ position: 'relative' }}>
      <Ionicons name="briefcase-outline" size={23} color={color} />
      {pendingCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>{Math.min(pendingCount, 9)}{pendingCount > 9 ? '+' : ''}</Text>
        </View>
      )}
    </View>
  );
}

function CanvasTabIcon({ color }) {
  // Canvas tab should not show any notifications - it's just for saved canvases
  return (
    <View style={{ position: 'relative' }}>
      <Ionicons name="albums" size={23} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const isArtist = user?.user_type === 'artist' || 
                   (user?.artists && (Array.isArray(user.artists) ? user.artists.length > 0 : !!user.artists));

  // Calculate tab bar height with safe area insets - more compact and higher up
  const tabBarHeight = Platform.OS === 'ios'
    ? 45 + insets.bottom // iOS more compact - reduced from 60
    : 40 + insets.bottom; // Android more compact - reduced from 50

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        animationDuration: 100, // Shorter transition
        tabBarStyle: [
          styles.tabBar,
          {
            height: tabBarHeight,
            paddingBottom: Platform.OS === 'ios'
              ? Math.max(20, insets.bottom)
              : Math.max(6, insets.bottom),
            paddingTop: 6,
            paddingHorizontal: 0,
          }
        ],
        tabBarActiveTintColor: colors.text.primary,
        tabBarInactiveTintColor: colors.text.disabled,
        tabBarShowLabel: false, // Hide labels for minimal look
        tabBarItemStyle: {
          paddingVertical: 0,
          paddingHorizontal: 0,
        },
        tabBarBackground: () => (
          <View style={{ 
            flex: 1, 
            backgroundColor: colors.background,
            borderTopWidth: 0, // No border for ultra-clean look
          }} />
        ),
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Ionicons name="grid-outline" size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Commissions',
          tabBarLabel: 'Orders',
          tabBarIcon: ({ color }) => <CommissionsTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: '',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={isArtist ? "add" : "search"}
              size={24}
              color={color}
            />
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => <MessagesTabIcon color={color} />,
          animation: 'fade',
          animationDuration: 100, // Short fade transition
        }}
      />
      <Tabs.Screen
        name="boards"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, size }) => <CanvasTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          animation: 'fade',
          animationDuration: 100, // Short fade transition
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.background,
    borderTopWidth: 0, // No border for ultra-minimal look
    height: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: Platform.OS === 'ios' ? 20 : 6,
    paddingTop: 6,
    paddingHorizontal: 0,
    shadowOpacity: 0, // No shadow
    elevation: 0,
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  unreadBadgeText: {
    color: colors.text.primary,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
});