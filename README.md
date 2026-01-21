# Subscription Tracker

A lifecycle-focused subscription tracking web application with a glassmorphic design, built with vanilla HTML, CSS, and JavaScript with Supabase as the backend.

## Features

- 📱 **Mobile-first responsive design** with glassmorphism aesthetic
- 🔐 **Secure authentication** with email/password and MFA (TOTP) support
- 📊 **Lifecycle tracking** - see payment progress, time remaining, and status
- 🎨 **Dark/Light theme** with system preference detection
- 💰 **Multi-currency support** (USD, EUR, GBP, CAD, AUD, JPY)
- 🏷️ **Categories** for organizing subscriptions
- 🔍 **Search and filter** subscriptions by status and more

## Pages

| Page | Description |
|------|-------------|
| `index.html` | Landing page with features overview |
| `login.html` | Sign in with email/password + MFA |
| `register.html` | Create new account with password strength indicator |
| `forgot-password.html` | Request password reset link |
| `reset-password.html` | Set new password (via email link) |
| `dashboard.html` | Overview with summary cards and recent subscriptions |
| `subscriptions.html` | Full list with search, filter, and sort |
| `subscription-new.html` | Create new subscription form |
| `subscription-detail.html` | View subscription lifecycle and details |
| `subscription-edit.html` | Edit existing subscription |
| `settings.html` | Theme, password change, MFA management |

## Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be ready

### 2. Set Up the Database

1. Go to the SQL Editor in your Supabase dashboard
2. Copy the contents of `database/schema.sql`
3. Run the SQL to create the subscriptions table with RLS policies

### 3. Configure Authentication

1. Go to Authentication → Providers in Supabase
2. Ensure Email provider is enabled
3. (Optional) Enable MFA in Authentication → Settings → Multi-Factor Authentication

### 4. Update Configuration

Edit `config.js` with your Supabase credentials:

```javascript
const CONFIG = {
  supabaseUrl: 'https://YOUR-PROJECT-ID.supabase.co',
  supabaseAnonKey: 'your-anon-key-here'
};
```

Find these values in: Project Settings → API

### 5. Run the App

Since this is a static HTML app, you can:

**Option A: Open directly in browser**
- Just open `index.html` in your browser

**Option B: Use a local server (recommended for best experience)**
```bash
# Using Python
python -m http.server 8000

# Using Node.js (npx)
npx serve .

# Using VS Code Live Server extension
# Right-click index.html → "Open with Live Server"
```

Then open http://localhost:8000 in your browser.

## File Structure

```
html-app/
├── index.html              # Landing page
├── login.html              # Login page
├── register.html           # Registration page
├── forgot-password.html    # Password reset request
├── reset-password.html     # New password form
├── dashboard.html          # Main dashboard
├── subscriptions.html      # Subscription list
├── subscription-new.html   # Create subscription
├── subscription-detail.html # View subscription
├── subscription-edit.html  # Edit subscription
├── settings.html           # Settings page
├── config.js               # Supabase configuration
├── css/
│   ├── tokens.css          # Design tokens (colors, spacing, etc.)
│   ├── components.css      # Reusable components (buttons, cards, inputs)
│   └── layout.css          # Layout styles (sidebar, navigation)
├── js/
│   ├── supabase-client.js  # Supabase initialization & auth helpers
│   ├── calculations.js     # Subscription lifecycle calculations
│   └── utils.js            # Theme, validation, and utility functions
├── database/
│   └── schema.sql          # Database schema for Supabase
└── README.md               # This file
```

## Lifecycle Tracking

The app enforces a **lifecycle constraint**: every subscription must have either:
- **Total Payments**: e.g., 12 monthly payments
- **End Date**: e.g., subscription ends Dec 31, 2025

This allows the app to calculate:
- Payment progress (X of Y payments made)
- Time remaining until end
- Status (Active, Ending Soon, Completed, Cancelled)

## Styling

The app uses a **glassmorphism** design with:
- Frosted glass backgrounds with backdrop blur
- Subtle borders and shadows
- Smooth transitions and hover effects
- CSS custom properties for easy theming

### Theme Customization

Edit `css/tokens.css` to customize colors:

```css
:root {
  --color-primary: #6366f1;  /* Indigo */
  --color-secondary: #8b5cf6; /* Purple */
  /* ... */
}
```

## Security

- **Row Level Security (RLS)**: Users can only access their own data
- **Password validation**: 8+ chars, uppercase, lowercase, number, special char
- **MFA support**: Optional TOTP-based two-factor authentication
- **Secure session handling**: Supabase handles JWT tokens automatically

## Browser Support

Works in all modern browsers:
- Chrome 88+
- Firefox 78+
- Safari 14+
- Edge 88+

## License

MIT License - feel free to use and modify for your own projects!
