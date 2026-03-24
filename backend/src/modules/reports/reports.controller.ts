import { Controller, Get, Delete, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  getReports(
    @Req() req: any,
    @Query('type') type?: string,
    @Query('page') page?: string,
  ) {
    return this.reportsService.getReports(req.user.profileId, type, parseInt(page || '1'));
  }

  @Get('unread')
  getUnreadCount(@Req() req: any) {
    return this.reportsService.getUnreadCount(req.user.profileId);
  }

  @Get(':id')
  getReport(@Param('id') id: string, @Req() req: any) {
    return this.reportsService.getReport(id, req.user.profileId);
  }

  @Delete(':id')
  deleteReport(@Param('id') id: string, @Req() req: any) {
    return this.reportsService.deleteReport(id, req.user.profileId);
  }
}
