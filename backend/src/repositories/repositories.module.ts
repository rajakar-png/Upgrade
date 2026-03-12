import { Global, Module } from '@nestjs/common';
import { UserRepository, ServerRepository } from './repositories';

@Global()
@Module({
  providers: [UserRepository, ServerRepository],
  exports: [UserRepository, ServerRepository],
})
export class RepositoriesModule {}
