import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import Constants from 'expo-constants';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

const { width, height } = Dimensions.get('window');
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function WelcomeScreen() {
  const [backgroundArtworks, setBackgroundArtworks] = useState([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    loadBackgroundArtworks();

    // Fade in animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loadBackgroundArtworks = async () => {
    try {
      const response = await axios.get(`${API_URL}/artworks?sort=engagement_score&order=desc&limit=20`);
      setBackgroundArtworks(response.data.artworks || []);
    } catch (error) {
      console.error('Error loading background artworks:', error);
    }
  };

  const renderMasonryColumn = (columnArtworks, columnIndex) => {
    const heights = columnIndex === 0
      ? [180, 220, 160, 200, 190, 210, 170, 195]
      : [200, 170, 210, 180, 220, 160, 190, 185];

    return (
      <View style={styles.masonryColumn}>
        {columnArtworks.map((artwork, index) => (
          <View
            key={artwork.id}
            style={[
              styles.backgroundTile,
              { height: heights[index % heights.length] }
            ]}
          >
            <Image
              source={{ uri: artwork.thumbnail_url || artwork.image_url }}
              style={styles.backgroundImage}
              contentFit="cover"
            />
          </View>
        ))}
      </View>
    );
  };

  const leftColumn = backgroundArtworks.filter((_, index) => index % 2 === 0);
  const rightColumn = backgroundArtworks.filter((_, index) => index % 2 === 1);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Masonry Background */}
      <View style={styles.backgroundContainer}>
        <View style={styles.masonryContainer}>
          {renderMasonryColumn(leftColumn, 0)}
          {renderMasonryColumn(rightColumn, 1)}
        </View>

        {/* Gradient Overlay */}
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
          style={styles.gradient}
        />
      </View>

      {/* Content */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}
      >
        <View style={styles.textContainer}>
          <Text style={styles.title}>Human art</Text>
          <Text style={styles.title}>for a human world</Text>
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.signupButton}
            onPress={() => router.push('/auth/signup-flow')}
            activeOpacity={0.9}
          >
            <Text style={styles.signupButtonText}>Sign up</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/auth/login')}
            activeOpacity={0.9}
          >
            <Text style={styles.loginButtonText}>Log in</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  masonryContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  masonryColumn: {
    flex: 1,
    gap: 4,
  },
  backgroundTile: {
    width: '100%',
    overflow: 'hidden',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxl * 2 : spacing.xxl,
  },
  textContainer: {
    marginBottom: spacing.xxl * 2,
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1.5,
    lineHeight: 52,
    textAlign: 'center',
  },
  buttonsContainer: {
    gap: spacing.md,
  },
  signupButton: {
    backgroundColor: '#E60023', // Pinterest red
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  signupButtonText: {
    ...typography.button,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  loginButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  loginButtonText: {
    ...typography.button,
    color: '#000000',
    fontSize: 17,
    fontWeight: '700',
  },
});
