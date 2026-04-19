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
      include: { Role: true },
      orderBy: { username: 'asc' },
    });
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      telegramId: u.telegramId.toString(),
      onPause: u.onPause,
      roles: u.Role.map((r) => r.name),
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
      data: { Role: { set: roleIds } },
      include: { Role: true },
    });

    return {
      id: updated.id,
      username: updated.username,
      roles: updated.Role.map((r) => r.name),
    };
  }

  @Get('stats')
  async getWorkerStats() {
    const workers = await this.prisma.user.findMany({
      where: { Role: { some: { name: 'WORKER' } } },
      include: {
        Role: true,
        activeRequests: {
          select: { id: true, status: true, amount: true, completedAt: true, createdAt: true },
        },
        payedRequests: {
          select: { id: true, status: true, amount: true, completedAt: true, createdAt: true },
        },
      },
      orderBy: { username: 'asc' },
    });

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);
    monthAgo.setHours(0, 0, 0, 0);

    return workers.map((w) => {
      const completed = w.activeRequests.filter((r) => r.status === 'COMPLETED');
      const failed = w.activeRequests.filter((r) => r.status === 'FAILED');
      const active = w.activeRequests.filter((r) => r.status !== 'COMPLETED' && r.status !== 'FAILED');
      const totalAmount = completed.reduce((sum, r) => sum + r.amount, 0);

      // Time-based completed
      const completedToday = completed.filter((r) => r.completedAt && new Date(r.completedAt) >= today);
      const completedWeek = completed.filter((r) => r.completedAt && new Date(r.completedAt) >= weekAgo);
      const completedMonth = completed.filter((r) => r.completedAt && new Date(r.completedAt) >= monthAgo);

      const todayAmount = completedToday.reduce((sum, r) => sum + r.amount, 0);
      const weekAmount = completedWeek.reduce((sum, r) => sum + r.amount, 0);
      const monthAmount = completedMonth.reduce((sum, r) => sum + r.amount, 0);

      // Success rate
      const finishedTotal = completed.length + failed.length;
      const successRate = finishedTotal > 0 ? Math.round((completed.length / finishedTotal) * 100) : 0;

      // Avg completion time (minutes)
      const completionTimes = completed
        .filter((r) => r.completedAt)
        .map((r) => (new Date(r.completedAt!).getTime() - new Date(r.createdAt).getTime()) / 60000);
      const avgCompletionMin = completionTimes.length > 0
        ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length)
        : 0;
      const fastestMin = completionTimes.length > 0 ? Math.round(Math.min(...completionTimes)) : 0;

      // Streak — consecutive completed (latest first)
      const sorted = [...w.activeRequests].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      let streak = 0;
      for (const r of sorted) {
        if (r.status === 'COMPLETED') streak++;
        else break;
      }

      // Daily breakdown (last 7 days)
      const dailyCompleted: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(now);
        dayStart.setDate(dayStart.getDate() - i);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const count = completed.filter(
          (r) => r.completedAt && new Date(r.completedAt) >= dayStart && new Date(r.completedAt) < dayEnd,
        ).length;
        dailyCompleted.push(count);
      }

      return {
        id: w.id,
        username: w.username,
        telegramId: w.telegramId.toString(),
        onPause: w.onPause,
        roles: w.Role.map((r) => r.name),
        stats: {
          total: w.activeRequests.length,
          completed: completed.length,
          failed: failed.length,
          active: active.length,
          totalAmount,
          completedToday: completedToday.length,
          todayAmount,
          completedWeek: completedWeek.length,
          weekAmount,
          completedMonth: completedMonth.length,
          monthAmount,
          successRate,
          avgCompletionMin,
          fastestMin,
          streak,
          dailyCompleted,
        },
      };
    });
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
