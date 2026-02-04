import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

async function seedVendors() {
  console.log('Початок заповнення моделі Vendors...');

  const csvPath = path.join(__dirname, 'vendors.csv');
  let lines: string[];

  try {
    const content = fs.readFileSync(csvPath, 'utf-8');
    lines = content.split('\n').filter((line) => line.trim().length > 0);
  } catch (error) {
    console.error('Помилка зчитування CSV файлу:', error);
    process.exit(1);
  }

  // Skip header row
  const header = parseCsvLine(lines[0]);
  const dataLines = lines.slice(1);

  const chatIdIdx = header.indexOf('chat_id');
  const providerIdx = header.indexOf('provider');
  const apiKeyIdx = header.indexOf('api_key');
  const lastReportIdx = header.indexOf('last_report');
  const offIdx = header.indexOf('off');

  let inserted = 0;
  let skipped = 0;

  for (const line of dataLines) {
    const fields = parseCsvLine(line);

    const chatIdRaw = fields[chatIdIdx];
    const provider = fields[providerIdx];
    const apiKey = fields[apiKeyIdx];
    const lastReport = fields[lastReportIdx];
    const off = fields[offIdx];

    if (!chatIdRaw || !provider) {
      skipped++;
      continue;
    }

    const chatId = BigInt(chatIdRaw);
    const work = off === '0';
    const token = apiKey || null;
    const lastReportedAt = lastReport ? new Date(lastReport) : null;

    try {
      await prisma.vendors.upsert({
        where: { chatId },
        update: {},
        create: {
          chatId,
          title: provider,
          work,
          token,
          lastReportedAt,
        },
      });
      inserted++;
    } catch (e) {
      console.error(`Помилка вставки вендора "${provider}":`, e);
      skipped++;
    }
  }

  console.log(
    `Заповнення моделі Vendors завершено. Вставлено ${inserted} записів, пропущено ${skipped}.`,
  );
}

async function main() {
  await seedVendors();
  await prisma.$disconnect();
}

main();
