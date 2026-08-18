import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin, callback) => {
      const explicitOrigins = [
        'http://localhost:5173',
        'https://neptune-admin.vercel.app',
        'https://neptunefrontend2.vercel.app',
        'https://web-two-ebon-72.vercel.app',
        'https://web-az4j3jhn7-enidu-maluddeniyas-projects.vercel.app',
      ];
      const allowed =
        !origin ||
        explicitOrigins.includes(origin) ||
        /^https:\/\/[a-z0-9-]+(-[a-z0-9]+)*\.vercel\.app$/i.test(origin);
      callback(null, allowed);
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;

  await app.listen(port, '0.0.0.0');
}

bootstrap();