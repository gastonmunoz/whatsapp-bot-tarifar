import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Request, Response } from 'express';
import { AppModule } from '../src/app.module';

const server = express();
let bootstrapped: Promise<void> | null = null;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), { logger: ['log', 'warn', 'error'] });
  app.enableCors();
  await app.init();
}

export default async function handler(req: Request, res: Response): Promise<void> {
  if (!bootstrapped) bootstrapped = bootstrap();
  await bootstrapped;
  server(req, res);
}
