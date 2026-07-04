/**
 * Enable Phone and Google Auth Providers in Supabase
 * 
 * Usage: node enable-providers-fixed.mjs
 */

import https from 'https';
import { readFileSync } from 'fs';

// Simple .env parser
const envContent = readFileSync('.env', 'utf-8');
const env = {};

envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  
  const [key, ...valueParts] = trimmed.split('=');
  if (key && valueParts.length > 0) {
    let value = valueParts.join('=').trim();
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key.trim()] = value;
  }
});

const SUPABASE_URL = env.SUPABASE_URL;
const PROJECT_ID = env.SUPABASE_PROJECT_ID;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Environment check:');
console.log(`  SUPABASE_URL: ${SUPABASE_URL ? '✅' : '❌'}`);
console.log(`  PROJECT_ID: ${PROJECT_ID ? '✅' : '❌'}`);
console.log(`  SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY ? '✅ (length: ' + SERVICE_ROLE_KEY.length + ')' : '❌'}\n`);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

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
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(json)}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  console.log('🚀 Enabling Authentication Providers...\n');
  console.log(`Project: ${PROJECT_ID}\n`);

  // Enable Phone
  console.log('📱 Enabling Phone provider...');
  try {
    await makeRequest(`https://api.supabase.com/v1/projects/${PROJECT_ID}/config/auth`, {
      phone: {
        enabled: true,
        otp_length: 6,
      }
    });
    console.log('✅ Phone provider enabled\n');
  } catch (error) {
    console.error('❌ Phone provider failed:', error.message, '\n');
  }

  // Enable Google
  console.log('🔵 Enabling Google provider...');
  try {
    await makeRequest(`https://api.supabase.com/v1/projects/${PROJECT_ID}/config/auth`, {
      external_google: {
        enabled: true,
        client_id: '',
        client_secret: '',
        redirect_uri: `${SUPABASE_URL}/auth/v1/callback`,
      }
    });
    console.log('✅ Google provider enabled\n');
  } catch (error) {
    console.error('❌ Google provider failed:', error.message, '\n');
  }

  console.log('📋 Next Steps:');
  console.log('1. Visit: https://supabase.com/dashboard/project/' + PROJECT_ID + '/auth/providers');
  console.log('2. Add Google OAuth credentials (Client ID & Secret from Google Cloud Console)');
  console.log('3. Configure SMS gateway for Phone auth (Twilio or Supabase default)');
  console.log('4. Test at: http://localhost:3000/auth');
}

main().catch(console.error);