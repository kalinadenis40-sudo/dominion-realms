import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ResourcesService } from './resources.service';

@Controller('settlements/:id/resources')
@UseGuards(JwtAuthGuard)
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  getResources(@Param('id') id: string) {
    return this.resourcesService.getResources(id);
  }
}
