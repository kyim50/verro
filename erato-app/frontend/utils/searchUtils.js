// Tag expansion and search intelligence utils
// This simulates Pinterest's AI-powered search without actual AI

export const TAG_SYNONYMS = {
  // Character & Cartoon related
  'mickey mouse': ['disney', 'cartoon', 'character', 'animation', 'mouse'],
  'disney': ['cartoon', 'character', 'animation', 'princess', 'mickey'],
  'anime': ['manga', 'character', 'japan', 'animation', 'kawaii'],
  'cartoon': ['animation', 'character', 'comic', 'illustration'],

  // Art styles
  'portrait': ['headshot', 'face', 'person', 'realistic', 'character'],
  'realistic': ['photorealistic', 'detailed', 'portrait', 'hyperrealistic'],
  'sketch': ['drawing', 'pencil', 'draft', 'line art', 'study'],
  'digital': ['digital art', 'cg', 'computer graphics', 'illustration'],
  'painting': ['oil painting', 'acrylic', 'watercolor', 'traditional'],
  'watercolor': ['painting', 'traditional', 'soft', 'artistic'],
  'illustration': ['drawing', 'artwork', 'design', 'digital'],
  'pixel art': ['pixel', 'retro', '8bit', '16bit', 'game'],

  // Themes & Concepts
  'fantasy': ['magic', 'mystical', 'dragon', 'elf', 'medieval'],
  'sci-fi': ['science fiction', 'space', 'futuristic', 'cyberpunk', 'robot'],
  'nature': ['landscape', 'trees', 'forest', 'outdoor', 'natural'],
  'abstract': ['modern', 'contemporary', 'artistic', 'experimental'],
  'cute': ['kawaii', 'adorable', 'sweet', 'chibi', 'lovely'],

  // Character types
  'character': ['person', 'figure', 'protagonist', 'hero', 'portrait'],
  'oc': ['original character', 'character', 'design', 'concept'],
  'furry': ['anthro', 'anthropomorphic', 'animal character', 'fursona'],

  // Specific subjects
  'dragon': ['fantasy', 'creature', 'mythical', 'beast'],
  'cat': ['feline', 'kitten', 'pet', 'animal'],
  'dog': ['canine', 'puppy', 'pet', 'animal'],
  'wolf': ['canine', 'wild', 'animal', 'beast'],

  // Art techniques
  'lineart': ['line art', 'sketch', 'outline', 'drawing'],
  'cel shading': ['cel', 'anime', 'toon shading', 'flat'],
  'shading': ['rendering', 'lighting', 'shadows', 'depth'],
};

// Style-based preferences
export const STYLE_CATEGORIES = {
  anime: ['anime', 'manga', 'kawaii', 'chibi', 'cel shading'],
  realistic: ['realistic', 'photorealistic', 'detailed', 'portrait', 'hyperrealistic'],
  cartoon: ['cartoon', 'character', 'animation', 'disney', 'comic'],
  fantasy: ['fantasy', 'magic', 'dragon', 'elf', 'mystical'],
  abstract: ['abstract', 'modern', 'contemporary', 'experimental'],
};

/**
 * Expands a search query with related tags
 * @param {string} query - Original search query
 * @returns {string[]} - Array of expanded search terms
 */
export function expandSearchQuery(query) {
  if (!query) return [];

  const lowerQuery = query.toLowerCase().trim();
  const terms = [lowerQuery]; // Always include original query

  // Check if query matches any synonym key
  if (TAG_SYNONYMS[lowerQuery]) {
    terms.push(...TAG_SYNONYMS[lowerQuery]);
  }

  // Also check if query is a word within a multi-word key
  for (const [key, synonyms] of Object.entries(TAG_SYNONYMS)) {
    if (key.includes(lowerQuery) || lowerQuery.includes(key)) {
      terms.push(...synonyms);
      terms.push(key);
    }
  }

  // Remove duplicates
  return [...new Set(terms)];
}

/**
 * Scores artwork relevance based on query and user preferences
 * @param {Object} artwork - Artwork object
 * @param {string} query - Search query
 * @param {Object} userPreferences - User's style preferences
 * @returns {number} - Relevance score (higher is better)
 */
export function scoreArtworkRelevance(artwork, query, userPreferences = {}) {
  let score = 0;
  const lowerQuery = query.toLowerCase();
  const expandedTerms = expandSearchQuery(query);

  // Title match (highest priority)
  if (artwork.title?.toLowerCase().includes(lowerQuery)) {
    score += 100;
  }

  // Tag matches
  if (artwork.tags && Array.isArray(artwork.tags)) {
    artwork.tags.forEach(tag => {
      const lowerTag = tag.toLowerCase();

      // Exact match
      if (lowerTag === lowerQuery) {
        score += 50;
      }
      // Partial match
      else if (lowerTag.includes(lowerQuery) || lowerQuery.includes(lowerTag)) {
        score += 25;
      }
      // Expanded terms match
      else if (expandedTerms.some(term => lowerTag.includes(term))) {
        score += 15;
      }

      // User preference bonus
      if (userPreferences.preferredTags?.includes(lowerTag)) {
        score += 20;
      }
    });
  }

  // Engagement bonus (popular content)
  if (artwork.engagement_score) {
    score += Math.min(artwork.engagement_score / 10, 10);
  }

  // Recency bonus (newer content)
  if (artwork.created_at) {
    const ageInDays = (Date.now() - new Date(artwork.created_at)) / (1000 * 60 * 60 * 24);
    if (ageInDays < 7) score += 5;
    else if (ageInDays < 30) score += 3;
  }

  return score;
}

/**
 * Get user's style preferences from their interaction history
 * @param {Array} likedArtworks - Artworks user has liked/saved
 * @returns {Object} - User preference object
 */
export function getUserStylePreferences(likedArtworks = []) {
  const tagCounts = {};
  const styleCounts = {};

  likedArtworks.forEach(artwork => {
    if (artwork.tags && Array.isArray(artwork.tags)) {
      artwork.tags.forEach(tag => {
        const lowerTag = tag.toLowerCase();
        tagCounts[lowerTag] = (tagCounts[lowerTag] || 0) + 1;

        // Categorize into style
        for (const [style, keywords] of Object.entries(STYLE_CATEGORIES)) {
          if (keywords.some(keyword => lowerTag.includes(keyword))) {
            styleCounts[style] = (styleCounts[style] || 0) + 1;
          }
        }
      });
    }
  });

  // Get top tags
  const sortedTags = Object.entries(tagCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([tag]) => tag);

  // Get preferred style
  const preferredStyle = Object.entries(styleCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0];

  return {
    preferredTags: sortedTags,
    preferredStyle,
    styleCounts,
  };
}

/**
 * Build enhanced search query with tag expansion
 * @param {string} query - Original query
 * @returns {string} - Enhanced query for API
 */
export function buildEnhancedSearchQuery(query) {
  const expandedTerms = expandSearchQuery(query);
  // Return original query (backend will handle the search)
  // But we can use expanded terms for client-side filtering/ranking
  return query;
}
