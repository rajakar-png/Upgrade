import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-discord';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy, 'discord') {
  private readonly enabled: boolean;

  constructor(
    private config: ConfigService,
    private authService: AuthService,
  ) {
    const clientID = config.get<string>('app.oauth.discord.clientId');
    const clientSecret = config.get<string>('app.oauth.discord.clientSecret');
    const enabled = !!(clientID && clientSecret);

    super({
      clientID: clientID || 'not-configured',
      clientSecret: clientSecret || 'not-configured',
      callbackURL: `${config.get('app.oauth.callbackUrl') || 'http://localhost:4000'}/api/auth/discord/callback`,
      scope: ['identify', 'email'],
      passReqToCallback: true,
    });

    this.enabled = enabled;
    if (!enabled) console.warn('[Auth] Discord OAuth is not configured — strategy disabled');
  }

  async validate(req: any, _at: string, _rt: string, profile: Profile, done: Function) {
    if (!this.enabled) return done(new Error('Discord OAuth is not configured'), null);
    try {
      const email = profile.email?.toLowerCase();
      if (!email) return done(new Error('No email provided by Discord'), null);

      const user = await this.authService.findOrCreateOAuthUser({
        email,
        oauthProvider: 'discord',
        oauthId: profile.id,
        firstName: profile.username,
        ipAddress: req.ip || '0.0.0.0',
      });

      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }
}
