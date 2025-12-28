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

  // jwt.strategy.ts
  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { role: true } } },
    });

    if (!user) throw new UnauthorizedException('User not found');

    const roleNames = user.roles.map((ur) => ur.role.name);
    const permissions = this.permissionCache.resolveUserPermissions(roleNames);

    return {
      id: user.id, // THIS MUST EXIST
      email: user.email,
      roles: roleNames,
      permissions: Array.from(permissions),
    };
  }
}
