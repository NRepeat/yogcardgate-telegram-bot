import * as fs from 'fs';
import {
  CurrencyEnum,
  PaymentMethodEnum,
  PrismaClient,
  RoleEnum,
} from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

const currencies = [
  {
    code: 'UAH',
    name: CurrencyEnum.UAH,
    nameEn: CurrencyEnum.UAH,
    symbol: '₴',
  },
  {
    code: 'USD',
    name: CurrencyEnum.USD,
    nameEn: CurrencyEnum.USD,
    symbol: '$',
  },
  {
    code: 'EUR',
    name: CurrencyEnum.EUR,
    nameEn: CurrencyEnum.EUR,
    symbol: '€',
  },
  {
    code: 'PLN',
    name: CurrencyEnum.PLN,
    nameEn: CurrencyEnum.PLN,
    symbol: 'zł',
  },
  {
    code: 'THB',
    name: CurrencyEnum.THB,
    nameEn: CurrencyEnum.THB,
    symbol: '฿',
  },
  {
    code: 'CZK',
    name: CurrencyEnum.CZK,
    nameEn: CurrencyEnum.CZK,
    symbol: 'Kč',
  },
  {
    code: 'KZT',
    name: CurrencyEnum.KZT,
    nameEn: CurrencyEnum.KZT,
    symbol: '₸',
  },
  {
    code: 'TRY',
    name: CurrencyEnum.TRY,
    nameEn: CurrencyEnum.TRY,
    symbol: '₺',
  },
  {
    code: 'AZN',
    name: CurrencyEnum.AZN,
    nameEn: CurrencyEnum.AZN,
    symbol: '₼',
  },
  {
    code: 'CNY',
    name: CurrencyEnum.CNY,
    nameEn: CurrencyEnum.CNY,
    symbol: '¥',
  },
  {
    code: 'AED',
    name: CurrencyEnum.AED,
    nameEn: CurrencyEnum.AED,
    symbol: 'د.إ',
  },
];

// Дані для заповнення моделі PaymentMethod
const paymentMethods = [
  {
    nameEn: PaymentMethodEnum.CARD,
    description: 'Оплата по карте',
    descriptionEn: 'Card payment',
  },
  {
    nameEn: PaymentMethodEnum.IBAN,
    description: 'Оплата по IBAN',
    descriptionEn: 'IBAN transfer',
  },
  {
    nameEn: PaymentMethodEnum.WIRE,
    description: 'Оплата по номеру счета / ваер',
    descriptionEn: 'Wire transfer (bank account)',
  },
  {
    nameEn: PaymentMethodEnum.PHONE,
    description: 'Оплата по номеру телефона',
    descriptionEn: 'Phone number transfer',
  },
  {
    nameEn: PaymentMethodEnum.SKRILL,
    description: 'Skrill',
    descriptionEn: 'Skrill',
  },
  {
    nameEn: PaymentMethodEnum.PAYONEER,
    description: 'Payoneer',
    descriptionEn: 'Payoneer',
  },
  {
    nameEn: PaymentMethodEnum.QR,
    description: 'Оплата по QR-коду',
    descriptionEn: 'QR payment',
  },
  {
    nameEn: PaymentMethodEnum.KZT_KASPI_BANK,
    description: 'Kaspi Bank',
    descriptionEn: 'Kaspi Bank',
  },
  {
    nameEn: PaymentMethodEnum.KZT_OTHER_BANKS,
    description: 'Остальные банки',
    descriptionEn: 'Other Banks',
  },
  {
    nameEn: PaymentMethodEnum.CNY_ALIPAY,
    description: 'Alipay',
    descriptionEn: 'Alipay',
  },
  {
    nameEn: PaymentMethodEnum.CNY_WECHAT,
    description: 'WeChat Pay',
    descriptionEn: 'WeChat Pay',
  },
  {
    nameEn: PaymentMethodEnum.CNY_CARD,
    description: 'Оплата по карте',
    descriptionEn: 'Card payment',
  },
  {
    nameEn: PaymentMethodEnum.CNY_ACCOUNT,
    description: 'Оплата по номеру счета',
    descriptionEn: 'Account payment',
  },
];

