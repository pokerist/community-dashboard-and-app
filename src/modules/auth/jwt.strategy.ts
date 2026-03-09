import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { PermissionCacheService } from './permission-cache.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    private permissionCache: PermissionCacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET || 'defaultSecretKey',
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { role: true } } },
    });

    if (!user) throw new UnauthorizedException('User not found');

    // Validate session version — if it doesn't match, the session was
    // revoked via a session takeover on another device.
    if (
      payload.sv !== undefined &&
      payload.sv !== (user.sessionVersion ?? 0)
    ) {
      throw new UnauthorizedException(
        'Session invalidated. Your account was signed in from another device.',
      );
    }

    const roleNames = user.roles.map((ur) => ur.role.name);
    const permissions = this.permissionCache.resolveUserPermissions(roleNames);
    const modules = this.permissionCache.resolveUserModules(roleNames);

    return {
      id: user.id,
      email: user.email,
      roles: roleNames,
      permissions: Array.from(permissions),
      modules: Array.from(modules),
    };
  }
}
