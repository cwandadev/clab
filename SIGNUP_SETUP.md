# Authentication Setup Guide

This guide explains how to enable Phone and Google authentication providers in your Supabase project.

## Prerequisites

- Supabase project: `oqcjznvmkgilptqpicft`
- Project URL: `https://oqcjznvmkgilptqpicft.supabase.co`

## 1. Enable Google Authentication

### Step 1: Create Google OAuth Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select your existing project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Select **Web application**
6. Add the following authorized redirect URIs:
   - `http://localhost:3000/auth/callback`
   - `https://your-production-domain.com/auth/callback` (for production)
7. Copy the **Client ID** and **Client Secret**

### Step 2: Configure in Supabase Dashboard

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard/project/oqcjznvmkgilptqpicft/auth/providers)
2. Click on **Google** in the providers list
3. Enable the provider by toggling it on
4. Paste the **Client ID** and **Client Secret** from Google Cloud Console
5. Set the **Redirect URI** to: `http://localhost:3000/auth/callback`
6. Click **Save**

## 2. Enable Phone Authentication

### Step 1: Choose an SMS Provider

Supabase supports multiple SMS providers. Choose one:

#### Option A: Twilio (Recommended)
1. Sign up at [Twilio](https://www.twilio.com/)
2. Get your **Account SID** and **Auth Token** from the Twilio Console
3. Purchase a phone number or use Twilio's messaging service
4. Note your **Messaging Service SID** (optional but recommended)

#### Option B: MessageBird
1. Sign up at [MessageBird](https://www.messagebird.com/)
2. Get your **API Key** from the dashboard

#### Option C: Vonage (Nexmo)
1. Sign up at [Vonage](https://www.vonage.com/)
2. Get your **API Key** and **API Secret**

### Step 2: Configure in Supabase Dashboard

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard/project/oqcjznvmkgilptqpicft/auth/providers)
2. Click on **Phone** in the providers list
3. Enable the provider by toggling it on
4. Select your SMS provider (Twilio, MessageBird, etc.)
5. Enter your provider credentials:
   - **Twilio**: Account SID, Auth Token, Messaging Service SID
   - **MessageBird**: API Key
   - **Vonage**: API Key, API Secret
6. Set **OTP Length** to `6` (default)
7. Set **OTP Expiry** to `300` seconds (5 minutes)
8. Click **Save**

### Step 3: Update Configuration File

Update `supabase/config.toml` with your actual credentials:

```toml
project_id = "oqcjznvmkgilptqpicft"

[auth]
enabled = true
external_google_enabled = true
external_phone_enabled = true
external_phone_otp_length = 6
external_phone_otp_expiry = 300

[auth.external.google]
enabled = true
client_id = "your-actual-google-client-id"
client_secret = "your-actual-google-client-secret"
redirect_uri = "http://localhost:3000/auth/callback"
skip_verification = false

[auth.sms]
enabled = true
provider = "twilio"
twilio_account_sid = "your-twilio-account-sid"
twilio_auth_token = "your-twilio-auth-token"
twilio_message_service_sid = "your-twilio-messaging-service-sid"
otp_length = 6
otp_expiry = 300
```

## 3. Configure Site URL

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard/project/oqcjznvmkgilptqpicft/auth/url-configuration)
2. Set **Site URL** to: `http://localhost:3000`
3. Add **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/auth`
   - Add your production URLs when deploying

## 4. Test the Authentication

### Test Google Sign-In
1. Navigate to `http://localhost:3000/auth`
2. Click **Continue with Google**
3. Sign in with your Google account
4. You should be redirected back to the app

### Test Phone Sign-In
1. Navigate to `http://localhost:3000/auth`
2. Select **Phone** tab
3. Choose your country code
4. Enter your phone number
5. Click **Send code**
6. Enter the verification code you received
7. Click **Verify & sign in**

### Test Email Sign-In
1. Navigate to `http://localhost:3000/auth`
2. Enter your email and password
3. Click **Create account** or **Sign in**

## 5. Common Issues and Solutions

### "Unsupported phone provider"
- **Solution**: Enable Phone provider in Supabase Dashboard → Authentication → Providers
- Ensure you've configured an SMS provider (Twilio, MessageBird, etc.)

### "Unsupported provider: provider is not enabled"
- **Solution**: Enable Google provider in Supabase Dashboard → Authentication → Providers
- Ensure you've added valid Google OAuth credentials

### "Invalid redirect URI"
- **Solution**: Add the exact redirect URI to your Google OAuth credentials
- The redirect URI must match exactly: `http://localhost:3000/auth/callback`

### "Phone number not verified"
- **Solution**: Ensure your SMS provider is properly configured
- Check that you have sufficient credits in your SMS provider account
- Verify the phone number format includes country code (e.g., +250788123456)

### OTP not received
- **Solution**: Check your SMS provider dashboard for delivery logs
- Ensure the phone number is valid and can receive SMS
- Check for rate limiting (wait a few minutes before retrying)

## 6. Production Deployment

When deploying to production:

1. Update `supabase/config.toml` with production credentials
2. Update Google OAuth redirect URIs to include your production domain
3. Update Supabase Site URL and Redirect URLs
4. Ensure your SMS provider has sufficient credits for production traffic
5. Test all authentication flows in production environment

## 7. Security Best Practices

- Never commit `.env` files with actual credentials to version control
- Use environment variables for sensitive credentials
- Enable email verification for email sign-ups
- Set appropriate OTP expiry times (5-10 minutes)
- Monitor authentication logs for suspicious activity
- Implement rate limiting to prevent abuse
- Use HTTPS in production

## 8. Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Twilio Documentation](https://www.twilio.com/docs/sms)
- [Supabase Phone Auth Guide](https://supabase.com/docs/guides/auth/phone-login)

## Support

If you encounter issues:
1. Check the Supabase Dashboard logs for detailed error messages
2. Review the browser console for client-side errors
3. Verify all credentials are correctly configured
4. Test with different phone numbers and email addresses