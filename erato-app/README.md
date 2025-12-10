# Verro (Erato) - Art Commission Platform

A modern mobile-first platform connecting artists and clients for custom art commissions. Built with React Native (Expo) and Node.js/Express.

## 📱 Overview

Verro is a Tinder-style swipe-to-discover platform where:
- **Clients** can explore artist portfolios, swipe to discover talent, and request custom commissions
- **Artists** can showcase their work, manage commission requests, and communicate with clients
- Both parties can review and rate each other after completed commissions

### Key Features

- 🎨 **Portfolio Management**: Artists can upload and manage portfolios with multiple images
- 👆 **Swipe Discovery**: Tinder-style interface for discovering artists/artworks
- 💬 **Real-time Messaging**: Socket.io powered chat system
- 📋 **Commission Management**: Track commission requests from creation to completion
- ⭐ **Review System**: Artists and clients can review each other after commissions
- 🎯 **Boards**: Save and organize favorite artworks into collections
- 🔔 **Notifications**: Real-time notifications for messages, commissions, and more
- 🎭 **Multi-role Support**: Single account can function as both artist and client

## 🛠 Tech Stack

### Frontend
- **React Native** (0.81.5) with **Expo** (~54.0.0)
- **Expo Router** for navigation
- **Zustand** for state management
- **Socket.io Client** for real-time features
- **Expo Image** for optimized image handling
- **React Native Reanimated** for animations

### Backend
- **Node.js** (18+) with **Express.js**
- **Supabase** (PostgreSQL database)
- **Redis** for caching and real-time messaging
- **Socket.io** for WebSocket connections
- **AWS S3** for file storage
- **JWT** for authentication
- **Multer** for file uploads

### Infrastructure
- **Docker & Docker Compose** for containerization
- **Nginx** as reverse proxy (production)
- **AWS EC2** for hosting
- **GitHub Actions** for CI/CD

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** 18.x or higher
- **npm** or **yarn**
- **Docker** and **Docker Compose** (for running backend locally)
- **Expo CLI**: `npm install -g expo-cli`
- **iOS Development**: Xcode (Mac only, for iOS development)
- **Android Development**: Android Studio (for Android development)
- **Git**
- **Supabase Account** (free tier works fine)
- **AWS Account** (for S3 storage - optional for local dev)

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd erato-app
```

### 2. Backend Setup

#### Install Dependencies

```bash
cd backend
npm install
```

#### Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
cp .env.example .env  # If you have an example file
```

Required environment variables:

```env
# Server
PORT=3000
NODE_ENV=development

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# Redis (for local development)
REDIS_URL=redis://localhost:6379

# AWS S3 (for file uploads)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your_bucket_name

# CORS
FRONTEND_URL=http://localhost:19006

# Optional: Domain (production)
DOMAIN=api.verrocio.com
```

#### Start Backend with Docker Compose

```bash
# From the erato-app root directory
docker-compose -f docker-compose.dev.yml up
```

This starts:
- Redis on port 6379
- Backend API on port 3000

Or run without Docker:

```bash
cd backend
npm run dev  # Uses nodemon for auto-reload
```

#### Verify Backend

```bash
curl http://localhost:3000/health
# Should return: {"status":"ok"}
```

### 3. Frontend Setup

#### Install Dependencies

```bash
cd frontend
npm install
```

#### Environment Variables

Create `frontend/.env` or configure in `app.json`:

```json
{
  "expo": {
    "extra": {
      "EXPO_PUBLIC_API_URL": "http://localhost:3000/api"
    }
  }
}
```

For production, update this to your deployed API URL (e.g., `https://api.verrocio.com/api`).

#### Start Development Server

```bash
cd frontend
npm start
```

This will:
- Start the Expo development server
- Open Expo Go on your phone (scan QR code) OR
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Press `w` for web

#### Build for Production

```bash
# iOS
expo build:ios

# Android
expo build:android

# Or use EAS Build
eas build --platform ios
eas build --platform android
```

## 📁 Project Structure

```
erato-app/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── supabase.js          # Supabase client config
│   │   ├── middleware/
│   │   │   ├── auth.js              # JWT authentication
│   │   │   ├── errorHandler.js      # Error handling
│   │   │   ├── rateLimiter.js       # Rate limiting
│   │   │   └── performance.js       # Performance monitoring
│   │   ├── routes/
│   │   │   ├── auth.js              # Authentication routes
│   │   │   ├── artworks.js          # Artwork CRUD
│   │   │   ├── artists.js           # Artist profiles
│   │   │   ├── boards.js            # User boards/collections
│   │   │   ├── commissions.js       # Commission management
│   │   │   ├── messages.js          # Messaging
│   │   │   ├── notifications.js     # Notifications
│   │   │   ├── reviews.js           # Review system
│   │   │   ├── swipes.js            # Swipe interactions
│   │   │   ├── uploads.js           # File uploads
│   │   │   └── users.js             # User management
│   │   ├── utils/
│   │   │   ├── cache.js             # Redis caching utilities
│   │   │   └── redisServices.js     # Redis service layer
│   │   └── server.js                # Express server setup
│   ├── Dockerfile                   # Production Docker image
│   ├── Dockerfile.dev               # Development Docker image
│   └── package.json
│
├── frontend/
│   ├── app/                         # Expo Router pages
│   │   ├── (tabs)/                  # Tab navigation
│   │   │   ├── home.js              # Home feed
│   │   │   ├── explore.js           # Explore/discover
│   │   │   ├── create.js            # Swipe interface
│   │   │   ├── boards.js            # Boards/commissions
│   │   │   ├── messages.js          # Messages list
│   │   │   └── profile.js           # User profile
│   │   ├── auth/                    # Authentication screens
│   │   ├── artist/[id].js           # Artist profile view
│   │   ├── artwork/                 # Artwork screens
│   │   ├── board/[id].js            # Board detail
│   │   ├── client/[id].js           # Client profile
│   │   ├── commission/              # Commission screens
│   │   ├── messages/[id].js         # Chat screen
│   │   ├── onboarding/              # Onboarding flows
│   │   └── profile/                 # Profile editing
│   ├── components/
│   │   ├── ReviewModal.js           # Review submission modal
│   │   ├── SearchModal.js           # Search interface
│   │   └── StyledToast.js           # Custom toast messages
│   ├── constants/
│   │   └── theme.js                 # Design system constants
│   ├── store/
│   │   ├── index.js                 # Main Zustand store
│   │   ├── profileStore.js          # Profile state
│   │   └── boardStore.js            # Board state
│   ├── utils/
│   │   ├── imageUpload.js           # Image upload utilities
│   │   └── debugAPI.js              # API debugging helpers
│   ├── lib/
│   │   ├── socket.js                # Socket.io setup
│   │   └── supabase.js              # Supabase client
│   └── package.json
│
├── docker-compose.dev.yml           # Development Docker setup
├── docker-compose.prod.yml          # Production Docker setup
└── README.md                        # This file
```

