import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly enabled: boolean;

  constructor(
    private config: ConfigService,
    private authService: AuthService,
  ) {
    const clientID = config.get<string>('app.oauth.google.clientId');
    const clientSecret = config.get<string>('app.oauth.google.clientSecret');
    const enabled = !!(clientID && clientSecret);

    super({
      clientID: clientID || 'not-configured',
      clientSecret: clientSecret || 'not-configured',
      callbackURL: `${config.get('app.oauth.callbackUrl') || 'http://localhost:4000'}/api/auth/google/callback`,
      scope: ['profile', 'email'],
      passReqToCallback: true,
    });

    this.enabled = enabled;
    if (!enabled) console.warn('[Auth] Google OAuth is not configured — strategy disabled');
  }

  async validate(req: any, _at: string, _rt: string, profile: Profile, done: Function) {
    if (!this.enabled) return done(new Error('Google OAuth is not configured'), null);
    try {
      const email = profile.emails?.[0]?.value?.toLowerCase();
      if (!email) return done(new Error('No email provided by Google'), null);

      const user = await this.authService.findOrCreateOAuthUser({
        email,
        oauthProvider: 'google',
        oauthId: profile.id,
        firstName: profile.name?.givenName,
        lastName: profile.name?.familyName,
        ipAddress: req.ip || '0.0.0.0',
      });

      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }
}
