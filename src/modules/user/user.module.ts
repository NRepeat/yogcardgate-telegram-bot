import { Module } from '@nestjs/common';
import UserRepository from './user.repo';
import { UserService } from './user.service';
import { UserApiController } from './user.api.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UserApiController],
  providers: [UserRepository, UserService],
  exports: [UserService, UserRepository],
})
export class UserModule {}
