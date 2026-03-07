import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SurveyFieldType, SurveyStatus, SurveyTarget } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SurveyService } from './survey.service';

describe('SurveyService', () => {
  let service: SurveyService;

  const prismaMock = {
    survey: {
      findUnique: jest.fn(),
    },
    surveyResponse: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    surveyAnswer: {
      findMany: jest.fn(),
    },
    resident: {
      findMany: jest.fn(),
    },
    unitAccess: {
      findMany: jest.fn(),
    },
    residentUnit: {
      findMany: jest.fn(),
    },
    unit: {
      findMany: jest.fn(),
    },
  };

  const notificationsMock = {
    sendNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SurveyService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: NotificationsService, useValue: notificationsMock },
      ],
    }).compile();

    service = module.get<SurveyService>(SurveyService);
    jest.clearAllMocks();
  });

  it('rejects duplicate response submissions', async () => {
    prismaMock.survey.findUnique.mockResolvedValue({
      id: 'survey-1',
      status: SurveyStatus.ACTIVE,
      questions: [
        {
          id: 'question-1',
          text: 'How do you rate cleanliness?',
          type: SurveyFieldType.TEXT,
          options: null,
          required: true,
          displayOrder: 0,
        },
      ],
    });
    prismaMock.surveyResponse.findUnique.mockResolvedValue({ id: 'response-1' });

    await expect(
      service.submitResponse('survey-1', 'user-1', {
        answers: [{ questionId: 'question-1', valueText: 'Good' }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('validates required question answers before submission', async () => {
    prismaMock.survey.findUnique.mockResolvedValue({
      id: 'survey-1',
      status: SurveyStatus.ACTIVE,
      questions: [
        {
          id: 'question-1',
          text: 'How do you rate cleanliness?',
          type: SurveyFieldType.TEXT,
          options: null,
          required: true,
          displayOrder: 0,
        },
      ],
    });
    prismaMock.surveyResponse.findUnique.mockResolvedValue(null);

    await expect(
      service.submitResponse('survey-1', 'user-1', {
        answers: [],
      }),
    ).rejects.toThrow('Required question is missing');
  });

  it('calculates analytics for all question types', async () => {
    prismaMock.survey.findUnique.mockResolvedValue({
      id: 'survey-1',
      title: 'Pulse',
      description: null,
      targetType: SurveyTarget.ALL,
      targetMeta: null,
      status: SurveyStatus.ACTIVE,
      publishedAt: new Date('2026-03-01T00:00:00.000Z'),
      closedAt: null,
      notificationId: null,
      createdById: 'admin-1',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      questions: [
        {
          id: 'q-text',
          text: 'Comments',
          type: SurveyFieldType.TEXT,
          options: null,
          required: false,
          displayOrder: 0,
        },
        {
          id: 'q-mc',
          text: 'Top priority',
          type: SurveyFieldType.MULTIPLE_CHOICE,
          options: { choices: ['Security', 'Parking'] },
          required: true,
          displayOrder: 1,
        },
        {
          id: 'q-rating',
          text: 'Rate overall',
          type: SurveyFieldType.RATING,
          options: null,
          required: true,
          displayOrder: 2,
        },
        {
          id: 'q-yesno',
          text: 'Recommend?',
          type: SurveyFieldType.YES_NO,
          options: null,
          required: true,
          displayOrder: 3,
        },
      ],
      _count: {
        responses: 4,
      },
    });

    prismaMock.surveyAnswer.findMany.mockResolvedValue([
      { questionId: 'q-text', valueText: 'Great services', valueChoice: null, valueNumber: null },
      { questionId: 'q-text', valueText: 'Needs parking control', valueChoice: null, valueNumber: null },
      { questionId: 'q-mc', valueText: null, valueChoice: 'Security', valueNumber: null },
      { questionId: 'q-mc', valueText: null, valueChoice: 'Security', valueNumber: null },
      { questionId: 'q-mc', valueText: null, valueChoice: 'Parking', valueNumber: null },
      { questionId: 'q-rating', valueText: null, valueChoice: null, valueNumber: 5 },
      { questionId: 'q-rating', valueText: null, valueChoice: null, valueNumber: 4 },
      { questionId: 'q-rating', valueText: null, valueChoice: null, valueNumber: 3 },
      { questionId: 'q-yesno', valueText: 'YES', valueChoice: null, valueNumber: null },
      { questionId: 'q-yesno', valueText: 'NO', valueChoice: null, valueNumber: null },
      { questionId: 'q-yesno', valueText: 'YES', valueChoice: null, valueNumber: null },
    ]);

    prismaMock.resident.findMany.mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
      { userId: 'user-3' },
      { userId: 'user-4' },
    ]);
    prismaMock.unitAccess.findMany.mockResolvedValue([]);

    const analytics = await service.getSurveyAnalytics('survey-1');

    expect(analytics.totalResponses).toBe(4);
    expect(analytics.completionRate).toBe(100);

    const multipleChoice = analytics.questions.find((question) => question.questionId === 'q-mc');
    expect(multipleChoice).toBeDefined();
    if (multipleChoice && multipleChoice.type === SurveyFieldType.MULTIPLE_CHOICE) {
      const totalPercent = multipleChoice.options.reduce((sum, row) => sum + row.percentage, 0);
      expect(totalPercent).toBeGreaterThanOrEqual(99.99);
      expect(totalPercent).toBeLessThanOrEqual(100.01);
    }

    const rating = analytics.questions.find((question) => question.questionId === 'q-rating');
    expect(rating).toBeDefined();
    if (rating && rating.type === SurveyFieldType.RATING) {
      const distributionTotal =
        rating.distribution[1] +
        rating.distribution[2] +
        rating.distribution[3] +
        rating.distribution[4] +
        rating.distribution[5];
      expect(distributionTotal).toBe(rating.answerCount);
      expect(rating.avg).toBe(4);
    }
  });
});