## 🔧 Development Workflow

### Running Locally

1. **Start Backend** (Terminal 1):
   ```bash
   docker-compose -f docker-compose.dev.yml up
   ```

2. **Start Frontend** (Terminal 2):
   ```bash
   cd frontend
   npm start
   ```

3. **Open App**:
   - Scan QR code with Expo Go app (iOS/Android)
   - Or press `i`/`a` for simulator/emulator

### Code Style

- Use **ESLint** (configured in backend)
- Follow **React Native** best practices
- Use **functional components** and **hooks**
- Prefer **async/await** over promises
- Use **Zustand** for global state management

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/your-feature-name
```

### Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests (if configured)
cd frontend
npm test
```

## 🗄 Database Schema

The app uses **Supabase** (PostgreSQL) with the following main tables:

- `users` - User accounts (artists/clients)
- `artists` - Artist profiles and portfolio
- `artworks` - Artwork posts
- `boards` - User collections/boards
- `board_artworks` - Artworks in boards
- `commissions` - Commission requests
- `messages` - Chat messages
- `conversations` - Chat conversations
- `conversation_participants` - Chat participants
- `swipes` - Swipe interactions
- `reviews` - Reviews/ratings
- `notifications` - User notifications

## 🌐 Deployment

### Backend Deployment (EC2)

1. **SSH into EC2**:
   ```bash
   ./ssh-ec2.sh
   ```

2. **Deploy**:
   ```bash
   # Pull latest changes
   git pull origin main

   # Rebuild and restart containers
   cd /path/to/erato-app
   docker-compose -f docker-compose.prod.yml up -d --build
   ```

3. **View Logs**:
   ```bash
   docker-compose -f docker-compose.prod.yml logs -f backend
   ```

### Frontend Deployment

Frontend is deployed via **Expo** or **EAS Build**:

```bash
# Build for production
cd frontend
eas build --platform ios
eas build --platform android

# Or submit to stores
eas submit --platform ios
eas submit --platform android
```

### Environment Setup (Production)

1. Set up environment variables on server
2. Configure Nginx reverse proxy
3. Set up SSL certificates (Let's Encrypt)
4. Configure DNS (A record pointing to EC2 IP)

## 🐛 Troubleshooting

### Backend Issues

**Port already in use**:
```bash
# Find process using port 3000
lsof -i :3000
# Kill process
kill -9 <PID>
```

**Docker issues**:
```bash
# Rebuild containers
docker-compose down
docker-compose up --build
```

**Redis connection errors**:
- Ensure Redis is running: `docker ps`
- Check Redis URL in `.env`

### Frontend Issues

**Metro bundler cache issues**:
```bash
cd frontend
expo start -c  # Clear cache
```

**Module resolution errors**:
```bash
rm -rf node_modules
npm install
```

**iOS build issues**:
```bash
cd ios
pod install
cd ..
```

**Android build issues**:
```bash
cd android
./gradlew clean
cd ..
```

### Common Errors

**"Network Error" on API calls**:
- Check backend is running
- Verify API URL in `app.json` or `.env`
- Check CORS settings in backend

**"JWT expired"**:
- User needs to log in again
- Check JWT expiration time

**Images not loading**:
- Verify AWS S3 credentials
- Check bucket permissions
- Verify image URLs in database

## 👥 Contributing

### For New Team Members

1. **Read this README** thoroughly
2. **Set up local environment** (follow Getting Started)
3. **Review existing code** to understand patterns
4. **Ask questions** - no question is too small!

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation
- `refactor/description` - Code refactoring

### Commit Messages

Follow conventional commits:
- `feat: add new feature`
- `fix: resolve bug`
- `docs: update documentation`
- `refactor: improve code structure`

### Pull Requests

1. Create feature branch from `main`
2. Make changes and test thoroughly
3. Update documentation if needed
4. Create PR with clear description
5. Request review from team
6. Address feedback
7. Merge after approval

## 📚 Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [Socket.io Documentation](https://socket.io/docs/)
- [Zustand Documentation](https://docs.pmnd.rs/zustand)

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Support

For questions or issues:
- Create an issue on GitHub
- Reach out to the team on Slack/Discord
- Check existing documentation

## 🎯 Roadmap

- [ ] Enhanced search functionality
- [ ] Payment integration (Stripe)
- [ ] Advanced filtering options
- [ ] Push notifications
- [ ] Analytics dashboard
- [ ] Multi-language support

---

**Built with ❤️ by the Verro team**

