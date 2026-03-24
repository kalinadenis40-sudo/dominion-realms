import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { WorldService } from './world.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('worlds')
export class WorldController {
  constructor(private readonly worldService: WorldService) {}

  @Get()
  getActiveWorlds() {
    return this.worldService.getActiveWorlds();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getWorld(@Param('id') id: string) {
    return this.worldService.getWorldById(id);
  }
}
