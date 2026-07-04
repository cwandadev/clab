# Phone SMS Gateway Setup for Supabase

## Current Status
- ✅ Phone provider: ENABLED in Supabase Dashboard
- ❌ SMS Gateway: NOT CONFIGURED (required to send OTP codes)
- Result: "Phone authentication is not available" error

## Why SMS Gateway is Required

Supabase needs an SMS provider to send OTP codes. You have these options:

## Option 1: Twilio (Recommended - Easy Setup)

### Steps:
1. **Create Twilio Account**
   - Go to https://www.twilio.com/try-twilio
   - Sign up (free trial gives you ~$15 credit)
   - Verify your phone number

2. **Get Twilio Credentials**
   - Find your **Account SID** and **Auth Token**
   - Buy a phone number (~$1/month, or use trial number)

3. **Configure in Supabase**
   - Dashboard: https://supabase.com/dashboard/project/oqcjznvmkgilptqpicft/auth/providers
   - Click **Phone**
   - Select SMS Provider: **Twilio**
   - Enter:
     - Account SID
     - Auth Token
     - Twilio Phone Number
   - Save

### Costs:
- Trial account: ~$0.01-0.05 per SMS (free $15 credit)
- Paid account: ~$0.0075 per SMS

## Option 2: Use Supabase Auth (No External Provider)

Supabase offers built-in SMS for Pro plans and above. For Free tier, you need an external provider.

## Option 3: Development Mode (Test Without SMS)

If you're in development and don't want SMS costs, you can:

1. Use **Email authentication** (free)
2. Use **Google authentication** (free)
3. Disable Phone auth in the UI until ready for production

## Option 4: MessageBird, Vonage, or Other Providers

Similar setup to Twilio:
- Dashboard → Phone Provider
- Select provider
- Enter credentials

## Troubleshooting

### "SMS not sending" errors:
- Verify Twilio credentials are correct
- Check phone number format (E.164: +1234567890)
- Ensure Twilio account has funds
- Check Twilio console for error logs

### "Phone not verified" errors:
- Make sure SMS test number is added in Supabase Dashboard
- Check phone carrier blocking SMS

### Free SMS Alternatives (Testing):
- TextMagic (free trial)
- Nexmo (Vonage) trial
- AWS SNS (pay-per-use)

## Quick Test

After configuration, test with:
```bash
# Using the developer console in browser
const { supabase } = await import('@/integrations/supabase/client');
const { error } = await supabase.auth.signInWithOtp({
  phone: '+12065551234' // Your test number
});
console.log(error || 'SMS sent!');
```

## Recommendation

For **production** use:
- Use Twilio or MessageBird
- Budget ~$0.01 per SMS
- Add phone number validation

For **development**:
- Use Email + Google auth
- Keep Phone provider enabled but note SMS costs
- Test thoroughly before deploying

## Next Steps

1. Choose an SMS provider
2. Get API credentials
3. Configure in Supabase Dashboard
4. Test phone signup at http://localhost:3000/auth