import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreateSurveyDto, UpdateSurveyDto } from './dto/create-survey.dto';
import { ListSurveysDto } from './dto/list-surveys.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';
import { SurveyService } from './survey.service';

type AuthRequest = {
  user: {
    id: string;
  };
};

@ApiTags('Survey')
@Controller('surveys')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class SurveyController {
  constructor(private readonly surveyService: SurveyService) {}

  @Get('stats')
  getSurveyStats() {
    return this.surveyService.getSurveyStats();
  }

  @Get()
  listSurveys(@Query() query: ListSurveysDto) {
    return this.surveyService.listSurveys(query);
  }

  @Get(':id')
  getSurveyDetail(@Param('id') id: string) {
    return this.surveyService.getSurveyDetail(id);
  }

  @Get(':id/analytics')
  getSurveyAnalytics(@Param('id') id: string) {
    return this.surveyService.getSurveyAnalytics(id);
  }

  @Post()
  createSurvey(@Body() dto: CreateSurveyDto, @Request() req: AuthRequest) {
    return this.surveyService.createSurvey(dto, req.user.id);
  }

  @Patch(':id')
  updateSurvey(@Param('id') id: string, @Body() dto: UpdateSurveyDto) {
    return this.surveyService.updateSurvey(id, dto);
  }

  @Post(':id/publish')
  publishSurvey(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.surveyService.publishSurvey(id, req.user.id);
  }

  @Post(':id/close')
  closeSurvey(@Param('id') id: string) {
    return this.surveyService.closeSurvey(id);
  }

  @Delete(':id')
  deleteSurvey(@Param('id') id: string) {
    return this.surveyService.deleteSurvey(id);
  }

  @Post(':id/respond')
  submitResponse(
    @Param('id') surveyId: string,
    @Body() dto: SubmitResponseDto,
    @Request() req: AuthRequest,
  ) {
    return this.surveyService.submitResponse(surveyId, req.user.id, dto);
  }
}
