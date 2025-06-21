# ModelMix - AI Comparison Platform

A powerful web application that allows users to compare AI responses from multiple models including OpenAI, Claude, Gemini, DeepSeek and more. Get the best insights by blending different AI perspectives.

## Features

- 🤖 **Multi-AI Comparison**: Compare responses from 400+ AI models
- 📊 **Analytics Dashboard**: Track AI performance and preferences
- 🔐 **Secure Authentication**: Email/password authentication with Supabase
- 💾 **Conversation History**: All conversations are saved and searchable
- 🎨 **Image Generation**: AI-powered image creation with multiple models
- 🌐 **Internet Search**: Real-time web search integration
- 📁 **File Upload**: Upload documents for AI analysis
- 🎤 **AI Debate Club**: Watch AI models debate each other
- 💳 **PayPal Integration**: Secure payment processing for Pro plans

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Payments**: PayPal SDK
- **Icons**: Lucide React
- **Build Tool**: Vite

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase account
- A PayPal Business account (for payments)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd modelmix
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_PAYPAL_CLIENT_ID=your_paypal_client_id
   VITE_PAYPAL_CLIENT_SECRET=your_paypal_client_secret
   VITE_PAYPAL_ENVIRONMENT=sandbox
   ```

4. **Set up Supabase**
   - Create a new Supabase project
   - Run the migrations in the `supabase/migrations` folder
   - Configure Row Level Security (RLS) policies

5. **Set up PayPal**
   - Create a PayPal Business account
   - Get your Client ID and Client Secret from PayPal Developer Dashboard
   - Set environment to 'sandbox' for testing, 'production' for live

6. **Start the development server**
   ```bash
   npm run dev
   ```

## PayPal Integration Setup

### 1. PayPal Developer Account Setup

1. Go to [PayPal Developer](https://developer.paypal.com/)
2. Sign in with your PayPal Business account
3. Create a new app in the Developer Dashboard
4. Get your Client ID and Client Secret

### 2. Environment Configuration

Add these variables to your `.env` file:

```env
# PayPal Configuration
VITE_PAYPAL_CLIENT_ID=your_paypal_client_id
VITE_PAYPAL_CLIENT_SECRET=your_paypal_client_secret
VITE_PAYPAL_ENVIRONMENT=sandbox  # Use 'production' for live payments
```

### 3. Testing Payments

- Use PayPal's sandbox environment for testing
- Create test accounts in PayPal Developer Dashboard
- Test the complete payment flow before going live

### 4. Going Live

1. Change `VITE_PAYPAL_ENVIRONMENT` to `production`
2. Use your live PayPal credentials
3. Test thoroughly in production environment

## Project Structure

```
src/
├── components/          # React components
│   ├── ChatArea.tsx    # Main chat interface
│   ├── Sidebar.tsx     # Navigation sidebar
│   ├── PayPalButton.tsx # PayPal payment component
│   └── ...
├── hooks/              # Custom React hooks
├── services/           # API and business logic
│   ├── paypalService.ts # PayPal integration
│   ├── aiService.ts    # AI model interactions
│   └── ...
├── types/              # TypeScript type definitions
└── lib/                # Utility libraries
```

## Key Features

### AI Model Comparison
- Support for 400+ AI models through OpenRouter
- Traditional models: OpenAI, Gemini, DeepSeek
- Real-time response comparison
- Analytics tracking for model performance

### Payment System
- Secure PayPal integration
- Monthly Pro subscription ($9.99/month)
- Automatic tier upgrades
- Payment success/error handling

### File Upload System
- Support for PDF, Word, TXT, ZIP files
- Automatic file processing and text extraction
- 1-hour automatic cleanup
- Context integration with AI conversations

### Admin Dashboard
- User management
- Global API key management
- System analytics
- Activity logging

## Deployment

### Frontend Deployment (Netlify)

1. Build the project:
   ```bash
   npm run build
   ```

2. Deploy to Netlify:
   - Connect your repository to Netlify
   - Set environment variables in Netlify dashboard
   - Deploy from the `dist` folder

### Database (Supabase)

1. Set up Supabase project
2. Run migrations from `supabase/migrations/`
3. Configure RLS policies
4. Set up global API keys for free trial access

## Environment Variables

### Required Variables

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# PayPal
VITE_PAYPAL_CLIENT_ID=your_paypal_client_id
VITE_PAYPAL_CLIENT_SECRET=your_paypal_client_secret
VITE_PAYPAL_ENVIRONMENT=sandbox
```

### Optional API Keys (for enhanced features)

Users can configure these in the app settings:

- OpenAI API Key
- OpenRouter API Key
- Google Gemini API Key
- DeepSeek API Key
- Serper API Key (for internet search)
- Imagerouter API Key (for image generation)

## Security Considerations

### PayPal Security
- Client secrets should be handled server-side in production
- Use HTTPS for all payment transactions
- Validate all payment webhooks
- Implement proper error handling

### API Key Management
- Personal API keys are encrypted in the database
- Global API keys are managed by superadmins only
- Usage limits prevent abuse
- Row Level Security (RLS) protects user data

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (including payment flows)
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support with:
- **General issues**: Create a GitHub issue
- **Payment problems**: Contact PayPal support
- **Database issues**: Check Supabase documentation

## Roadmap

- [ ] Stripe payment integration (alternative to PayPal)
- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Team collaboration features
- [ ] API access for developers
- [ ] Webhook integrations