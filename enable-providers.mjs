/**
 * Enable Phone and Google Auth Providers in Supabase
 * 
 * This script uses the Supabase Management API to enable providers.
 * Requires: SUPABASE_SERVICE_ROLE_KEY from your .env file
 * 
 * Usage: node enable-providers.mjs
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    // Skip comments and empty lines
    if (!line || line.startsWith('#')) return;
    
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      env[key] = value;
    }
  });
  
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.SUPABASE_URL;
const PROJECT_ID = env.SUPABASE_PROJECT_ID || 'oqcjznvmkgilptqpicft';
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Checking environment variables...');
console.log(`SUPABASE_URL: ${SUPABASE_URL ? '✅ Found' : '❌ Missing'}`);
console.log(`PROJECT_ID: ${PROJECT_ID ? '✅ Found' : '❌ Missing'}`);
console.log(`SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY ? '✅ Found' : '❌ Missing'}\n`);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Error: Required environment variables not found in .env file');
  console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

// Make API request to Supabase Management API
function makeRequest(endpoint, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${json.message || body}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

async function enablePhoneProvider() {
  console.log('📱 Enabling Phone provider...');
  try {
    const result = await makeRequest(
      `https://api.supabase.com/v1/projects/${PROJECT_ID}/config/auth`,
      {
        phone: {
          enabled: true,
          otp_length: 6,
          template: {
            content: "Your OTP code is {{ .Code }}. Valid for {{ .Expiry }} seconds.",
          },
        },
      }
    );
    console.log('✅ Phone provider enabled successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to enable Phone provider:', error.message);
    console.error('   This may be normal - you may need to enable it manually in the dashboard');
    return false;
  }
}

async function enableGoogleProvider() {
  console.log('🔵 Enabling Google provider...');
  try {
    const result = await makeRequest(
      `https://api.supabase.com/v1/projects/${PROJECT_ID}/config/auth`,
      {
        external_google: {
          enabled: true,
          client_id: '', // You need to fill this in from Google Cloud Console
          client_secret: '', // You need to fill this in from Google Cloud Console
          redirect_uri: `${SUPABASE_URL}/auth/v1/callback`,
        },
      }
    );
    console.log('✅ Google provider enabled successfully');
    console.log('⚠️  Note: You still need to add Google OAuth credentials in the dashboard');
    return true;
  } catch (error) {
    console.error('❌ Failed to enable Google provider:', error.message);
    console.error('   This may be normal - you may need to enable it manually in the dashboard');
    return false;
  }
}

async function main() {
  console.log('🚀 Enabling Authentication Providers...\n');
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`URL: ${SUPABASE_URL}\n`);

  const phoneEnabled = await enablePhoneProvider();
  console.log('');
  const googleEnabled = await enableGoogleProvider();
  console.log('');

  if (phoneEnabled && googleEnabled) {
    console.log('✨ All providers enabled!');
    console.log('\n📋 Next Steps:');
    console.log('1. Add Google OAuth credentials in Supabase Dashboard:');
    console.log('   https://supabase.com/dashboard/project/' + PROJECT_ID + '/auth/providers');
    console.log('2. Configure SMS gateway (Twilio) for Phone auth in the same dashboard');
    console.log('3. Test authentication at http://localhost:3000/auth');
  } else {
    console.log('⚠️  Some providers failed to enable. Please enable them manually in the dashboard.');
    console.log('   Dashboard URL: https://supabase.com/dashboard/project/' + PROJECT_ID + '/auth/providers');
  }
}

main().catch(console.error);