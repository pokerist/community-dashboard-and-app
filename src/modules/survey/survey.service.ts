import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Audience,
  Channel,
  NotificationType,
  Prisma,
  SurveyFieldType,
  SurveyStatus,
  SurveyTarget,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateSurveyDto,
  CreateSurveyQuestionDto,
  SurveyTargetMetaDto,
  UpdateSurveyDto,
  UpdateSurveyQuestionDto,
} from './dto/create-survey.dto';
import { ListSurveysDto } from './dto/list-surveys.dto';
import {
  SurveyAnalyticsDto,
  SurveyDetailDto,
  SurveyListItemDto,
  SurveyListResponseDto,
  SurveyMultipleChoiceOptionAnalyticsDto,
  SurveyQuestionAnalyticsDto,
  SurveyQuestionDto,
  SurveyResponseSubmittedDto,
  SurveyStatsDto,
} from './dto/survey-response.dto';
import { SubmitResponseDto, SubmitSurveyAnswerDto } from './dto/submit-response.dto';

type SurveyTargetMeta = {
  communityIds?: string[];
  unitIds?: string[];
};

type SurveyQuestionOptions = {
  choices: string[];
};

type PreparedSurveyQuestion = {
  text: string;
  type: SurveyFieldType;
  options: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined;
  required: boolean;
  displayOrder: number;
};

type SurveyQuestionRecord = {
  id: string;
  text: string;
  type: SurveyFieldType;
  options: Prisma.JsonValue | null;
  required: boolean;
  displayOrder: number;
};

type SurveyAnswerWrite = {
  questionId: string;
  valueText?: string | null;
  valueNumber?: number | null;
  valueChoice?: string | null;
};

