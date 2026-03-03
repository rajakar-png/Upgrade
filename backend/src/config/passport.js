import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as DiscordStrategy } from 'passport-discord';
import { env } from './env.js';
import { getOne, runSync } from './db.js';
import { pterodactyl } from '../services/pterodactyl.js';
import { randomBytes } from 'crypto';

// Serialize user to session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await getOne(
      'SELECT id, email, role, coins, balance FROM users WHERE id = ?',
      [id]
    );
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${env.OAUTH_CALLBACK_URL}/api/auth/google/callback`,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          if (!email) {
            console.error('[AUTH] Google OAuth: No email provided');
            return done(new Error('No email provided by Google'), null);
          }

          console.log('[AUTH] Google OAuth login attempt:', email);

          // First try to find user by OAuth provider + ID (prevents cross-provider takeover)
          let user = await getOne(
            'SELECT id, email, role, coins, balance, oauth_provider, oauth_id FROM users WHERE oauth_provider = ? AND oauth_id = ?',
            ['google', profile.id]
          );

          // If not found by OAuth ID, look up by email only if account has no OAuth provider
          if (!user) {
            user = await getOne(
              'SELECT id, email, role, coins, balance, oauth_provider, oauth_id FROM users WHERE email = ? AND (oauth_provider IS NULL OR oauth_provider = \'\')',
              [email]
            );
          }

          if (user) {
            console.log('[AUTH] Existing user found:', { id: user.id, email: user.email, role: user.role });
            // Update OAuth info if not set
            if (!user.oauth_provider || !user.oauth_id) {
              await runSync(
                'UPDATE users SET oauth_provider = ?, oauth_id = ? WHERE id = ?',
                ['google', profile.id, user.id]
              );
            }
          } else {
            // Create new user
            const username = email.split('@')[0].replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20) || `user${Date.now()}`;
            const pteroPassword = randomBytes(24).toString('base64url');
            
            let pteroId = null;
            try {
              // Check if pterodactyl user already exists
              pteroId = await pterodactyl.getUserByEmail(email);
              
              // If not, create new pterodactyl user
              if (!pteroId) {
                pteroId = await pterodactyl.createUser({
                  email,
                  username,
                  firstName: profile.name?.givenName || username,
                  lastName: profile.name?.familyName || 'User',
                  password: pteroPassword,
                });
              }
            } catch (pteroErr) {
              // Non-fatal: allow login with null ptero ID — will be provisioned lazily at server purchase
              console.warn('[AUTH] Pterodactyl user creation failed (non-fatal):', pteroErr.message);
            }

            console.log('[AUTH] Creating new user in database:', { email, oauth_provider: 'google', pteroId });
            
            const info = await runSync(
              'INSERT INTO users (email, oauth_provider, oauth_id, pterodactyl_user_id, ip_address, email_verified) VALUES (?, ?, ?, ?, ?, ?)',
              [email, 'google', profile.id, pteroId, req.ip || '0.0.0.0', 1]
            );

            console.log('[AUTH] User created with ID:', info.lastID);

            user = await getOne(
              'SELECT id, email, role, coins, balance, oauth_provider, oauth_id FROM users WHERE id = ?',
              [info.lastID]
            );
            
            if (!user) {
              console.error('[AUTH] Failed to retrieve newly created user!');
              return done(new Error('User creation failed'), null);
            }
            
            console.log('[AUTH] New user retrieved:', { id: user.id, email: user.email, role: user.role });
          }

          return done(null, user);
        } catch (error) {
          console.error('[AUTH] Google OAuth error:', error);
          return done(error, null);
        }
      }
    )
  );
}

// Discord OAuth Strategy
if (env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET) {
  passport.use(
    new DiscordStrategy(
      {
        clientID: env.DISCORD_CLIENT_ID,
        clientSecret: env.DISCORD_CLIENT_SECRET,
        callbackURL: `${env.OAUTH_CALLBACK_URL}/api/auth/discord/callback`,
        scope: ['identify', 'email'],
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.email?.toLowerCase();
          if (!email) {
            console.error('[AUTH] Discord OAuth: No email provided');
            return done(new Error('No email provided by Discord'), null);
          }

          console.log('[AUTH] Discord OAuth login attempt:', email);

          // First try to find user by OAuth provider + ID (prevents cross-provider takeover)
          let user = await getOne(
            'SELECT id, email, role, coins, balance, oauth_provider, oauth_id FROM users WHERE oauth_provider = ? AND oauth_id = ?',
            ['discord', profile.id]
          );

          // If not found by OAuth ID, look up by email only if account has no OAuth provider
          if (!user) {
            user = await getOne(
              'SELECT id, email, role, coins, balance, oauth_provider, oauth_id FROM users WHERE email = ? AND (oauth_provider IS NULL OR oauth_provider = \'\')',
              [email]
            );
          }

          if (user) {
            console.log('[AUTH] Existing user found:', { id: user.id, email: user.email, role: user.role });
            // Update OAuth info if not set
            if (!user.oauth_provider || !user.oauth_id) {
              await runSync(
                'UPDATE users SET oauth_provider = ?, oauth_id = ? WHERE id = ?',
                ['discord', profile.id, user.id]
              );
            }
          } else {
            // Create new user
            const username = (profile.username || email.split('@')[0]).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20) || `user${Date.now()}`;
            const pteroPassword = randomBytes(24).toString('base64url');
            
            let pteroId = null;
            try {
              // Check if pterodactyl user already exists
              pteroId = await pterodactyl.getUserByEmail(email);
              
              // If not, create new pterodactyl user
              if (!pteroId) {
                pteroId = await pterodactyl.createUser({
                  email,
                  username,
                  firstName: profile.username || username,
                  lastName: 'User',
                  password: pteroPassword,
                });
              }
            } catch (pteroErr) {
              // Non-fatal: allow login with null ptero ID — will be provisioned lazily at server purchase
              console.warn('[AUTH] Pterodactyl user creation failed (non-fatal):', pteroErr.message);
            }

            console.log('[AUTH] Creating new user in database:', { email, oauth_provider: 'discord', pteroId });

            const info = await runSync(
              'INSERT INTO users (email, oauth_provider, oauth_id, pterodactyl_user_id, ip_address, email_verified) VALUES (?, ?, ?, ?, ?, ?)',
              [email, 'discord', profile.id, pteroId, req.ip || '0.0.0.0', 1]
            );

            console.log('[AUTH] User created with ID:', info.lastID);

            user = await getOne(
              'SELECT id, email, role, coins, balance, oauth_provider, oauth_id FROM users WHERE id = ?',
              [info.lastID]
            );
            
            if (!user) {
              console.error('[AUTH] Failed to retrieve newly created user!');
              return done(new Error('User creation failed'), null);
            }
            
            console.log('[AUTH] New user retrieved:', { id: user.id, email: user.email, role: user.role });
          }

          return done(null, user);
        } catch (error) {
          console.error('[AUTH] Discord OAuth error:', error);
          return done(error, null);
        }
      }
    )
  );
}

export default passport;
