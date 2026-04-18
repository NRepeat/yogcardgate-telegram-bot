import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTokenGuard } from '../request/api-token.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/users')
@UseGuards(ApiTokenGuard)
export class UserApiController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getUsers() {
    const users = await this.prisma.user.findMany({
      include: { roles: true },
      orderBy: { username: 'asc' },
    });
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      telegramId: u.telegramId.toString(),
      onPause: u.onPause,
      roles: u.roles.map((r) => r.name),
    }));
  }

  @Get('roles')
  async getRoles() {
    return this.prisma.role.findMany();
  }

  @Put(':id/roles')
  async updateRoles(
    @Param('id') id: string,
    @Body() body: { roles: string[] },
  ) {
    const allRoles = await this.prisma.role.findMany();
    const roleIds = allRoles
      .filter((r) => body.roles.includes(r.name))
      .map((r) => ({ id: r.id }));

    const updated = await this.prisma.user.update({
      where: { id },
      data: { roles: { set: roleIds } },
      include: { roles: true },
    });

    return {
      id: updated.id,
      username: updated.username,
      roles: updated.roles.map((r) => r.name),
    };
  }

  @Put(':id/pause')
  async togglePause(
    @Param('id') id: string,
    @Body() body: { onPause: boolean },
  ) {
    const updated = await this.prisma.user.update({
      where: { id },
      data: { onPause: body.onPause },
    });

    return {
      id: updated.id,
      username: updated.username,
      onPause: updated.onPause,
    };
  }
}