const currencyPaymentMethodConfig: Record<CurrencyEnum, PaymentMethodEnum[]> = {
  [CurrencyEnum.UAH]: [PaymentMethodEnum.CARD, PaymentMethodEnum.IBAN],
  [CurrencyEnum.USD]: [
    PaymentMethodEnum.CARD,
    PaymentMethodEnum.WIRE,
    PaymentMethodEnum.SKRILL,
    PaymentMethodEnum.PAYONEER,
  ],
  [CurrencyEnum.EUR]: [PaymentMethodEnum.CARD, PaymentMethodEnum.IBAN, PaymentMethodEnum.SKRILL],
  [CurrencyEnum.PLN]: [PaymentMethodEnum.IBAN],
  [CurrencyEnum.THB]: [PaymentMethodEnum.BANK],
  [CurrencyEnum.CZK]: [PaymentMethodEnum.BANK],
  [CurrencyEnum.KZT]: [PaymentMethodEnum.CARD, PaymentMethodEnum.KZT_KASPI_BANK, PaymentMethodEnum.KZT_OTHER_BANKS],
  [CurrencyEnum.TRY]: [PaymentMethodEnum.IBAN],
  [CurrencyEnum.AZN]: [PaymentMethodEnum.CARD],
  [CurrencyEnum.CNY]: [PaymentMethodEnum.QR, PaymentMethodEnum.CNY_ALIPAY, PaymentMethodEnum.CNY_WECHAT, PaymentMethodEnum.CNY_CARD, PaymentMethodEnum.CNY_ACCOUNT],
  [CurrencyEnum.AED]: [PaymentMethodEnum.IBAN],
};

// Дані для заповнення моделі Role
const roles = [
  { name: RoleEnum.ADMIN },
  { name: RoleEnum.WORKER },
  { name: RoleEnum.GUEST },
];

/**
 * Заповнює базу даних даними для моделі Role.
 */
async function seedRole() {
  console.log('Початок заповнення моделі Role...');
  try {
    const result = await prisma.role.createMany({
      data: roles,
      skipDuplicates: true,
    });
    console.log(
      `Заповнення моделі Role завершено. Вставлено ${result.count} записів.`,
    );
  } catch (e) {
    console.error('Сталася помилка під час заповнення моделі Role:', e);
    process.exit(1);
  }
}

/**
 * Заповнює базу даних даними для моделі Currency.
 */
async function seedCurrency() {
  console.log('Початок заповнення моделі Currency...');
  try {
    const result = await prisma.currency.createMany({
      data: currencies,
      skipDuplicates: true,
    });
    console.log(
      `Заповнення моделі Currency завершено. Вставлено ${result.count} записів.`,
    );
  } catch (e) {
    console.error('Сталася помилка під час заповнення моделі Currency:', e);
    process.exit(1);
  }
}

/**
 * Заповнює базу даних даними для моделі PaymentMethod.
 */
async function seedPaymentMethod() {
  console.log('Початок заповнення моделі PaymentMethod...');
  try {
    const result = await prisma.paymentMethod.createMany({
      data: paymentMethods,
      skipDuplicates: true,
    });
    console.log(
      `Заповнення моделі PaymentMethod завершено. Вставлено ${result.count} записів.`,
    );
  } catch (e) {
    console.error(
      'Сталася помилка під час заповнення моделі PaymentMethod:',
      e,
    );
    process.exit(1);
  }
}

async function seedCurrencyPaymentMethods() {
  console.log('Початок привʼязки методів оплати до валют...');
  try {
    const paymentMethodsInDb = await prisma.paymentMethod.findMany({
      where: {
        nameEn: {
          in: Object.values(PaymentMethodEnum),
        },
      },
      select: { nameEn: true },
    });
    if (paymentMethodsInDb.length === 0) {
      console.warn('Методи оплати відсутні. Пропускаємо крок привʼязки.');
      return;
    }

    const availableMethods = new Set(
      paymentMethodsInDb.map((method) => method.nameEn),
    );

    const currenciesInDb = await prisma.currency.findMany({
      where: {
        name: {
          in: Object.values(CurrencyEnum),
        },
      },
      select: { id: true, name: true },
    });

    for (const currency of currenciesInDb) {
      const targetMethods =
        currencyPaymentMethodConfig[currency.name as CurrencyEnum] || [];

      const methodsToConnect = targetMethods
        .filter((method) => availableMethods.has(method))
        .map((method) => ({ nameEn: method }));

      if (methodsToConnect.length === 0) {
        continue;
      }

      await prisma.currency.update({
        where: { id: currency.id },
        data: {
          paymentMethod: {
            set: methodsToConnect,
          },
        },
      });
    }

    console.log(
      `Методи оплати привʼязані до ${currenciesInDb.length} валют(и).`,
    );
  } catch (e) {
    console.error(
      'Сталася помилка під час привʼязки методів оплати до валют:',
      e,
    );
    process.exit(1);
  }
}

