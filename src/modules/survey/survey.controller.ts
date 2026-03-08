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
import { Permissions } from '../auth/decorators/permissions.decorator';
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
  @Permissions('survey.view_all')
  getSurveyStats() {
    return this.surveyService.getSurveyStats();
  }

  @Get()
  @Permissions('survey.view_all', 'survey.view_own')
  listSurveys(@Query() query: ListSurveysDto) {
    return this.surveyService.listSurveys(query);
  }

  @Get(':id')
  @Permissions('survey.view_all', 'survey.view_own')
  getSurveyDetail(@Param('id') id: string) {
    return this.surveyService.getSurveyDetail(id);
  }

  @Get(':id/analytics')
  @Permissions('survey.view_all')
  getSurveyAnalytics(@Param('id') id: string) {
    return this.surveyService.getSurveyAnalytics(id);
  }

  @Post()
  @Permissions('survey.create')
  createSurvey(@Body() dto: CreateSurveyDto, @Request() req: AuthRequest) {
    return this.surveyService.createSurvey(dto, req.user.id);
  }

  @Patch(':id')
  @Permissions('survey.update')
  updateSurvey(@Param('id') id: string, @Body() dto: UpdateSurveyDto) {
    return this.surveyService.updateSurvey(id, dto);
  }

  @Post(':id/publish')
  @Permissions('survey.publish')
  publishSurvey(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.surveyService.publishSurvey(id, req.user.id);
  }

  @Post(':id/close')
  @Permissions('survey.close')
  closeSurvey(@Param('id') id: string) {
    return this.surveyService.closeSurvey(id);
  }

  @Delete(':id')
  @Permissions('survey.delete')
  deleteSurvey(@Param('id') id: string) {
    return this.surveyService.deleteSurvey(id);
  }

  @Post(':id/respond')
  @Permissions('survey.respond')
  submitResponse(
    @Param('id') surveyId: string,
    @Body() dto: SubmitResponseDto,
    @Request() req: AuthRequest,
  ) {
    return this.surveyService.submitResponse(surveyId, req.user.id, dto);
  }
}
