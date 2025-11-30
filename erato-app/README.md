# Erato - Art Commission Matchmaking App

<div align="center">
  
**A Pinterest/Tinder hybrid app connecting artists with clients for custom commissions**

[![React Native](https://img.shields.io/badge/React%20Native-0.76-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-52.0-000020.svg)](https://expo.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Latest-3ECF8E.svg)](https://supabase.com/)

</div>

## 📱 Overview

Erato is a mobile application that revolutionizes how artists and clients connect for commission work. Combining Pinterest's discovery experience with Tinder's matching mechanics, users can:

- **Discover** artwork in a beautiful masonry grid layout
- **Swipe** through artist portfolios to find the perfect match
- **Connect** with matched artists through in-app messaging
- **Organize** saved artworks into custom boards
- **Commission** artwork with an integrated project management system

## 🎨 Features

### Core Functionality

- **Pinterest-Style Feed**: Infinite scroll masonry grid of artwork
- **Tinder-Style Swipe**: Full-screen portfolio browsing with swipe gestures
- **Board System**: Create and organize collections of saved artwork
- **Real-time Messaging**: Chat with matched artists using Socket.io
- **Commission Management**: Full workflow from request to delivery
- **Artist Profiles**: Comprehensive portfolios with ratings and reviews

### User Types

- **Clients**: Discover artists and request commissions
- **Artists**: Showcase work and manage commissions
- **Both**: Users can be both client and artist

## 🛠 Tech Stack

### Frontend
- **Framework**: React Native with Expo
- **Navigation**: Expo Router (file-based routing)
- **State Management**: Zustand
- **UI Components**: Custom components following Pinterest design
- **Animations**: React Native Reanimated
- **Image Handling**: Expo Image with optimization
- **Lists**: @shopify/flash-list for performance

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth + JWT
- **Storage**: Supabase Storage (with S3 backup option)
- **Real-time**: Socket.io for messaging
- **Payments**: Stripe integration

### Infrastructure
- **Hosting**: Fly.io (recommended) or alternatives
- **Database**: Supabase (generous free tier)
- **CDN**: CloudFront (optional, for scaling)

## 📁 Project Structure

```
erato-app/
├── backend/
│   ├── src/
│   │   ├── routes/          # API endpoints
│   │   ├── middleware/      # Auth, error handling, etc.
│   │   ├── config/          # Configuration files
│   │   └── server.js        # Express app entry point
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── app/
│   │   ├── (tabs)/          # Main tab screens
│   │   ├── auth/            # Authentication screens
│   │   ├── artwork/         # Artwork detail screens
│   │   ├── artist/          # Artist profile screens
│   │   └── _layout.js       # Root layout
│   ├── components/          # Reusable components
│   ├── store/               # Zustand state management
│   ├── constants/           # Theme, colors, etc.
│   ├── lib/                 # Utilities and configs
│   ├── package.json
│   └── app.json
├── setup/
│   └── supabase-setup.sql   # Database schema
└── PROJECT_DOCUMENTATION.md # Detailed project docs
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Supabase account (free tier)
- Fly.io account (optional, for deployment)

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd erato-app

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Setup Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Navigate to the SQL Editor in your Supabase dashboard
3. Run the SQL script from `setup/supabase-setup.sql`
4. Get your project credentials:
   - Project URL
   - Anon/Public key
   - Service role key (for backend)

### 3. Environment Variables

**Backend** (`backend/.env`):
```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

**Frontend** (`frontend/.env`):
```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 4. Run Development Servers

**Backend**:
```bash
cd backend
npm run dev
# Server runs on http://localhost:3000
```

**Frontend** (in a new terminal):
```bash
cd frontend
npx expo start
# Follow prompts to run on iOS/Android/Web
```

## 📱 Running the App

### iOS Simulator
```bash
cd frontend
npx expo start --ios
```

### Android Emulator
```bash
cd frontend
npx expo start --android
```

### Web Browser
```bash
cd frontend
npx expo start --web
```

### Physical Device
1. Install Expo Go app from App Store/Play Store
2. Run `npx expo start`
3. Scan QR code with your device

## 🎨 Design System

The app follows Pinterest's dark theme with these key colors:

- **Background**: `#000000`
- **Surface**: `#1a1a1a`
- **Primary (Red)**: `#e60023`
- **Text Primary**: `#ffffff`
- **Text Secondary**: `#b3b3b3`

See `frontend/constants/theme.js` for complete design tokens.

## 🔐 Authentication Flow

1. User registers with email/password
2. Supabase Auth creates user account
3. Backend creates user record in database
4. JWT token issued for API authentication
5. Token stored securely using Expo SecureStore

## 📊 Database Schema

Key tables:
- **users**: User accounts and profiles
- **artists**: Artist-specific information
- **artworks**: Portfolio pieces
- **boards**: User-created collections
- **swipes**: Swipe history
- **matches**: Mutual interest connections
- **messages**: Chat conversations
- **commissions**: Commission projects

See `setup/supabase-setup.sql` for complete schema.

## 🚢 Deployment

### Backend Deployment (Fly.io)

```bash
cd backend

# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login

# Launch app
flyctl launch

# Deploy
flyctl deploy
```

### Frontend Deployment

**Option 1: EAS Build (Recommended)**
```bash
cd frontend
npm install -g eas-cli
eas build:configure
eas build --platform ios
eas build --platform android
```

**Option 2: Expo Updates**
```bash
cd frontend
npx expo publish
```

## 💰 Cost Estimates

### Development (Free Tier)
- Supabase: Free
- Fly.io: $0-5/month (generous free tier)
- Total: **$0-5/month**

### Production (1,000 users)
- Supabase: $0-25/month
- Fly.io: $5-10/month
- Total: **$5-35/month**

### Scale (10,000+ users)
- Supabase: $25-100/month
- Fly.io/Infrastructure: $20-50/month
- CDN (optional): $20-50/month
- Total: **$65-200/month**

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests (coming soon)
cd frontend
npm test
```

## 📝 API Documentation

### Key Endpoints

**Authentication**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

**Artworks**
- `GET /api/artworks` - Get artwork feed
- `GET /api/artworks/:id` - Get artwork details
- `POST /api/artworks` - Upload artwork (artists only)

**Artists**
- `GET /api/artists` - Get all artists
- `GET /api/artists/:id` - Get artist profile

**Swipes**
- `POST /api/swipes` - Record swipe
- `GET /api/swipes/suggestions` - Get artists to swipe on

See `PROJECT_DOCUMENTATION.md` for complete API documentation.

## 🐛 Known Issues

- [ ] Web platform has limited gesture support
- [ ] iOS requires additional permissions for photo uploads
- [ ] Socket.io reconnection needs improvement

## 🗺 Roadmap

### Phase 1 (MVP) - Current
- [x] Database schema
- [x] Authentication system
- [x] Pinterest-style feed
- [x] Tinder-style swipe
- [ ] Board system
- [ ] Messaging system

### Phase 2
- [ ] Commission management
- [ ] Payment integration
- [ ] Reviews and ratings
- [ ] Push notifications

### Phase 3
- [ ] Advanced search/filters
- [ ] Video portfolios
- [ ] Live streaming
- [ ] NFT integration

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 👤 Author

**Kimani**
- University of Technology, Jamaica
- Computer Science Student

## 🙏 Acknowledgments

- Pinterest for design inspiration
- Tinder for swipe UX patterns
- React Native community
- Supabase team

## 📞 Support

For questions or issues:
- Open an issue on GitHub
- Email: [your-email]
- Discord: [your-discord]

---

**Built with ❤️ using React Native, Expo, and Supabase**