/**
 * Заповнює базу даних даними для моделі Rates.
 */
async function seedRates() {
  console.log('Початок заповнення моделі Rates...');
  try {
    const currenciesInDb = await prisma.currency.findMany({
      where: {
        name: {
          in: Object.values(CurrencyEnum),
        },
      },
      select: { id: true, name: true },
    });
    const paymentMethodsInDb = await prisma.paymentMethod.findMany({
      where: {
        nameEn: {
          in: Object.values(PaymentMethodEnum),
        },
      },
      select: { id: true, nameEn: true },
    });

    if (!currenciesInDb.length || !paymentMethodsInDb.length) {
      console.error(
        'Відсутні дані для створення курсів. Переконайтеся, що Currency та PaymentMethod заповнені.',
      );
      return;
    }

    const currencyMap = new Map(
      currenciesInDb.map((currency) => [currency.name as CurrencyEnum, currency.id]),
    );
    const paymentMethodMap = new Map(
      paymentMethodsInDb.map((method) => [method.nameEn as PaymentMethodEnum, method.id]),
    );

    const rateConfig: Record<
      CurrencyEnum,
      {
        method: PaymentMethodEnum;
        minAmount: number;
        maxAmount: number;
        rate: number;
      }[]
    > = {
      [CurrencyEnum.UAH]: [
        {
          method: PaymentMethodEnum.CARD,
          minAmount: 50,
          maxAmount: 50000,
          rate: 1,
        },
      ],
      [CurrencyEnum.USD]: [
        {
          method: PaymentMethodEnum.CARD,
          minAmount: 50,
          maxAmount: 20000,
          rate: 37.5,
        },
        {
          method: PaymentMethodEnum.WIRE,
          minAmount: 500,
          maxAmount: 100000,
          rate: 37.2,
        },
        {
          method: PaymentMethodEnum.SKRILL,
          minAmount: 500,
          maxAmount: 100000,
          rate: 37.2,
        },
        {
          method: PaymentMethodEnum.PAYONEER,
          minAmount: 500,
          maxAmount: 100000,
          rate: 37.2,
        },
      ],
      [CurrencyEnum.EUR]: [
        {
          method: PaymentMethodEnum.CARD,
          minAmount: 50,
          maxAmount: 15000,
          rate: 41.8,
        },
        {
          method: PaymentMethodEnum.IBAN,
          minAmount: 100,
          maxAmount: 100000,
          rate: 41.5,
        },
        {
          method: PaymentMethodEnum.SKRILL,
          minAmount: 500,
          maxAmount: 100000,
          rate: 41.5,
        },
      
      ],
      [CurrencyEnum.AED]: [
        {
          method: PaymentMethodEnum.IBAN,
          minAmount: 100,
          maxAmount: 120000,
          rate: 10.2,
        },
      ],
      [CurrencyEnum.PLN]: [
        {
          method: PaymentMethodEnum.IBAN,
          minAmount: 200,
          maxAmount: 90000,
          rate: 9.5,
        },
      ],
      [CurrencyEnum.THB]: [
        {
          method: PaymentMethodEnum.BANK,
          minAmount: 500,
          maxAmount: 120000,
          rate: 1.05,
        },
      ],
      [CurrencyEnum.CZK]: [
        {
          method: PaymentMethodEnum.BANK,
          minAmount: 500,
          maxAmount: 150000,
          rate: 1.6,
        },
      ],
      [CurrencyEnum.KZT]: [
        {
          method: PaymentMethodEnum.CARD,
          minAmount: 5000,
          maxAmount: 200000,
          rate: 0.092, // Base rate for Kaspi Bank
        },
        {
          method: PaymentMethodEnum.KZT_KASPI_BANK,
          minAmount: 5000,
          maxAmount: 200000,
          rate: 0.092, // Kaspi Bank rate
        },
        {
          method: PaymentMethodEnum.KZT_OTHER_BANKS,
          minAmount: 5000,
          maxAmount: 200000,
          rate: 0.0966, // Other banks rate (5% higher)
        },
      ],
      [CurrencyEnum.TRY]: [
        {
          method: PaymentMethodEnum.IBAN,
          minAmount: 500,
          maxAmount: 80000,
          rate: 1.25,
        },
      ],
      [CurrencyEnum.AZN]: [
        {
          method: PaymentMethodEnum.CARD,
          minAmount: 300,
          maxAmount: 80000,
          rate: 21.8,
        },
      ],
      [CurrencyEnum.CNY]: [
        {
          method: PaymentMethodEnum.QR,
          minAmount: 500,
          maxAmount: 100000,
          rate: 5.25,
        },
        {
          method: PaymentMethodEnum.CNY_ALIPAY,
          minAmount: 500,
          maxAmount: 100000,
          rate: 5.25,
        },
        {
          method: PaymentMethodEnum.CNY_WECHAT,
          minAmount: 500,
          maxAmount: 100000,
          rate: 5.25,
        },
        {
          method: PaymentMethodEnum.CNY_CARD,
          minAmount: 500,
          maxAmount: 100000,
          rate: 5.30,
        },
        {
          method: PaymentMethodEnum.CNY_ACCOUNT,
          minAmount: 500,
          maxAmount: 100000,
          rate: 5.30,
        },
      ],
    };

    const ratesToInsert = [] as {
      currencyId: string;
      paymentMethodId: string;
      minAmount: number;
      maxAmount: number;
      rate: number;
    }[];

    for (const [currency, configs] of Object.entries(rateConfig) as [
      CurrencyEnum,
      {
        method: PaymentMethodEnum;
        minAmount: number;
        maxAmount: number;
        rate: number;
      }[],
    ][]) {
      const currencyId = currencyMap.get(currency);
      if (!currencyId) {
        continue;
      }
      for (const config of configs) {
        const methodId = paymentMethodMap.get(config.method);
        if (!methodId) {
          continue;
        }
        ratesToInsert.push({
          currencyId,
          paymentMethodId: methodId,
          minAmount: config.minAmount,
          maxAmount: config.maxAmount,
          rate: config.rate,
        });
      }
    }

    if (!ratesToInsert.length) {
      console.warn('Немає курсів для вставки. Пропускаємо seedRates.');
      return;
    }

    const result = await prisma.rates.createMany({
      data: ratesToInsert,
      skipDuplicates: true,
    });
    console.log(
      `Заповнення моделі Rates завершено. Вставлено ${result.count} записів.`,
    );
  } catch (e) {
    console.error('Сталася помилка під час заповнення моделі Rates:', e);
    process.exit(1);
  }
}

