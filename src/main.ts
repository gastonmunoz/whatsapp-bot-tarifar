import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors();
  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
  console.log(JSON.stringify({ event: 'bootstrap', port, ts: new Date().toISOString() }));
}

if (require.main === module) {
  bootstrap();
}

export { bootstrap };
