import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SurveyFieldType, SurveyStatus, SurveyTarget } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/modules/auth/guards/permissions.guard';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { SurveyController } from '../../src/modules/survey/survey.controller';
import { SurveyService } from '../../src/modules/survey/survey.service';

type SurveyState = {
  id: string;
  title: string;
  description: string | null;
  targetType: SurveyTarget;
  targetMeta: Record<string, unknown> | null;
  status: SurveyStatus;
  publishedAt: Date | null;
  closedAt: Date | null;
  notificationId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

type SurveyQuestionState = {
  id: string;
  surveyId: string;
  text: string;
  type: SurveyFieldType;
  options: Record<string, unknown> | null;
  required: boolean;
  displayOrder: number;
};

type SurveyResponseState = {
  id: string;
  surveyId: string;
  userId: string;
  submittedAt: Date;
};

type SurveyAnswerState = {
  id: string;
  responseId: string;
  questionId: string;
  valueText: string | null;
  valueNumber: number | null;
  valueChoice: string | null;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

describe('Survey (e2e)', () => {
  let app: INestApplication;

  let surveySeq = 0;
  let questionSeq = 0;
  let responseSeq = 0;
  let answerSeq = 0;

  const surveys: SurveyState[] = [];
  const questions: SurveyQuestionState[] = [];
  const responses: SurveyResponseState[] = [];
  const answers: SurveyAnswerState[] = [];

  const nextId = (prefix: string, value: number): string =>
    `${prefix}-${value.toString().padStart(4, '0')}`;

  const notificationsMock = {
    sendNotification: jest.fn(async () => 'notif-1'),
  };

  const prismaMock = {
    community: {
      count: jest.fn(async () => 0),
    },
    unit: {
      count: jest.fn(async () => 0),
      findMany: jest.fn(async () => []),
    },
    resident: {
      findMany: jest.fn(async () => [{ userId: 'resident-1' }]),
    },
    unitAccess: {
      findMany: jest.fn(async () => []),
    },
    residentUnit: {
      findMany: jest.fn(async () => []),
    },
    survey: {
      create: jest.fn(async ({ data, select }: { data: Record<string, unknown>; select?: Record<string, boolean> }) => {
        surveySeq += 1;
        const now = new Date();
        const id = nextId('survey', surveySeq);
        const row: SurveyState = {
          id,
          title: String(data.title),
          description: (data.description as string | null | undefined) ?? null,
          targetType: (data.targetType as SurveyTarget | undefined) ?? SurveyTarget.ALL,
          targetMeta: (data.targetMeta as Record<string, unknown> | null | undefined) ?? null,
          status: (data.status as SurveyStatus | undefined) ?? SurveyStatus.DRAFT,
          publishedAt: null,
          closedAt: null,
          notificationId: null,
          createdById: String(data.createdById),
          createdAt: now,
          updatedAt: now,
        };
        surveys.push(row);

        const nestedQuestions =
          (data.questions as { create?: Array<Record<string, unknown>> } | undefined)?.create ?? [];
        for (const question of nestedQuestions) {
          questionSeq += 1;
          questions.push({
            id: nextId('question', questionSeq),
            surveyId: id,
            text: String(question.text),
            type: question.type as SurveyFieldType,
            options: (question.options as Record<string, unknown> | null | undefined) ?? null,
            required: (question.required as boolean | undefined) ?? true,
            displayOrder: (question.displayOrder as number | undefined) ?? 0,
          });
        }

        if (select?.id) {
          return { id };
        }

        return clone(row);
      }),
      findUnique: jest.fn(async ({ where, include, select }: {
        where: { id: string };
        include?: {
          questions?: { orderBy?: { displayOrder: 'asc' | 'desc' }; select?: { id?: boolean } };
          _count?: { select: { responses: boolean } };
        };
        select?: { status?: boolean };
      }) => {
        const row = surveys.find((survey) => survey.id === where.id);
        if (!row) {
          return null;
        }

        if (select?.status) {
          return { status: row.status };
        }

        if (!include) {
          return clone(row);
        }

        let surveyQuestions = questions.filter((question) => question.surveyId === row.id);
        if (include.questions?.orderBy?.displayOrder === 'asc') {
          surveyQuestions = surveyQuestions.sort((a, b) => a.displayOrder - b.displayOrder);
        }

        const result: Record<string, unknown> = {
          ...clone(row),
        };

        if (include.questions) {
          if (include.questions.select?.id) {
            result.questions = surveyQuestions.map((question) => ({ id: question.id }));
          } else {
            result.questions = clone(surveyQuestions);
          }
        }

        if (include._count?.select.responses) {
          result._count = {
            responses: responses.filter((response) => response.surveyId === row.id).length,
          };
        }

        return result;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = surveys.find((survey) => survey.id === where.id);
        if (!row) {
          throw new Error('Survey not found');
        }

        if (data.title !== undefined) row.title = String(data.title);
        if (data.description !== undefined) row.description = (data.description as string | null) ?? null;
        if (data.targetType !== undefined) row.targetType = data.targetType as SurveyTarget;
        if (data.targetMeta !== undefined) row.targetMeta = (data.targetMeta as Record<string, unknown> | null) ?? null;
        if (data.status !== undefined) row.status = data.status as SurveyStatus;
        if (data.publishedAt !== undefined) row.publishedAt = (data.publishedAt as Date | null) ?? null;
        if (data.closedAt !== undefined) row.closedAt = (data.closedAt as Date | null) ?? null;
        if (data.notificationId !== undefined)
          row.notificationId = (data.notificationId as string | null) ?? null;
        row.updatedAt = new Date();

        return clone(row);
      }),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const index = surveys.findIndex((survey) => survey.id === where.id);
        if (index < 0) {
          throw new Error('Survey not found');
        }
        const removed = surveys[index];
        surveys.splice(index, 1);
        return clone(removed);
      }),
      count: jest.fn(async () => surveys.length),
      findMany: jest.fn(async () => []),
    },
    surveyQuestion: {
      findMany: jest.fn(async ({ where }: { where: { surveyId: string } }) =>
        clone(questions.filter((question) => question.surveyId === where.surveyId)),
      ),
      create: jest.fn(async ({ data, select }: { data: Record<string, unknown>; select?: { id?: boolean } }) => {
        questionSeq += 1;
        const row: SurveyQuestionState = {
          id: nextId('question', questionSeq),
          surveyId: String(data.surveyId),
          text: String(data.text),
          type: data.type as SurveyFieldType,
          options: (data.options as Record<string, unknown> | null | undefined) ?? null,
          required: (data.required as boolean | undefined) ?? true,
          displayOrder: (data.displayOrder as number | undefined) ?? 0,
        };
        questions.push(row);
        if (select?.id) {
          return { id: row.id };
        }
        return clone(row);
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = questions.find((question) => question.id === where.id);
        if (!row) {
          throw new Error('Question not found');
        }
        if (data.text !== undefined) row.text = String(data.text);
        if (data.type !== undefined) row.type = data.type as SurveyFieldType;
        if (data.options !== undefined) row.options = (data.options as Record<string, unknown> | null) ?? null;
        if (data.required !== undefined) row.required = Boolean(data.required);
        if (data.displayOrder !== undefined) row.displayOrder = Number(data.displayOrder);
        return clone(row);
      }),
      deleteMany: jest.fn(async ({ where }: { where: { surveyId?: string; id?: { in?: string[] } } }) => {
        const ids = where.id?.in ?? [];
        const before = questions.length;
        if (where.surveyId) {
          const toDeleteIds = questions
            .filter((question) => question.surveyId === where.surveyId)
            .map((question) => question.id);
          for (const id of toDeleteIds) {
            const index = questions.findIndex((question) => question.id === id);
            if (index >= 0) questions.splice(index, 1);
          }
        } else if (ids.length > 0) {
          for (const id of ids) {
            const index = questions.findIndex((question) => question.id === id);
            if (index >= 0) questions.splice(index, 1);
          }
        }
        return { count: before - questions.length };
      }),
    },
    surveyResponse: {
      findUnique: jest.fn(async ({ where }: { where: { surveyId_userId: { surveyId: string; userId: string } } }) => {
        const row = responses.find(
          (response) =>
            response.surveyId === where.surveyId_userId.surveyId &&
            response.userId === where.surveyId_userId.userId,
        );
        return row ? clone(row) : null;
      }),
      create: jest.fn(async ({ data, include }: { data: Record<string, unknown>; include?: { answers?: { select: { id: boolean } } } }) => {
        responseSeq += 1;
        const responseId = nextId('response', responseSeq);
        const row: SurveyResponseState = {
          id: responseId,
          surveyId: String(data.surveyId),
          userId: String(data.userId),
          submittedAt: new Date(),
        };
        responses.push(row);

        const nestedAnswers =
          (data.answers as { create?: Array<Record<string, unknown>> } | undefined)?.create ?? [];
        const createdAnswers: Array<{ id: string }> = [];
        for (const answer of nestedAnswers) {
          answerSeq += 1;
          const answerRow: SurveyAnswerState = {
            id: nextId('answer', answerSeq),
            responseId,
            questionId: String(answer.questionId),
            valueText: (answer.valueText as string | null | undefined) ?? null,
            valueNumber: (answer.valueNumber as number | null | undefined) ?? null,
            valueChoice: (answer.valueChoice as string | null | undefined) ?? null,
          };
          answers.push(answerRow);
          createdAnswers.push({ id: answerRow.id });
        }

        if (include?.answers?.select.id) {
          return { ...clone(row), answers: createdAnswers };
        }

        return clone(row);
      }),
      deleteMany: jest.fn(async ({ where }: { where: { surveyId: string } }) => {
        const before = responses.length;
        const toRemove = responses.filter((response) => response.surveyId === where.surveyId).map((response) => response.id);
        for (const id of toRemove) {
          const index = responses.findIndex((response) => response.id === id);
          if (index >= 0) {
            responses.splice(index, 1);
          }
        }
        for (const id of toRemove) {
          for (let i = answers.length - 1; i >= 0; i -= 1) {
            if (answers[i].responseId === id) {
              answers.splice(i, 1);
            }
          }
        }
        return { count: before - responses.length };
      }),
      count: jest.fn(async () => responses.length),
    },
    surveyAnswer: {
      findMany: jest.fn(async ({ where }: { where?: { questionId?: { in?: string[] } } }) => {
        if (!where?.questionId?.in) {
          return clone(answers);
        }
        return clone(answers.filter((answer) => where.questionId?.in?.includes(answer.questionId)));
      }),
      deleteMany: jest.fn(async ({ where }: { where: { response?: { surveyId?: string }; questionId?: { in?: string[] } } }) => {
        const before = answers.length;
        if (where.response?.surveyId) {
          const responseIds = responses
            .filter((response) => response.surveyId === where.response?.surveyId)
            .map((response) => response.id);
          for (let i = answers.length - 1; i >= 0; i -= 1) {
            if (responseIds.includes(answers[i].responseId)) {
              answers.splice(i, 1);
            }
          }
        } else if (where.questionId?.in) {
          for (let i = answers.length - 1; i >= 0; i -= 1) {
            if (where.questionId.in.includes(answers[i].questionId)) {
              answers.splice(i, 1);
            }
          }
        }
        return { count: before - answers.length };
      }),
    },
    $transaction: jest.fn(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return arg(prismaMock);
      }

      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }

      return arg;
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SurveyController],
      providers: [
        SurveyService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: NotificationsService, useValue: notificationsMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
          const req = context.switchToHttp().getRequest();
          req.user = { id: 'resident-1' };
          return true;
        },
      })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('runs the survey lifecycle and response submission flow', async () => {
    const created = await request(app.getHttpServer())
      .post('/surveys')
      .send({
        title: 'Resident Satisfaction Check',
        description: 'Weekly pulse',
        questions: [
          {
            text: 'How would you rate community safety?',
            type: 'RATING',
            required: true,
            displayOrder: 0,
          },
          {
            text: 'Any comments?',
            type: 'TEXT',
            required: false,
            displayOrder: 1,
          },
        ],
      })
      .expect(201)
      .then((response) => response.body as { id: string; status: SurveyStatus });

    expect(created.status).toBe(SurveyStatus.DRAFT);

    await request(app.getHttpServer())
      .post(`/surveys/${created.id}/publish`)
      .expect(201)
      .then((response) => {
        expect(response.body.status).toBe(SurveyStatus.ACTIVE);
      });

    const ratingQuestionId = questions.find(
      (question) => question.surveyId === created.id && question.type === SurveyFieldType.RATING,
    )?.id;
    const textQuestionId = questions.find(
      (question) => question.surveyId === created.id && question.type === SurveyFieldType.TEXT,
    )?.id;

    expect(ratingQuestionId).toBeDefined();
    expect(textQuestionId).toBeDefined();

    const firstResponse = await request(app.getHttpServer())
      .post(`/surveys/${created.id}/respond`)
      .send({
        answers: [
          {
            questionId: ratingQuestionId,
            valueNumber: 5,
          },
          {
            questionId: textQuestionId,
            valueText: 'Excellent responsiveness from support team.',
          },
        ],
      })
      .expect(201)
      .then((response) => response.body as { answerCount: number });

    expect(firstResponse.answerCount).toBe(2);

    await request(app.getHttpServer())
      .post(`/surveys/${created.id}/respond`)
      .send({
        answers: [
          {
            questionId: ratingQuestionId,
            valueNumber: 4,
          },
        ],
      })
      .expect(409);

    await request(app.getHttpServer())
      .get(`/surveys/${created.id}/analytics`)
      .expect(200)
      .then((response) => {
        expect(response.body.totalResponses).toBe(1);
        expect(Array.isArray(response.body.questions)).toBe(true);
      });

    await request(app.getHttpServer())
      .post(`/surveys/${created.id}/close`)
      .expect(201)
      .then((response) => {
        expect(response.body.status).toBe(SurveyStatus.CLOSED);
      });

    await request(app.getHttpServer())
      .delete(`/surveys/${created.id}`)
      .expect(200)
      .then((response) => {
        expect(response.body.success).toBe(true);
      });
  });
});
