import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Constants from 'expo-constants';
import { BlurView } from 'expo-blur';
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
      <Ionicons name="chatbubbles" size={22} color={color} />
      {unreadCount > 0 && (
        <View style={styles.unreadDot} />
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
        tabBarBackground: () => (
          <View style={{ 
            flex: 1, 
            backgroundColor: 'rgba(26, 26, 26, 0.45)',
            borderTopWidth: 1,
            borderTopColor: 'rgba(58, 58, 58, 0.25)',
          }} />
        ),
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
          title: 'Commissions',
          tabBarIcon: ({ color }) => (
            <Ionicons name="briefcase" size={22} color={color} />
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
                <Ionicons 
                  name={isArtist ? "add" : "search"} 
                  size={30} 
                  color={colors.text.primary} 
                />
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
    backgroundColor: 'rgba(26, 26, 26, 0.45)',
    borderTopColor: 'rgba(58, 58, 58, 0.25)',
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 88 : 65,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    paddingTop: 5,
    elevation: 0,
    shadowOpacity: 0,
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
  unreadDot: {
    position: 'absolute',
    top: -3,
    right: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e60023',
    borderWidth: 2.5,
    borderColor: colors.surface,
    zIndex: 10,
  },
});