# Enable Phone and Google Providers in Supabase

## Option 1: Use Supabase Dashboard (Recommended)

### Step-by-Step Instructions:

1. **Open Supabase Dashboard**
   - URL: https://supabase.com/dashboard/project/oqcjznvmkgilptqpicft/auth/providers
   - Login with your Supabase account

2. **Enable Phone Provider**
   - Click on **Phone** in the providers list
   - Toggle **"Enable Phone provider"** to ON
   - Choose an SMS gateway:
     - **Option A**: Use Supabase's default (requires enabling in project settings)
     - **Option B**: Use Twilio (requires Twilio Account SID, Auth Token, and phone number)
   - Click **Save**

3. **Enable Google Provider**
   - Click on **Google** in the providers list
   - Toggle **"Enable Google provider"** to ON
   - You need Google OAuth credentials:
     - Go to https://console.cloud.google.com/apis/credentials
     - Create a new OAuth 2.0 Client ID (Web application)
     - Add authorized redirect URI: `https://oqcjznvmkgilptqpicft.supabase.co/auth/v1/callback`
     - Copy the **Client ID** and **Client Secret**
   - Paste them into the Supabase Google provider settings
   - Click **Save**

4. **Verify Enabled Providers**
   - You should see both Phone and Google listed as "Enabled" (green checkmark)

## Option 2: Use Supabase CLI (if installed)

If you have Node.js/npm installed, you can use npx to run Supabase CLI without installing it globally:

```bash
# Link your project (if not already linked)
npx supabase link --project-id oqcjznvmkgilptqpicft

# This command will open an interactive prompt to configure providers
npx supabase auth providers
```

However, the CLI may not support enabling providers directly. The Dashboard method is more reliable.

## Current Error Messages Explained

### Phone Auth Error
```
Phone authentication is not available. Please use email or Google sign-in.
```
**Cause**: Phone provider is disabled in Supabase Dashboard
**Fix**: Enable Phone provider (see Option 1, Step 2)

### Google Auth Error
```
{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
```
**Cause**: Google provider is disabled in Supabase Dashboard
**Fix**: Enable Google provider and add OAuth credentials (see Option 1, Step 3)

## Quick Links

- Supabase Dashboard: https://supabase.com/dashboard/project/oqcjznvmkgilptqpicft/auth/providers
- Google Cloud Console: https://console.cloud.google.com/apis/credentials
- Supabase Auth Docs: https://supabase.com/docs/guides/auth/social-login/auth-google

## After Enabling Providers

Once you've enabled both providers in the dashboard:

1. Return to your app at http://localhost:3000/auth
2. Test Phone signup:
   - Select country code (e.g., +250 for Rwanda)
   - Enter phone number (e.g., 788123456)
   - Click "Send code"
   - Enter the 6-digit OTP
   - Should successfully sign in
3. Test Google signup:
   - Click "Continue with Google"
   - Select your Google account
   - Should redirect back and create account

## Troubleshooting

### Phone SMS not sending?
- Check that you've configured an SMS gateway (Twilio or Supabase Auth)
- Verify the phone number format is correct (country code + number)
- Check Twilio account balance if using Twilio

### Google redirect error?
- Ensure the redirect URI in Google Cloud Console is EXACTLY:
  `https://oqcjznvmkgilptqpicft.supabase.co/auth/v1/callback`
- No trailing slashes, no http (must be https)

### Still not working?
- Clear browser cache and cookies
- Check browser console for errors
- Verify environment variables in `.env` are correct