// Функція для аналізу рядка з SQL-дампу
function parseSqlLine(line: string) {
  // Використовуємо регулярний вираз для вилучення даних
  // Він шукає три групи значень у лапках або NULL
  const regex = /'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*NULL/;
  const match = line.match(regex);
  if (match) {
    // Повертаємо об'єкт з вилученими даними
    return {
      number: match[1],
      bankName: match[2],
      bankNameEn: match[3],
      icon: null,
    };
  }
  return null;
}

/**
 * Заповнює базу даних даними для моделі CardBank.
 * Зчитує дані з файлу SQL-дампу.
 */
async function seedCardBank() {
  console.log('Початок заповнення моделі CardBank...');

  const dumpFilePath = path.join(__dirname, 'dump-klimp2p-202506291411.sql');
  let cardBanks = [] as any;

  try {
    const fileContent = fs.readFileSync(dumpFilePath, 'utf-8');
    const lines = fileContent
      .split('\n')
      .filter((line) => line.startsWith('(') && line.endsWith('),'));
    cardBanks = lines.map((line) => parseSqlLine(line)).filter(Boolean);

    console.log(
      `Знайдено ${cardBanks.length} записів для вставки в модель CardBank.`,
    );
  } catch (error) {
    console.error('Помилка зчитування або аналізу файлу для CardBank:', error);
    process.exit(1);
  }

  try {
    const result = await prisma.cardBank.createMany({
      data: cardBanks,
      skipDuplicates: true,
    });
    console.log(
      `Заповнення моделі CardBank завершено. Вставлено ${result.count} записів.`,
    );
  } catch (e) {
    console.error('Сталася помилка під час заповнення моделі CardBank:', e);
    process.exit(1);
  }
}

async function main() {
  console.log('Початок заповнення бази даних...');

  // Викликаємо функції заповнення для кожної моделі
  await seedRole();
  await seedCurrency();
  await seedPaymentMethod();
  await seedCurrencyPaymentMethods();
  await seedRates();
  await seedCardBank();

  console.log('Заповнення всіх моделей завершено.');

  await prisma.$disconnect();
}

// Запускаємо головну функцію
main();
