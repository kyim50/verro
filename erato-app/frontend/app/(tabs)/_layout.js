import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Constants from 'expo-constants';
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
    <View>
      <Ionicons name="chatbubbles" size={22} color={color} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  const { user } = useAuthStore();
  const isArtist = user?.user_type === 'artist' || 
                   (user?.artists && (Array.isArray(user.artists) ? user.artists.length > 0 : !!user.artists));

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.secondary,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: isArtist ? 'Commissions' : 'Explore',
          tabBarIcon: ({ color }) => (
            <Ionicons name={isArtist ? 'briefcase' : 'search'} size={22} color={color} />
          ),
        }}
        listeners={{
          focus: () => {},
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: '',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.createWrapper, focused && styles.createWrapperFocused]}>
              <View style={[styles.createButton, focused && styles.createButtonFocused]}>
                <Ionicons name="add" size={30} color={colors.text.primary} />
              </View>
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => <MessagesTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="boards"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="library" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 88 : 65,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    paddingTop: 5,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  createButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  createWrapper: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: `${colors.surface}F2`,
    borderWidth: 1,
    borderColor: `${colors.border}B3`,
    marginBottom: Platform.OS === 'ios' ? 12 : 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 5,
  },
  createWrapperFocused: {
    borderColor: `${colors.primary}CC`,
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    elevation: 8,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});