@Injectable()
export class SurveyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private toIso(value: Date | null): string | null {
    return value ? value.toISOString() : null;
  }

  private round(value: number): number {
    return Number(value.toFixed(2));
  }

  private normalizeIdArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const list = value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    return [...new Set(list)];
  }

  private parseTargetMeta(value: Prisma.JsonValue | null): SurveyTargetMeta | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const record = value as Record<string, unknown>;
    const communityIds = this.normalizeIdArray(record.communityIds);
    const unitIds = this.normalizeIdArray(record.unitIds);

    return {
      ...(communityIds.length > 0 ? { communityIds } : {}),
      ...(unitIds.length > 0 ? { unitIds } : {}),
    };
  }

  private parseQuestionOptions(value: Prisma.JsonValue | null): SurveyQuestionOptions {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { choices: [] };
    }

    const record = value as Record<string, unknown>;
    const choices = this.normalizeIdArray(record.choices);
    return { choices };
  }

  private toSurveyQuestionDto(question: SurveyQuestionRecord): SurveyQuestionDto {
    return {
      id: question.id,
      text: question.text,
      type: question.type,
      options:
        question.options && typeof question.options === 'object' && !Array.isArray(question.options)
          ? (question.options as Record<string, unknown>)
          : null,
      required: question.required,
      displayOrder: question.displayOrder,
    };
  }

  private toSurveyListItem(row: {
    id: string;
    title: string;
    status: SurveyStatus;
    targetType: SurveyTarget;
    publishedAt: Date | null;
    closedAt: Date | null;
    createdAt: Date;
    _count: {
      questions: number;
      responses: number;
    };
  }): SurveyListItemDto {
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      targetType: row.targetType,
      questionCount: row._count.questions,
      responseCount: row._count.responses,
      publishedAt: this.toIso(row.publishedAt),
      closedAt: this.toIso(row.closedAt),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async validateTargetMeta(
    targetType: SurveyTarget,
    targetMeta?: SurveyTargetMetaDto | null,
  ): Promise<Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput> {
    if (targetType === SurveyTarget.ALL) {
      return Prisma.JsonNull;
    }

    const communityIds = this.normalizeIdArray(targetMeta?.communityIds);
    const unitIds = this.normalizeIdArray(targetMeta?.unitIds);

    if (targetType === SurveyTarget.SPECIFIC_COMMUNITIES) {
      if (communityIds.length === 0) {
        throw new BadRequestException('targetMeta.communityIds is required for SPECIFIC_COMMUNITIES');
      }

      const existingCount = await this.prisma.community.count({
        where: { id: { in: communityIds } },
      });
      if (existingCount !== communityIds.length) {
        throw new BadRequestException('One or more communityIds are invalid');
      }

      return { communityIds } as Prisma.InputJsonValue;
    }

    if (unitIds.length === 0) {
      throw new BadRequestException('targetMeta.unitIds is required for SPECIFIC_UNITS');
    }

    const existingCount = await this.prisma.unit.count({
      where: { id: { in: unitIds } },
    });
    if (existingCount !== unitIds.length) {
      throw new BadRequestException('One or more unitIds are invalid');
    }

    return { unitIds } as Prisma.InputJsonValue;
  }

  private prepareSurveyQuestion(
    question: CreateSurveyQuestionDto | UpdateSurveyQuestionDto,
    fallbackOrder: number,
  ): PreparedSurveyQuestion {
    const text = question.text.trim();
    if (!text) {
      throw new BadRequestException('Question text cannot be empty');
    }

    if (question.type === SurveyFieldType.MULTIPLE_CHOICE) {
      const choices = question.options?.choices
        ?.map((choice) => choice.trim())
        .filter((choice) => choice.length > 0);

      const uniqueChoices = choices ? [...new Set(choices)] : [];
      if (uniqueChoices.length < 2) {
        throw new BadRequestException('MULTIPLE_CHOICE questions require at least 2 choices');
      }

      return {
        text,
        type: question.type,
        options: { choices: uniqueChoices } as Prisma.InputJsonValue,
        required: question.required ?? true,
        displayOrder: Number.isInteger(question.displayOrder)
          ? Number(question.displayOrder)
          : fallbackOrder,
      };
    }

    return {
      text,
      type: question.type,
      options: Prisma.JsonNull,
      required: question.required ?? true,
      displayOrder: Number.isInteger(question.displayOrder)
        ? Number(question.displayOrder)
        : fallbackOrder,
    };
  }

  private normalizeYesNo(value: string | undefined): 'YES' | 'NO' | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim().toUpperCase();
    if (normalized === 'YES' || normalized === 'TRUE' || normalized === '1') {
      return 'YES';
    }
    if (normalized === 'NO' || normalized === 'FALSE' || normalized === '0') {
      return 'NO';
    }
    return null;
  }

  private validateSurveyAnswer(
    question: SurveyQuestionRecord,
    answer: SubmitSurveyAnswerDto | undefined,
  ): SurveyAnswerWrite | null {
    if (!answer) {
      if (question.required) {
        throw new BadRequestException(`Required question is missing: ${question.id}`);
      }
      return null;
    }

    switch (question.type) {
      case SurveyFieldType.TEXT: {
        const text = answer.valueText?.trim();
        if (!text) {
          if (question.required) {
            throw new BadRequestException(`Required text answer is missing: ${question.id}`);
          }
          return null;
        }
        return { questionId: question.id, valueText: text };
      }
      case SurveyFieldType.MULTIPLE_CHOICE: {
        const choice = answer.valueChoice?.trim();
        const options = this.parseQuestionOptions(question.options);
        if (!choice) {
          throw new BadRequestException(`Choice answer is missing: ${question.id}`);
        }
        if (!options.choices.includes(choice)) {
          throw new BadRequestException(`Invalid choice for question: ${question.id}`);
        }
        return { questionId: question.id, valueChoice: choice };
      }
      case SurveyFieldType.RATING: {
        const valueNumber = answer.valueNumber;
        if (
          typeof valueNumber !== 'number' ||
          !Number.isInteger(valueNumber) ||
          valueNumber < 1 ||
          valueNumber > 5
        ) {
          throw new BadRequestException(`Rating answer must be between 1 and 5: ${question.id}`);
        }
        return { questionId: question.id, valueNumber };
      }
      case SurveyFieldType.YES_NO: {
        const normalized = this.normalizeYesNo(answer.valueText);
        if (!normalized) {
          throw new BadRequestException(`YES_NO answer must be YES or NO: ${question.id}`);
        }
        return { questionId: question.id, valueText: normalized };
      }
      default:
        throw new BadRequestException(`Unsupported question type for ${question.id}`);
    }
  }

  private async getTargetedUserIdsForUnitIds(unitIds: string[]): Promise<string[]> {
    if (unitIds.length === 0) {
      return [];
    }

    const [unitAccessRows, residentUnitRows] = await Promise.all([
      this.prisma.unitAccess.findMany({
        where: { unitId: { in: unitIds } },
        select: { userId: true },
      }),
      this.prisma.residentUnit.findMany({
        where: { unitId: { in: unitIds } },
        select: {
          resident: {
            select: {
              userId: true,
            },
          },
        },
      }),
    ]);

    const ids = new Set<string>();
    for (const row of unitAccessRows) {
      ids.add(row.userId);
    }
    for (const row of residentUnitRows) {
      ids.add(row.resident.userId);
    }

    return [...ids];
  }

  private async getAllTargetedUserIds(): Promise<string[]> {
    const [residentRows, unitAccessRows] = await Promise.all([
      this.prisma.resident.findMany({ select: { userId: true } }),
      this.prisma.unitAccess.findMany({
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    const ids = new Set<string>();
    for (const row of residentRows) {
      ids.add(row.userId);
    }
    for (const row of unitAccessRows) {
      ids.add(row.userId);
    }

    return [...ids];
  }

  private async getTargetedUserIdsByTarget(
    targetType: SurveyTarget,
    targetMeta: SurveyTargetMeta | null,
  ): Promise<string[]> {
    if (targetType === SurveyTarget.ALL) {
      return this.getAllTargetedUserIds();
    }

    if (targetType === SurveyTarget.SPECIFIC_COMMUNITIES) {
      const communityIds = targetMeta?.communityIds ?? [];
      if (communityIds.length === 0) {
        return [];
      }

      const units = await this.prisma.unit.findMany({
        where: { communityId: { in: communityIds } },
        select: { id: true },
      });

      return this.getTargetedUserIdsForUnitIds(units.map((unit) => unit.id));
    }

    return this.getTargetedUserIdsForUnitIds(targetMeta?.unitIds ?? []);
  }

  private async getSurveyOrThrow(id: string) {
    const survey = await this.prisma.survey.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { displayOrder: 'asc' },
        },
        _count: {
          select: { responses: true },
        },
      },
    });

    if (!survey) {
      throw new NotFoundException('Survey not found');
    }

    return survey;
  }

  async getSurveyStats(): Promise<SurveyStatsDto> {
    const [total, active, draft, closed, totalResponses, surveys] = await Promise.all([
      this.prisma.survey.count(),
      this.prisma.survey.count({ where: { status: SurveyStatus.ACTIVE } }),
      this.prisma.survey.count({ where: { status: SurveyStatus.DRAFT } }),
      this.prisma.survey.count({ where: { status: SurveyStatus.CLOSED } }),
      this.prisma.surveyResponse.count(),
      this.prisma.survey.findMany({
        select: {
          id: true,
          targetType: true,
          targetMeta: true,
          _count: {
            select: { responses: true },
          },
        },
      }),
    ]);

    const targetCounts = await Promise.all(
      surveys.map(async (survey) => {
        const targeted = await this.getTargetedUserIdsByTarget(
          survey.targetType,
          this.parseTargetMeta(survey.targetMeta),
        );
        return {
          responseCount: survey._count.responses,
          targetedCount: targeted.length,
        };
      }),
    );

    const aggregate = targetCounts.reduce(
      (acc, row) => {
        acc.responses += row.responseCount;
        acc.targeted += row.targetedCount;
        return acc;
      },
      { responses: 0, targeted: 0 },
    );

    const avgResponseRate =
      aggregate.targeted > 0 ? this.round((aggregate.responses / aggregate.targeted) * 100) : 0;

    return {
      total,
      active,
      draft,
      closed,
      totalResponses,
      avgResponseRate,
    };
  }

  async listSurveys(filters: ListSurveysDto): Promise<SurveyListResponseDto> {
    const safePage = Number.isFinite(filters.page) && Number(filters.page) > 0 ? Number(filters.page) : 1;
    const safeLimit =
      Number.isFinite(filters.limit) && Number(filters.limit) > 0
        ? Math.min(Number(filters.limit), 100)
        : 25;

    const where: Prisma.SurveyWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.createdById) {
      where.createdById = filters.createdById;
    }
    if (filters.search?.trim()) {
      where.title = {
        contains: filters.search.trim(),
        mode: Prisma.QueryMode.insensitive,
      };
    }

    const dateFilter: Prisma.DateTimeFilter = {};
    if (filters.dateFrom) {
      dateFilter.gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    if (dateFilter.gte || dateFilter.lte) {
      where.createdAt = dateFilter;
    }

    const [rows, total] = await Promise.all([
      this.prisma.survey.findMany({
        where,
        select: {
          id: true,
          title: true,
          status: true,
          targetType: true,
          publishedAt: true,
          closedAt: true,
          createdAt: true,
          _count: {
            select: {
              questions: true,
              responses: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.survey.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toSurveyListItem(row)),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async getSurveyDetail(id: string): Promise<SurveyDetailDto> {
    const survey = await this.getSurveyOrThrow(id);
    const analytics = await this.getSurveyAnalytics(id);

    return {
      id: survey.id,
      title: survey.title,
      description: survey.description,
      targetType: survey.targetType,
      targetMeta: this.parseTargetMeta(survey.targetMeta),
      status: survey.status,
      publishedAt: this.toIso(survey.publishedAt),
      closedAt: this.toIso(survey.closedAt),
      notificationId: survey.notificationId,
      createdById: survey.createdById,
      createdAt: survey.createdAt.toISOString(),
      updatedAt: survey.updatedAt.toISOString(),
      questions: survey.questions.map((question) => this.toSurveyQuestionDto(question)),
      responseCount: survey._count.responses,
      analytics,
    };
  }

  async createSurvey(dto: CreateSurveyDto, createdById: string): Promise<SurveyDetailDto> {
    const targetType = dto.targetType ?? SurveyTarget.ALL;
    const targetMeta = await this.validateTargetMeta(targetType, dto.targetMeta);

    const preparedQuestions = dto.questions.map((question, index) =>
      this.prepareSurveyQuestion(question, index),
    );

    const created = await this.prisma.survey.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        targetType,
        targetMeta,
        status: SurveyStatus.DRAFT,
        createdById,
        questions: {
          create: preparedQuestions,
        },
      },
      select: { id: true },
    });

    return this.getSurveyDetail(created.id);
  }

  async updateSurvey(id: string, dto: UpdateSurveyDto): Promise<SurveyDetailDto> {
    const survey = await this.getSurveyOrThrow(id);
    if (survey.status === SurveyStatus.ACTIVE || survey.status === SurveyStatus.CLOSED) {
      throw new BadRequestException('ACTIVE or CLOSED surveys cannot be updated');
    }

    const nextTargetType = dto.targetType ?? survey.targetType;
    const existingTargetMeta = this.parseTargetMeta(survey.targetMeta);
    const nextTargetMeta = await this.validateTargetMeta(
      nextTargetType,
      dto.targetMeta ?? existingTargetMeta,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.survey.update({
        where: { id },
        data: {
          title: dto.title?.trim(),
          description:
            dto.description === undefined ? undefined : dto.description.trim() || null,
          targetType: nextTargetType,
          targetMeta: nextTargetMeta,
        },
      });

      if (dto.questions === undefined) {
        return;
      }

      const currentQuestions = await tx.surveyQuestion.findMany({
        where: { surveyId: id },
        select: { id: true },
      });
      const currentIds = new Set(currentQuestions.map((question) => question.id));
      const retainedIds = new Set<string>();

      for (const [index, questionDto] of dto.questions.entries()) {
        const prepared = this.prepareSurveyQuestion(questionDto, index);

        if (questionDto.id) {
          if (!currentIds.has(questionDto.id)) {
            throw new BadRequestException(`Question ${questionDto.id} does not belong to survey`);
          }

          retainedIds.add(questionDto.id);
          await tx.surveyQuestion.update({
            where: { id: questionDto.id },
            data: prepared,
          });
          continue;
        }

        const createdQuestion = await tx.surveyQuestion.create({
          data: {
            surveyId: id,
            ...prepared,
          },
          select: { id: true },
        });
        retainedIds.add(createdQuestion.id);
      }

      const toRemove = [...currentIds].filter((questionId) => !retainedIds.has(questionId));
      if (toRemove.length > 0) {
        await tx.surveyAnswer.deleteMany({
          where: { questionId: { in: toRemove } },
        });
        await tx.surveyQuestion.deleteMany({
          where: { id: { in: toRemove } },
        });
      }
    });

    return this.getSurveyDetail(id);
  }

  async publishSurvey(id: string, adminId: string): Promise<SurveyDetailDto> {
    const survey = await this.prisma.survey.findUnique({
      where: { id },
      include: {
        questions: {
          select: { id: true },
        },
      },
    });

    if (!survey) {
      throw new NotFoundException('Survey not found');
    }
    if (survey.status !== SurveyStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT surveys can be published');
    }
    if (survey.questions.length === 0) {
      throw new BadRequestException('Survey must include at least one question before publishing');
    }

    const targetUserIds = await this.getTargetedUserIdsByTarget(
      survey.targetType,
      this.parseTargetMeta(survey.targetMeta),
    );

    let notificationId: string | null = null;
    if (targetUserIds.length > 0) {
      notificationId = await this.notificationsService.sendNotification(
        {
          type: NotificationType.ANNOUNCEMENT,
          title: 'New Survey Available',
          messageEn: `New survey available: ${survey.title}`,
          channels: [Channel.IN_APP, Channel.PUSH],
          targetAudience: Audience.SPECIFIC_RESIDENCES,
          audienceMeta: { userIds: targetUserIds },
          payload: {
            route: '/surveys',
            webRoute: '#surveys',
            entityType: 'SURVEY',
            entityId: survey.id,
            eventKey: 'survey.published',
          },
        },
        adminId,
      );
    }

    await this.prisma.survey.update({
      where: { id },
      data: {
        status: SurveyStatus.ACTIVE,
        publishedAt: new Date(),
        notificationId,
      },
    });

    return this.getSurveyDetail(id);
  }

  async closeSurvey(id: string): Promise<SurveyDetailDto> {
    const survey = await this.prisma.survey.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!survey) {
      throw new NotFoundException('Survey not found');
    }
    if (survey.status !== SurveyStatus.ACTIVE) {
      throw new BadRequestException('Only ACTIVE surveys can be closed');
    }

    await this.prisma.survey.update({
      where: { id },
      data: {
        status: SurveyStatus.CLOSED,
        closedAt: new Date(),
      },
    });

    return this.getSurveyDetail(id);
  }

  async deleteSurvey(id: string): Promise<{ success: true }> {
    const survey = await this.prisma.survey.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!survey) {
      throw new NotFoundException('Survey not found');
    }
    if (survey.status === SurveyStatus.ACTIVE) {
      throw new BadRequestException('ACTIVE surveys cannot be deleted');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.surveyAnswer.deleteMany({
        where: {
          response: {
            surveyId: id,
          },
        },
      });
      await tx.surveyResponse.deleteMany({ where: { surveyId: id } });
      await tx.surveyQuestion.deleteMany({ where: { surveyId: id } });
      await tx.survey.delete({ where: { id } });
    });

    return { success: true };
  }

  async submitResponse(
    surveyId: string,
    userId: string,
    dto: SubmitResponseDto,
  ): Promise<SurveyResponseSubmittedDto> {
    const survey = await this.prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!survey) {
      throw new NotFoundException('Survey not found');
    }
    if (survey.status !== SurveyStatus.ACTIVE) {
      throw new BadRequestException('Responses can only be submitted for ACTIVE surveys');
    }

    const existing = await this.prisma.surveyResponse.findUnique({
      where: {
        surveyId_userId: {
          surveyId,
          userId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('User has already submitted a response for this survey');
    }

    const surveyQuestionsById = new Map<string, SurveyQuestionRecord>(
      survey.questions.map((question) => [question.id, question]),
    );

    const answerByQuestionId = new Map<string, SubmitSurveyAnswerDto>();
    for (const answer of dto.answers) {
      if (!surveyQuestionsById.has(answer.questionId)) {
        throw new BadRequestException(`Question ${answer.questionId} is not part of this survey`);
      }
      if (answerByQuestionId.has(answer.questionId)) {
        throw new BadRequestException(`Duplicate answer for question ${answer.questionId}`);
      }
      answerByQuestionId.set(answer.questionId, answer);
    }

    const answerRows: SurveyAnswerWrite[] = [];
    for (const question of survey.questions) {
      const answer = answerByQuestionId.get(question.id);
      const prepared = this.validateSurveyAnswer(question, answer);
      if (prepared) {
        answerRows.push(prepared);
      }
    }

    const created = await this.prisma.surveyResponse.create({
      data: {
        surveyId,
        userId,
        answers: {
          create: answerRows,
        },
      },
      include: {
        answers: {
          select: { id: true },
        },
      },
    });

    // Notify the survey creator about the new submission (fire-and-forget)
    this.notificationsService
      .sendNotification(
        {
          type: NotificationType.ANNOUNCEMENT,
          title: `New survey response: ${survey.title}`,
          messageEn: `A resident has submitted a response to your survey "${survey.title}".`,
          channels: [Channel.IN_APP],
          targetAudience: Audience.SPECIFIC_RESIDENCES,
          audienceMeta: { userIds: [survey.createdById] },
          payload: {
            route: '/surveys',
            webRoute: '#surveys',
            entityType: 'SURVEY',
            entityId: survey.id,
            eventKey: 'survey.response_submitted',
          },
        },
        survey.createdById,
      )
      .catch(() => {
        /* best-effort notification – ignore failures */
      });

    return {
      id: created.id,
      surveyId: created.surveyId,
      userId: created.userId,
      submittedAt: created.submittedAt.toISOString(),
      answerCount: created.answers.length,
    };
  }

  async getSurveyAnalytics(id: string): Promise<SurveyAnalyticsDto> {
    const survey = await this.getSurveyOrThrow(id);

    const targetUserIds = await this.getTargetedUserIdsByTarget(
      survey.targetType,
      this.parseTargetMeta(survey.targetMeta),
    );

    const totalResponses = survey._count.responses;
    const completionRate =
      targetUserIds.length > 0 ? this.round((totalResponses / targetUserIds.length) * 100) : 0;

    if (survey.questions.length === 0) {
      return {
        totalResponses,
        completionRate,
        questions: [],
      };
    }

    const questionIds = survey.questions.map((question) => question.id);
    const answers = await this.prisma.surveyAnswer.findMany({
      where: {
        questionId: { in: questionIds },
      },
      select: {
        questionId: true,
        valueText: true,
        valueNumber: true,
        valueChoice: true,
      },
    });

    const answersByQuestionId = new Map<string, typeof answers>();
    for (const answer of answers) {
      const existing = answersByQuestionId.get(answer.questionId) ?? [];
      existing.push(answer);
      answersByQuestionId.set(answer.questionId, existing);
    }

    const questionAnalytics: SurveyQuestionAnalyticsDto[] = survey.questions.map((question) => {
      const questionAnswers = answersByQuestionId.get(question.id) ?? [];

      if (question.type === SurveyFieldType.TEXT) {
        const textAnswers = questionAnswers
          .map((answer) => answer.valueText?.trim() ?? '')
          .filter((text) => text.length > 0);

        return {
          questionId: question.id,
          questionText: question.text,
          type: SurveyFieldType.TEXT,
          required: question.required,
          displayOrder: question.displayOrder,
          answerCount: textAnswers.length,
          textAnswers: textAnswers.slice(0, 50),
          totalTextAnswers: textAnswers.length,
        };
      }

      if (question.type === SurveyFieldType.MULTIPLE_CHOICE) {
        const configuredChoices = this.parseQuestionOptions(question.options).choices;
        const countByChoice = new Map<string, number>();

        for (const answer of questionAnswers) {
          const choice = answer.valueChoice?.trim();
          if (!choice) {
            continue;
          }
          countByChoice.set(choice, (countByChoice.get(choice) ?? 0) + 1);
        }

        const allChoices = [...new Set([...configuredChoices, ...countByChoice.keys()])];
        const answeredCount = [...countByChoice.values()].reduce((sum, value) => sum + value, 0);

        const options: SurveyMultipleChoiceOptionAnalyticsDto[] = allChoices.map((choice) => {
          const count = countByChoice.get(choice) ?? 0;
          return {
            choice,
            count,
            percentage: answeredCount > 0 ? this.round((count / answeredCount) * 100) : 0,
          };
        });

        return {
          questionId: question.id,
          questionText: question.text,
          type: SurveyFieldType.MULTIPLE_CHOICE,
          required: question.required,
          displayOrder: question.displayOrder,
          answerCount: answeredCount,
          options,
        };
      }

      if (question.type === SurveyFieldType.RATING) {
        const distribution: {
          1: number;
          2: number;
          3: number;
          4: number;
          5: number;
        } = {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        };

        let ratingCount = 0;
        let ratingTotal = 0;
        for (const answer of questionAnswers) {
          const value = answer.valueNumber;
          if (!value || value < 1 || value > 5) {
            continue;
          }

          distribution[value as 1 | 2 | 3 | 4 | 5] += 1;
          ratingCount += 1;
          ratingTotal += value;
        }

        return {
          questionId: question.id,
          questionText: question.text,
          type: SurveyFieldType.RATING,
          required: question.required,
          displayOrder: question.displayOrder,
          answerCount: ratingCount,
          avg: ratingCount > 0 ? this.round(ratingTotal / ratingCount) : 0,
          distribution,
        };
      }

      let yes = 0;
      let no = 0;
      for (const answer of questionAnswers) {
        const normalized = this.normalizeYesNo(answer.valueText ?? undefined);
        if (normalized === 'YES') {
          yes += 1;
        } else if (normalized === 'NO') {
          no += 1;
        }
      }

      const answerCount = yes + no;
      return {
        questionId: question.id,
        questionText: question.text,
        type: SurveyFieldType.YES_NO,
        required: question.required,
        displayOrder: question.displayOrder,
        answerCount,
        yes,
        no,
        yesPercentage: answerCount > 0 ? this.round((yes / answerCount) * 100) : 0,
      };
    });

    return {
      totalResponses,
      completionRate,
      questions: questionAnalytics,
    };
  }
}
