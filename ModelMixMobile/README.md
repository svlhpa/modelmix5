# ModelMix Mobile

A React Native mobile app built with Expo that provides a native mobile experience for the ModelMix AI comparison platform.

## Features

- 🤖 **AI Model Comparison**: Compare responses from multiple AI models
- 📱 **Native Mobile Experience**: Optimized for iOS and Android
- 🔄 **Real-time Sync**: Seamlessly syncs with the web application
- 🔐 **Secure Authentication**: Email/password authentication with Supabase
- 📊 **Analytics Dashboard**: Track AI model performance
- ⚙️ **Settings Management**: Configure API keys and model preferences
- 🎨 **Beautiful UI**: Modern design with smooth animations

## Tech Stack

- **Framework**: Expo React Native
- **Database**: Supabase (shared with web app)
- **Authentication**: Supabase Auth
- **Navigation**: Expo Router
- **Styling**: React Native StyleSheet with LinearGradient
- **Icons**: Expo Vector Icons
- **Animations**: React Native Animated API

## Getting Started

### Prerequisites

- Node.js 18+ 
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ModelMixMobile
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your Supabase credentials:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start the development server**
   ```bash
   npm start
   ```

5. **Run on device/simulator**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app for physical device

## Project Structure

```
ModelMixMobile/
├── app/                    # App screens (Expo Router)
│   ├── _layout.tsx        # Root layout
│   ├── index.tsx          # Home screen
│   ├── auth.tsx           # Authentication screen
│   ├── chat.tsx           # Chat interface
│   ├── settings.tsx       # Settings screen
│   └── analytics.tsx      # Analytics dashboard
├── lib/
│   └── supabase.ts        # Supabase client configuration
├── types/
│   ├── index.ts           # TypeScript type definitions
│   └── database.ts        # Database type definitions
├── assets/                # Images and icons
└── app.json              # Expo configuration
```

## Key Features

### 🏠 **Home Screen**
- Beautiful landing page with feature highlights
- Smooth animations and gradients
- Quick access to main features

### 🔐 **Authentication**
- Email/password sign up and sign in
- Secure token-based authentication
- Seamless integration with Supabase Auth

### 💬 **Chat Interface**
- Real-time AI model comparison
- Message history with conversation turns
- Image upload support (planned)
- Responsive design for all screen sizes

### ⚙️ **Settings**
- API key management for different providers
- Model selection and configuration
- User profile management
- Secure key storage

### 📊 **Analytics**
- Provider performance tracking
- Selection rate analytics
- Visual charts and insights
- Historical data analysis

## Database Integration

The mobile app shares the same Supabase database as the web application, ensuring:

- **Data Synchronization**: Conversations sync across devices
- **Unified Analytics**: Performance data is shared
- **Consistent Settings**: API keys and preferences sync
- **Real-time Updates**: Changes reflect immediately

## Deployment

### Building for Production

1. **Configure app.json**
   - Update bundle identifiers
   - Set app icons and splash screens
   - Configure build settings

2. **Build for iOS**
   ```bash
   expo build:ios
   ```

3. **Build for Android**
   ```bash
   expo build:android
   ```

### App Store Deployment

1. **iOS App Store**
   - Use Expo's build service or EAS Build
   - Submit through App Store Connect

2. **Google Play Store**
   - Generate signed APK/AAB
   - Upload through Google Play Console

## Environment Variables

Required environment variables:

- `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on both iOS and Android
5. Submit a pull request

## License

This project is licensed under the MIT License.