import { SurveyFieldType, SurveyStatus, SurveyTarget } from '@prisma/client';

export class SurveyStatsDto {
  total!: number;
  active!: number;
  draft!: number;
  closed!: number;
  totalResponses!: number;
  avgResponseRate!: number;
}

export class SurveyListItemDto {
  id!: string;
  title!: string;
  status!: SurveyStatus;
  targetType!: SurveyTarget;
  questionCount!: number;
  responseCount!: number;
  publishedAt!: string | null;
  closedAt!: string | null;
  createdAt!: string;
}

export class SurveyListResponseDto {
  data!: SurveyListItemDto[];
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}

export class SurveyQuestionDto {
  id!: string;
  text!: string;
  type!: SurveyFieldType;
  options!: Record<string, unknown> | null;
  required!: boolean;
  displayOrder!: number;
}

export type SurveyTextQuestionAnalyticsDto = {
  questionId: string;
  questionText: string;
  type: 'TEXT';
  required: boolean;
  displayOrder: number;
  answerCount: number;
  textAnswers: string[];
  totalTextAnswers: number;
};

export type SurveyMultipleChoiceOptionAnalyticsDto = {
  choice: string;
  count: number;
  percentage: number;
};

export type SurveyMultipleChoiceQuestionAnalyticsDto = {
  questionId: string;
  questionText: string;
  type: 'MULTIPLE_CHOICE';
  required: boolean;
  displayOrder: number;
  answerCount: number;
  options: SurveyMultipleChoiceOptionAnalyticsDto[];
};

export type SurveyRatingQuestionAnalyticsDto = {
  questionId: string;
  questionText: string;
  type: 'RATING';
  required: boolean;
  displayOrder: number;
  answerCount: number;
  avg: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
};

export type SurveyYesNoQuestionAnalyticsDto = {
  questionId: string;
  questionText: string;
  type: 'YES_NO';
  required: boolean;
  displayOrder: number;
  answerCount: number;
  yes: number;
  no: number;
  yesPercentage: number;
};

export type SurveyQuestionAnalyticsDto =
  | SurveyTextQuestionAnalyticsDto
  | SurveyMultipleChoiceQuestionAnalyticsDto
  | SurveyRatingQuestionAnalyticsDto
  | SurveyYesNoQuestionAnalyticsDto;

export class SurveyAnalyticsDto {
  totalResponses!: number;
  completionRate!: number;
  questions!: SurveyQuestionAnalyticsDto[];
}

export class SurveyDetailDto {
  id!: string;
  title!: string;
  description!: string | null;
  targetType!: SurveyTarget;
  targetMeta!: Record<string, unknown> | null;
  status!: SurveyStatus;
  publishedAt!: string | null;
  closedAt!: string | null;
  notificationId!: string | null;
  createdById!: string;
  createdAt!: string;
  updatedAt!: string;
  questions!: SurveyQuestionDto[];
  responseCount!: number;
  analytics!: SurveyAnalyticsDto;
}

export class SurveyResponseSubmittedDto {
  id!: string;
  surveyId!: string;
  userId!: string;
  submittedAt!: string;
  answerCount!: number;
}
