import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceType,
  Prisma,
  ReportFormat,
  ReportJobStatus,
  ReportType,
  UnitStatus,
} from '@prisma/client';
import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateReportScheduleDto,
  GenerateReportDto,
  ListReportsHistoryDto,
  ListReportSchedulesDto,
  ToggleReportScheduleDto,
} from './dto/reports.dto';

type ReportRow = Record<string, unknown>;

type DateRange = {
  from?: Date;
  to?: Date;
};

type ScheduleParams = {
  dateFrom?: string;
  dateTo?: string;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeRange(dateFrom?: string, dateTo?: string): DateRange {
    const range: DateRange = {};
    if (dateFrom) {
      const from = new Date(dateFrom);
      if (Number.isNaN(from.getTime())) {
        throw new BadRequestException('dateFrom must be a valid ISO date');
      }
      range.from = from;
    }
    if (dateTo) {
      const to = new Date(dateTo);
      if (Number.isNaN(to.getTime())) {
        throw new BadRequestException('dateTo must be a valid ISO date');
      }
      range.to = to;
    }
    if (range.from && range.to && range.from > range.to) {
      throw new BadRequestException('dateFrom must be before or equal to dateTo');
    }
    return range;
  }

  private inRange(value: Date | null | undefined, range: DateRange): boolean {
    if (!value) return false;
    const time = value.getTime();
    if (range.from && time < range.from.getTime()) return false;
    if (range.to && time > range.to.getTime()) return false;
    return true;
  }

  private toCsv(rows: ReportRow[]) {
    if (rows.length === 0) return 'message\nNo rows';
    const headers = Array.from(
      new Set(rows.flatMap((row) => Object.keys(row))),
    );
    const escapeCell = (value: unknown) => {
      const raw =
        value === null || value === undefined
          ? ''
          : typeof value === 'object'
            ? JSON.stringify(value)
            : String(value);
      if (/[",\n]/.test(raw)) {
        return `"${raw.replace(/"/g, '""')}"`;
      }
      return raw;
    };
    const lines = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((h) => escapeCell((row as any)[h])).join(','),
      ),
    ];
    return lines.join('\n');
  }

  private toXlsx(rows: ReportRow[]) {
    const normalized = rows.length > 0 ? rows : [{ message: 'No rows' }];
    const worksheet = XLSX.utils.json_to_sheet(normalized);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  private sanitizePdfText(value: string) {
    return value.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?');
  }

  private wrapPdfLine(text: string, maxChars = 95): string[] {
    const raw = this.sanitizePdfText(text);
    if (raw.length <= maxChars) return [raw];
    const words = raw.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else if (candidate.length > maxChars) {
        for (let i = 0; i < word.length; i += maxChars) {
          lines.push(word.slice(i, i + maxChars));
        }
        current = '';
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [''];
  }

  private async toPdf(rows: ReportRow[], title: string, filename: string) {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 40;
    const lineHeight = 14;
    let page = pdf.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const ensureSpace = (neededLines = 1) => {
      if (y - neededLines * lineHeight < margin) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
    };

    const drawLine = (
      text: string,
      opts?: { bold?: boolean; size?: number },
    ) => {
      const size = opts?.size ?? 10;
      const fontRef = opts?.bold ? bold : font;
      ensureSpace(1);
      page.drawText(this.sanitizePdfText(text), {
        x: margin,
        y,
        size,
        font: fontRef,
      });
      y -= lineHeight;
    };

    drawLine(title, { bold: true, size: 13 });
    drawLine(`File: ${filename}`);
    drawLine(`Generated: ${new Date().toISOString()}`);
    drawLine(`Rows: ${rows.length}`);
    y -= 4;

    const previewRows = rows.slice(0, 250);
    if (previewRows.length === 0) {
      drawLine('No rows');
    } else {
      const headers = Array.from(
        new Set(previewRows.flatMap((row) => Object.keys(row))),
      );
      drawLine(`Columns: ${headers.join(', ')}`, { bold: true });
      y -= 2;
      previewRows.forEach((row, index) => {
        const serialized = JSON.stringify(row);
        const chunks = this.wrapPdfLine(`${index + 1}. ${serialized}`, 95);
        chunks.forEach((chunk) => drawLine(chunk));
        y -= 2;
      });
      if (rows.length > previewRows.length) {
        drawLine(
          `Truncated preview: showing ${previewRows.length} of ${rows.length} rows`,
          { bold: true },
        );
      }
    }

    return Buffer.from(await pdf.save());
  }

  private fileName(reportType: ReportType, format: ReportFormat, at: Date) {
    const stamp = at.toISOString().replace(/[:.]/g, '-');
    return `${reportType.toLowerCase()}-${stamp}.${format.toLowerCase()}`;
  }

  private humanLabel(reportType: ReportType) {
    return reportType
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private readScheduleParams(params: unknown): ScheduleParams {
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      return {};
    }
    const data = params as Record<string, unknown>;
    return {
      dateFrom:
        typeof data.dateFrom === 'string' && data.dateFrom.trim()
          ? data.dateFrom
          : undefined,
      dateTo:
        typeof data.dateTo === 'string' && data.dateTo.trim()
          ? data.dateTo
          : undefined,
    };
  }

  private computeNextRunAt(
    frequency: string,
    fromDate: Date,
  ): Date | null {
    const normalized = String(frequency || '').trim().toUpperCase();
    const next = new Date(fromDate);
    if (normalized === 'DAILY') {
      next.setDate(next.getDate() + 1);
      return next;
    }
    if (normalized === 'WEEKLY') {
      next.setDate(next.getDate() + 7);
      return next;
    }
    if (normalized === 'MONTHLY') {
      next.setMonth(next.getMonth() + 1);
      return next;
    }
    return null;
  }

  private normalizeScheduleFrequency(frequency: string): 'DAILY' | 'WEEKLY' | 'MONTHLY' {
    const normalized = String(frequency || '').trim().toUpperCase();
    if (
      normalized === 'DAILY' ||
      normalized === 'WEEKLY' ||
      normalized === 'MONTHLY'
    ) {
      return normalized;
    }
    throw new BadRequestException(
      'frequency must be one of: DAILY, WEEKLY, MONTHLY',
    );
  }

  private async buildOccupancyRows(): Promise<ReportRow[]> {
    const units = await this.prisma.unit.findMany({
      select: {
        projectName: true,
        block: true,
        status: true,
      },
    });
    const grouped = new Map<
      string,
      { projectName: string; block: string; totalUnits: number; occupiedUnits: number }
    >();
    for (const unit of units) {
      const key = `${unit.projectName}::${unit.block ?? ''}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          projectName: unit.projectName ?? '',
          block: unit.block ?? '',
          totalUnits: 0,
          occupiedUnits: 0,
        });
      }
      const entry = grouped.get(key)!;
      entry.totalUnits += 1;
      if (
        unit.status === UnitStatus.OCCUPIED ||
        unit.status === UnitStatus.LEASED
      ) {
        entry.occupiedUnits += 1;
      }
    }
    return Array.from(grouped.values()).map((g) => ({
      projectName: g.projectName,
      block: g.block,
      totalUnits: g.totalUnits,
      occupiedUnits: g.occupiedUnits,
      vacantUnits: Math.max(g.totalUnits - g.occupiedUnits, 0),
      occupancyRate:
        g.totalUnits > 0
          ? Number(((g.occupiedUnits / g.totalUnits) * 100).toFixed(2))
          : 0,
    }));
  }

  private async buildFinancialRows(range: DateRange): Promise<ReportRow[]> {
    const invoices = await this.prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      take: 2000,
      select: {
        id: true,
        invoiceNumber: true,
        type: true,
        status: true,
        amount: true,
        dueDate: true,
        paidDate: true,
        createdAt: true,
        unitId: true,
        residentId: true,
      },
    });
    return invoices
      .filter((i) =>
        !range.from && !range.to
          ? true
          : this.inRange(i.paidDate ?? i.dueDate ?? i.createdAt, range),
      )
      .map((i) => ({
        invoiceNumber: i.invoiceNumber ?? i.id,
        type: i.type,
        status: i.status,
        amount: Number(i.amount ?? 0),
        dueDate: i.dueDate?.toISOString?.() ?? null,
        paidDate: i.paidDate?.toISOString?.() ?? null,
        createdAt: i.createdAt?.toISOString?.() ?? null,
        unitId: i.unitId,
        residentId: i.residentId,
      }));
  }

  private async buildServiceRequestRows(range: DateRange): Promise<ReportRow[]> {
    const requests = await this.prisma.serviceRequest.findMany({
      orderBy: { requestedAt: 'desc' },
      take: 2000,
      select: {
        id: true,
        status: true,
        priority: true,
        requestedAt: true,
        unitId: true,
        createdById: true,
        service: { select: { name: true, category: true } },
      },
    });
    return requests
      .filter((r) =>
        !range.from && !range.to ? true : this.inRange(r.requestedAt, range),
      )
      .map((r) => ({
        id: r.id,
        serviceName: r.service?.name ?? '',
        category: r.service?.category ?? '',
        status: r.status,
        priority: r.priority,
        createdAt: r.requestedAt?.toISOString?.() ?? null,
        unitId: r.unitId,
        requesterId: r.createdById,
      }));
  }

  private async buildSecurityIncidentRows(range: DateRange): Promise<ReportRow[]> {
    const incidents = await this.prisma.incident.findMany({
      orderBy: { createdAt: 'desc' },
      take: 2000,
      select: {
        id: true,
        incidentNumber: true,
        type: true,
        status: true,
        priority: true,
        reportedAt: true,
        createdAt: true,
        location: true,
      },
    });
    return incidents
      .filter((i) =>
        !range.from && !range.to
          ? true
          : this.inRange(i.reportedAt ?? i.createdAt, range),
      )
      .map((i) => ({
        incidentNumber: i.incidentNumber ?? i.id,
        type: i.type,
        status: i.status,
        severity: i.priority,
        reportedAt: (i.reportedAt ?? i.createdAt)?.toISOString?.() ?? null,
        location: i.location,
      }));
  }

  private async buildVisitorTrafficRows(range: DateRange): Promise<ReportRow[]> {
    const qrs = await this.prisma.accessQRCode.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3000,
      select: {
        id: true,
        qrId: true,
        type: true,
        status: true,
        validFrom: true,
        validTo: true,
        createdAt: true,
        unitId: true,
        scans: true,
      },
    });
    return qrs
      .filter((q) => (!range.from && !range.to ? true : this.inRange(q.createdAt, range)))
      .map((q) => ({
        id: q.id,
        qrId: q.qrId,
        type: q.type,
        status: q.status,
        validFrom: q.validFrom?.toISOString?.() ?? null,
        validTo: q.validTo?.toISOString?.() ?? null,
        createdAt: q.createdAt?.toISOString?.() ?? null,
        unitId: q.unitId,
        scans: q.scans,
      }));
  }

  private async buildMaintenanceCostRows(range: DateRange): Promise<ReportRow[]> {
    const invoices = await this.prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      take: 2000,
      where: {
        OR: [
          { type: InvoiceType.MAINTENANCE_FEE },
          { type: InvoiceType.SERVICE_FEE },
        ],
      },
      select: {
        id: true,
        invoiceNumber: true,
        type: true,
        amount: true,
        status: true,
        dueDate: true,
        paidDate: true,
        createdAt: true,
        serviceRequestId: true,
      },
    });
    return invoices
      .filter((i) =>
        !range.from && !range.to
          ? true
          : this.inRange(i.paidDate ?? i.dueDate ?? i.createdAt, range),
      )
      .map((i) => ({
        invoiceNumber: i.invoiceNumber ?? i.id,
        type: i.type,
        amount: Number(i.amount ?? 0),
        status: i.status,
        dueDate: i.dueDate?.toISOString?.() ?? null,
        paidDate: i.paidDate?.toISOString?.() ?? null,
        linkedServiceRequestId: i.serviceRequestId,
      }));
  }

  private async buildComplaintsRows(range: DateRange): Promise<ReportRow[]> {
    const complaints = await this.prisma.complaint.findMany({
      where: {
        createdAt: {
          gte: range.from,
          lte: range.to,
        },
      },
      include: {
        unit: { select: { unitNumber: true } },
        resident: { select: { user: { select: { nameEN: true } } } },
        assignee: { select: { nameEN: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    return complaints.map((c) => ({
      complaintNumber: (c as any).complaintNumber || c.id,
      category: (c as any).category,
      unit: c.unit?.unitNumber,
      reporter: c.resident?.user?.nameEN,
      assignee: c.assignee?.nameEN,
      priority: (c as any).priority,
      status: (c as any).status,
      slaStatus: (c as any).slaStatus,
      createdAt: c.createdAt.toISOString(),
      resolvedAt: (c as any).resolvedAt?.toISOString?.() ?? null,
      description: (c as any).description,
    }));
  }

  private async buildViolationsRows(range: DateRange): Promise<ReportRow[]> {
    const violations = await this.prisma.violation.findMany({
      where: {
        createdAt: {
          gte: range.from,
          lte: range.to,
        },
      },
      include: {
        unit: { select: { unitNumber: true } },
        resident: { select: { user: { select: { nameEN: true } } } },
        issuedBy: { select: { nameEN: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    return violations.map((v) => ({
      violationNumber: (v as any).violationNumber || v.id,
      category: (v as any).category,
      unit: v.unit?.unitNumber,
      resident: v.resident?.user?.nameEN,
      issuer: v.issuedBy?.nameEN,
      fineAmount: (v as any).fineAmount,
      status: (v as any).status,
      appealStatus: (v as any).appealStatus,
      createdAt: v.createdAt.toISOString(),
      description: (v as any).description,
    }));
  }

  private async buildGateEntryLogRows(range: DateRange): Promise<ReportRow[]> {
    const entries = await this.prisma.accessQRCode.findMany({
      where: {
        lastUsedAt: {
          gte: range.from,
          lte: range.to,
        },
      },
      include: {
        unit: { select: { unitNumber: true } },
        gate: { select: { name: true } },
        createdBy: { select: { nameEN: true } },
      },
      orderBy: { lastUsedAt: 'desc' },
      take: 5000,
    });

    return entries.map((e) => ({
      date: e.lastUsedAt?.toLocaleDateString?.('en-US'),
      time: e.lastUsedAt?.toLocaleTimeString?.('en-US'),
      visitor: e.createdBy?.nameEN,
      unit: e.unit?.unitNumber,
      qrType: e.qrType,
      gate: e.gate?.name,
      checkIn: e.lastUsedAt?.toISOString?.(),
      checkOut: null,
      duration: null,
      operator: e.createdBy?.nameEN,
    }));
  }

  private async buildResidentActivityRows(_range: DateRange): Promise<ReportRow[]> {
    const residents = await this.prisma.resident.findMany({
      include: {
        user: { select: { nameEN: true, email: true, lastLoginAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    return residents.map((r) => ({
      residentName: r.user?.nameEN,
      email: r.user?.email,
      complaintsCount: 0,
      serviceRequestsCount: 0,
      violationsCount: 0,
      bookingsCount: 0,
      lastLogin: r.user?.lastLoginAt?.toISOString?.() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  private async buildRowsForReport(
    reportType: ReportType,
    range: DateRange,
  ): Promise<ReportRow[]> {
    switch (reportType) {
      case ReportType.OCCUPANCY:
        return this.buildOccupancyRows();
      case ReportType.FINANCIAL:
        return this.buildFinancialRows(range);
      case ReportType.SERVICE_REQUESTS:
        return this.buildServiceRequestRows(range);
      case ReportType.SECURITY_INCIDENTS:
        return this.buildSecurityIncidentRows(range);
      case ReportType.VISITOR_TRAFFIC:
        return this.buildVisitorTrafficRows(range);
      case ReportType.MAINTENANCE_COSTS:
        return this.buildMaintenanceCostRows(range);
      case ReportType.COMPLAINTS:
        return this.buildComplaintsRows(range);
      case ReportType.VIOLATIONS:
        return this.buildViolationsRows(range);
      case ReportType.GATE_ENTRY_LOG:
        return this.buildGateEntryLogRows(range);
      case ReportType.RESIDENT_ACTIVITY:
        return this.buildResidentActivityRows(range);
      default:
        return [];
    }
  }

  async generateReport(dto: GenerateReportDto, actorUserId?: string | null) {
    const format = dto.format ?? ReportFormat.CSV;
    const generatedAt = new Date();
    const range = this.normalizeRange(dto.dateFrom, dto.dateTo);
    const rows = await this.buildRowsForReport(dto.reportType, range);
    const label = dto.label?.trim() || this.humanLabel(dto.reportType);
    const filename = this.fileName(dto.reportType, format, generatedAt);

    const created = await this.prisma.generatedReport.create({
      data: {
        reportType: dto.reportType,
        format,
        label,
        filename,
        params: {
          dateFrom: dto.dateFrom ?? null,
          dateTo: dto.dateTo ?? null,
        } as Prisma.InputJsonValue,
        summary: {
          rowCount: rows.length,
        } as Prisma.InputJsonValue,
        rows: rows as Prisma.InputJsonValue,
        rowCount: rows.length,
        createdById: actorUserId ?? null,
      },
    });

    return {
      id: created.id,
      reportType: created.reportType,
      format: created.format,
      label: created.label,
      filename: created.filename,
      rowCount: created.rowCount,
      generatedAt: created.generatedAt,
      preview: rows.slice(0, 20),
    };
  }

  async getHistory(query: ListReportsHistoryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const [rows, total] = await Promise.all([
      this.prisma.generatedReport.findMany({
        orderBy: { generatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          reportType: true,
          format: true,
          label: true,
          filename: true,
          rowCount: true,
          generatedAt: true,
          createdById: true,
        },
      }),
      this.prisma.generatedReport.count(),
    ]);

    return {
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getReportForDownload(id: string) {
    const report = await this.prisma.generatedReport.findUnique({
      where: { id },
    });
    if (!report) throw new NotFoundException('Report not found');

    const rows = Array.isArray(report.rows) ? (report.rows as ReportRow[]) : [];
    if (report.format === ReportFormat.XLSX) {
      return {
        filename: report.filename,
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        content: this.toXlsx(rows),
      };
    }
    if (report.format === ReportFormat.PDF) {
      return {
        filename: report.filename,
        mimeType: 'application/pdf',
        content: await this.toPdf(rows, report.label, report.filename),
      };
    }
    if (report.format === ReportFormat.JSON) {
      return {
        filename: report.filename,
        mimeType: 'application/json; charset=utf-8',
        content: JSON.stringify(rows, null, 2),
      };
    }

    return {
      filename: report.filename,
      mimeType: 'text/csv; charset=utf-8',
      content: this.toCsv(rows),
    };
  }

  async createSchedule(dto: CreateReportScheduleDto, actorUserId?: string | null) {
    const format = dto.format ?? ReportFormat.CSV;
    const label = dto.label?.trim() || this.humanLabel(dto.reportType);
    const now = new Date();
    const frequency = this.normalizeScheduleFrequency(dto.frequency);
    if (dto.cronExpr?.trim()) {
      throw new BadRequestException(
        'cronExpr is not supported. Use DAILY, WEEKLY, or MONTHLY schedules.',
      );
    }
    const providedNextRunAt = dto.nextRunAt ? new Date(dto.nextRunAt) : null;
    if (providedNextRunAt && Number.isNaN(providedNextRunAt.getTime())) {
      throw new BadRequestException('nextRunAt must be a valid ISO date');
    }
    const fallbackNextRunAt =
      providedNextRunAt ?? this.computeNextRunAt(frequency, now);
    const created = await this.prisma.reportSchedule.create({
      data: {
        reportType: dto.reportType,
        format,
        label,
        frequency,
        cronExpr: null,
        nextRunAt: fallbackNextRunAt,
        recipientEmails: dto.recipientEmails ?? [],
        params: {
          dateFrom: dto.dateFrom ?? null,
          dateTo: dto.dateTo ?? null,
        } as Prisma.InputJsonValue,
        createdById: actorUserId ?? null,
      },
    });

    return created;
  }

  async listSchedules(query: ListReportSchedulesDto) {
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 200) : 50;
    const where: Prisma.ReportScheduleWhereInput = {};
    
    if (query.reportType) {
      where.reportType = query.reportType;
    }
    if (query.search) {
      where.label = { contains: query.search, mode: 'insensitive' as any };
    }

    const rows = await this.prisma.reportSchedule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return {
      data: rows,
      meta: { limit, count: rows.length },
    };
  }

  async toggleSchedule(id: string, dto: ToggleReportScheduleDto) {
    const existing = await this.prisma.reportSchedule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Report schedule not found');
    return this.prisma.reportSchedule.update({
      where: { id },
      data: {
        isEnabled: dto.isEnabled,
        status: dto.isEnabled ? ReportJobStatus.ACTIVE : ReportJobStatus.PAUSED,
      },
    });
  }

  private async executeSchedule(schedule: {
    id: string;
    reportType: ReportType;
    format: ReportFormat;
    label: string;
    frequency: string;
    cronExpr: string | null;
    params: Prisma.JsonValue | null;
    createdById: string | null;
  }) {
    const params = this.readScheduleParams(schedule.params);
    const generated = await this.generateReport(
      {
        reportType: schedule.reportType,
        format: schedule.format,
        label: schedule.label,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      },
      schedule.createdById ?? null,
    );

    const now = new Date();
    const nextRunAt = this.computeNextRunAt(schedule.frequency, now);
    const nextData: Prisma.ReportScheduleUpdateInput = {
      lastRunAt: now,
      nextRunAt,
    };

    if (!nextRunAt) {
      nextData.isEnabled = false;
      nextData.status = ReportJobStatus.PAUSED;
    }

    await this.prisma.reportSchedule.update({
      where: { id: schedule.id },
      data: nextData,
    });

    return generated;
  }

  async runScheduleNow(id: string) {
    const schedule = await this.prisma.reportSchedule.findUnique({
      where: { id },
      select: {
        id: true,
        reportType: true,
        format: true,
        label: true,
        frequency: true,
        cronExpr: true,
        params: true,
        createdById: true,
      },
    });
    if (!schedule) throw new NotFoundException('Report schedule not found');

    const generated = await this.executeSchedule(schedule);
    return {
      success: true,
      scheduleId: id,
      generatedReportId: generated.id,
      generatedAt: generated.generatedAt,
      rowCount: generated.rowCount,
    };
  }

  async processDueSchedules(limit = 20) {
    const now = new Date();
    const dueSchedules = await this.prisma.reportSchedule.findMany({
      where: {
        isEnabled: true,
        status: ReportJobStatus.ACTIVE,
        nextRunAt: { lte: now },
      },
      orderBy: { nextRunAt: 'asc' },
      take: limit,
      select: {
        id: true,
        reportType: true,
        format: true,
        label: true,
        frequency: true,
        cronExpr: true,
        params: true,
        createdById: true,
      },
    });

    const results: Array<{ scheduleId: string; ok: boolean; generatedReportId?: string; error?: string }> = [];

    for (const schedule of dueSchedules) {
      try {
        const generated = await this.executeSchedule(schedule);
        results.push({
          scheduleId: schedule.id,
          ok: true,
          generatedReportId: generated.id,
        });
      } catch (error) {
        results.push({
          scheduleId: schedule.id,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      checkedAt: now,
      dueCount: dueSchedules.length,
      processedCount: results.length,
      successCount: results.filter((r) => r.ok).length,
      failedCount: results.filter((r) => !r.ok).length,
      results,
    };
  }

  async getReportStats() {
    const [total, thisMonth, activeSchedules, lastGenerated] = await Promise.all([
      this.prisma.generatedReport.count(),
      this.prisma.generatedReport.count({
        where: {
          generatedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      this.prisma.reportSchedule.count({
        where: { isEnabled: true, status: ReportJobStatus.ACTIVE },
      }),
      this.prisma.generatedReport.findFirst({
        orderBy: { generatedAt: 'desc' },
        select: { generatedAt: true },
      }),
    ]);

    return {
      totalGenerated: total,
      generatedThisMonth: thisMonth,
      activeSchedules,
      lastGeneratedAt: lastGenerated?.generatedAt?.toISOString?.() ?? null,
    };
  }

  async listReports(query: ListReportsHistoryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 200) : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.GeneratedReportWhereInput = {};
    if (query.reportType) {
      where.reportType = query.reportType;
    }
    if (query.format) {
      where.format = query.format;
    }
    if (query.dateFrom) {
      where.generatedAt = { gte: new Date(query.dateFrom) };
    }
    if (query.dateTo) {
      if (where.generatedAt) {
        (where.generatedAt as any).lte = new Date(query.dateTo);
      } else {
        where.generatedAt = { lte: new Date(query.dateTo) };
      }
    }
    if (query.search) {
      where.label = { contains: query.search, mode: 'insensitive' as any };
    }

    const [data, total] = await Promise.all([
      this.prisma.generatedReport.findMany({
        where,
        select: {
          id: true,
          reportType: true,
          format: true,
          label: true,
          rowCount: true,
          generatedAt: true,
          filename: true,
        },
        orderBy: { generatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.generatedReport.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getReportDetail(id: string) {
    const report = await this.prisma.generatedReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');

    const rows = Array.isArray(report.rows) ? (report.rows as ReportRow[]) : [];
    const pageSize = 100;
    const totalPages = Math.ceil(rows.length / pageSize);

    return {
      id: report.id,
      reportType: report.reportType,
      format: report.format,
      label: report.label,
      filename: report.filename,
      rowCount: report.rowCount,
      generatedAt: report.generatedAt,
      summary: report.summary,
      page: 1,
      pageSize,
      totalPages,
      rows: rows.slice(0, pageSize),
    };
  }

  async updateSchedule(id: string, dto: any) {
    const existing = await this.prisma.reportSchedule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Report schedule not found');

    const frequency = dto.frequency
      ? this.normalizeScheduleFrequency(dto.frequency)
      : existing.frequency;

    return this.prisma.reportSchedule.update({
      where: { id },
      data: {
        label: dto.label,
        format: dto.format,
        frequency,
        params: dto.dateFrom || dto.dateTo ? {
          dateFrom: dto.dateFrom ?? null,
          dateTo: dto.dateTo ?? null,
        } as Prisma.InputJsonValue : undefined,
        recipientEmails: dto.recipientEmails ?? undefined,
      },
    });
  }

  async deleteSchedule(id: string) {
    const existing = await this.prisma.reportSchedule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Report schedule not found');

    return this.prisma.reportSchedule.delete({ where: { id } });
  }
}
