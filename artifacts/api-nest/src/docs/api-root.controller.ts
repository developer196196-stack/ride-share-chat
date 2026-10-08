import { Controller, Get, Redirect } from '@nestjs/common';

@Controller()
export class ApiRootController {
  @Get()
  @Redirect('/api/docs', 302)
  apiRoot(): void {
    // Redirect handled by decorator
  }
}
