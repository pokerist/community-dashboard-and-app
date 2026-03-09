import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IntegrationConfigService } from './integration-config.service';
import { SystemSettingsService } from './system-settings.service';

@ApiTags('mobile')
@Controller('mobile')
export class MobileAppConfigController {
  constructor(
    private readonly authService: AuthService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly integrationConfigService: IntegrationConfigService,
  ) {}

  @Get('app-config')
  @ApiOperation({ summary: 'Get public mobile app branding/config' })
  async getMobileAppConfig(@Req() req: Request) {
    const protoHeader = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
    const protocol = protoHeader || req.protocol || 'http';
    const host = req.get('host') || '';
    const baseUrl = host ? `${protocol}://${host}` : undefined;
    const [config, capabilities] = await Promise.all([
      this.systemSettingsService.getMobileAppConfig(baseUrl),
      this.integrationConfigService.getMobileCapabilities(),
    ]);
    return {
      ...config,
      capabilities,
    };
  }

  @Get('screen-manifest')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get persona-aware mobile screen visibility and actions manifest for the authenticated user',
  })
  async getMobileScreenManifest(@Req() req: Request & { user?: { id?: string } }) {
    const userId = req.user?.id;
    if (!userId) {
      return {
        data: {
          resolvedPersona: 'RESIDENT',
          screens: [],
        },
        meta: {
          version: 1,
          generatedAt: new Date().toISOString(),
        },
      };
    }

    const bootstrap = (await this.authService.getCurrentUserBootstrap(
      userId,
    )) as any;
    const protoHeader = String(req.headers['x-forwarded-proto'] ?? '')
      .split(',')[0]
      .trim();
    const protocol = protoHeader || req.protocol || 'http';
    const host = req.get('host') || '';
    const baseUrl = host ? `${protocol}://${host}` : undefined;
    const mobileConfig = await this.systemSettingsService.getMobileAppConfig(
      baseUrl,
    );

    const featureAvailability = bootstrap?.featureAvailability ?? {};
    const resolvedPersona =
      String(bootstrap?.personaHints?.resolvedPersona ?? 'RESIDENT') ||
      'RESIDENT';

    const permissions: string[] = Array.isArray(bootstrap?.permissions)
      ? bootstrap.permissions.filter(
          (value: unknown): value is string => typeof value === 'string',
        )
      : [];
    const permissionSet = new Set(permissions);

    const screens = [
      {
        key: 'home',
        visible: true,
        enabledActions: ['view_dashboard', 'view_quick_actions'],
        requiredPermissions: [],
        personaGuards: ['OWNER', 'TENANT', 'FAMILY', 'AUTHORIZED', 'CONTRACTOR', 'PRE_DELIVERY_OWNER', 'RESIDENT'],
        featureFlagSource: 'always_on',
      },
      {
        key: 'notifications',
        visible: true,
        enabledActions: ['list_notifications', 'mark_read'],
        requiredPermissions: ['notification.view_own'],
        personaGuards: ['OWNER', 'TENANT', 'FAMILY', 'AUTHORIZED', 'CONTRACTOR', 'PRE_DELIVERY_OWNER', 'RESIDENT'],
        featureFlagSource: 'always_on',
      },
      {
        key: 'community_updates',
        visible: true,
        enabledActions: ['list_community_updates'],
        requiredPermissions: ['notification.view_own'],
        personaGuards: ['OWNER', 'TENANT', 'FAMILY', 'AUTHORIZED', 'CONTRACTOR', 'PRE_DELIVERY_OWNER', 'RESIDENT'],
        featureFlagSource: 'always_on',
      },
      {
        key: 'services',
        visible: Boolean(featureAvailability.canUseServices),
        enabledActions: featureAvailability.canUseServices
          ? ['list_services', 'create_service_request', 'list_my_requests']
          : [],
        requiredPermissions: ['service.read', 'service_request.create'],
        personaGuards: ['OWNER', 'TENANT', 'FAMILY', 'AUTHORIZED', 'RESIDENT'],
        featureFlagSource: 'auth.me.featureAvailability.canUseServices',
      },
      {
        key: 'requests',
        visible: Boolean(featureAvailability.canUseRequests),
        enabledActions: featureAvailability.canUseRequests
          ? ['list_my_requests', 'view_request_detail', 'submit_request_comment']
          : [],
        requiredPermissions: ['service_request.view_own', 'service_request.create'],
        personaGuards: ['OWNER', 'TENANT', 'FAMILY', 'AUTHORIZED', 'RESIDENT'],
        featureFlagSource: 'auth.me.featureAvailability.canUseRequests',
      },
      {
        key: 'bookings',
        visible: Boolean(featureAvailability.canUseBookings),
        enabledActions: featureAvailability.canUseBookings
          ? ['list_facilities', 'create_booking', 'cancel_booking']
          : [],
        requiredPermissions: ['booking.view_own', 'booking.create'],
        personaGuards: ['OWNER', 'TENANT', 'FAMILY', 'AUTHORIZED', 'RESIDENT'],
        featureFlagSource: 'auth.me.featureAvailability.canUseBookings',
      },
      {
        key: 'complaints',
        visible: Boolean(featureAvailability.canUseComplaints),
        enabledActions: featureAvailability.canUseComplaints
          ? ['create_complaint', 'list_my_complaints', 'view_complaint_detail']
          : [],
        requiredPermissions: ['complaint.report', 'complaint.view_own'],
        personaGuards: ['OWNER', 'TENANT', 'FAMILY', 'AUTHORIZED', 'PRE_DELIVERY_OWNER', 'RESIDENT'],
        featureFlagSource: 'auth.me.featureAvailability.canUseComplaints',
      },
      {
        key: 'violations',
        visible: Boolean(featureAvailability.canUseComplaints),
        enabledActions: featureAvailability.canUseComplaints
          ? ['list_my_violations', 'view_violation_detail', 'submit_violation_action']
          : [],
        requiredPermissions: ['violation.view_own'],
        personaGuards: ['OWNER', 'TENANT', 'FAMILY', 'AUTHORIZED', 'PRE_DELIVERY_OWNER', 'RESIDENT'],
        featureFlagSource: 'auth.me.featureAvailability.canUseComplaints',
      },
      {
        key: 'finance',
        visible: Boolean(featureAvailability.canViewFinance),
        enabledActions: featureAvailability.canViewFinance
          ? ['list_my_invoices', 'view_invoice_detail', 'simulate_payment']
          : [],
        requiredPermissions: ['invoice.view_own'],
        personaGuards: ['OWNER', 'TENANT', 'PRE_DELIVERY_OWNER', 'RESIDENT'],
        featureFlagSource: 'auth.me.featureAvailability.canViewFinance',
      },
      {
        key: 'qr_access',
        visible:
          Boolean(featureAvailability.canUseQr) &&
          permissionSet.has('qr.generate'),
        enabledActions:
          Boolean(featureAvailability.canUseQr) &&
          permissionSet.has('qr.generate')
            ? ['generate_qr', 'list_qr_codes', 'revoke_qr']
            : [],
        requiredPermissions: ['qr.generate'],
        personaGuards: ['OWNER', 'TENANT', 'AUTHORIZED', 'CONTRACTOR', 'RESIDENT'],
        featureFlagSource: 'auth.me.featureAvailability.canUseQr',
      },
      {
        key: 'household',
        visible: Boolean(featureAvailability.canManageHousehold),
        enabledActions: featureAvailability.canManageHousehold
          ? ['view_household', 'create_household_request', 'manage_delegate']
          : [],
        requiredPermissions: ['owner.manage_family'],
        personaGuards: ['OWNER', 'TENANT', 'AUTHORIZED', 'CONTRACTOR'],
        featureFlagSource: 'auth.me.featureAvailability.canManageHousehold',
      },
      {
        key: 'discover',
        visible: Boolean(featureAvailability.canUseDiscover),
        enabledActions: featureAvailability.canUseDiscover
          ? ['list_discover_places']
          : [],
        requiredPermissions: [],
        personaGuards: ['OWNER', 'TENANT', 'FAMILY', 'AUTHORIZED', 'PRE_DELIVERY_OWNER', 'RESIDENT'],
        featureFlagSource: 'auth.me.featureAvailability.canUseDiscover',
      },
      {
        key: 'help_center',
        visible: Boolean(featureAvailability.canUseHelpCenter),
        enabledActions: featureAvailability.canUseHelpCenter
          ? ['list_help_center_entries']
          : [],
        requiredPermissions: [],
        personaGuards: ['OWNER', 'TENANT', 'FAMILY', 'AUTHORIZED', 'CONTRACTOR', 'PRE_DELIVERY_OWNER', 'RESIDENT'],
        featureFlagSource: 'auth.me.featureAvailability.canUseHelpCenter',
      },
      {
        key: 'utilities',
        visible: Boolean(featureAvailability.canUseUtilities),
        enabledActions: featureAvailability.canUseUtilities
          ? ['view_utility_tracker']
          : [],
        requiredPermissions: [],
        personaGuards: ['OWNER', 'TENANT', 'PRE_DELIVERY_OWNER', 'RESIDENT'],
        featureFlagSource: 'auth.me.featureAvailability.canUseUtilities',
      },
    ];

    return {
      data: {
        resolvedPersona,
        screens,
      },
      meta: {
        version: 1,
        generatedAt: new Date().toISOString(),
        mobileAccessUpdatedAt: mobileConfig?.meta?.mobileAccessUpdatedAt ?? null,
      },
    };
  }
}
