import { CurrencyEnum, PaymentMethodEnum } from '@prisma/client';
import {
  PaymentFormConfig,
  PaymentFormRegistry,
  PaymentMethodFormDefinition,
} from 'src/types/types';

const DEFAULT_INTRO =
  'отправьте, пожалуйста, данные строками в указанном порядке:';

const FORM_REGISTRY: PaymentFormRegistry = {
  [CurrencyEnum.UAH]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Номер карты - Сумма',
        },
      ],
      sample: '5168742012345678 15000',
      notes: ['Проверьте, что карта активна и принимает платежи.'],
    },
    [PaymentMethodEnum.IBAN]: {
      title: 'IBAN',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'ФИО латиницей',
        },
        {
          label: 'IBAN',
          description: 'формат UAxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        },
        {
          label: 'ИНН (8 или 10 цифр)',
        },
        {
          label: 'Сумма',
          description: 'например 10000.00',
        },
        {
          label: 'Комментарий',
          optional: true,
        },
      ],
      sample:
        'IVAN IVANOV\nUA123456789012345678901234567\n1234567890\n10000.00\nОплата услуг',
    },
  },
  [CurrencyEnum.EUR]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Номер карты - Сумма',
        },
        {
          label: 'ФИО латиницей',
          description: 'точно как на карте',
        },
      ],
      sample: '4000000012345678 1111 JOHN DOE',
    },
    [PaymentMethodEnum.IBAN]: {
      title: 'IBAN',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'ФИО латиницей',
        },
        {
          label: 'IBAN',
        },
        {
          label: 'Сумма',
          description: 'например 1000.00',
        },
      ],
      sample: 'JOHN DOE\nDE00000000000000000000\n1000.00',
    },
    [PaymentMethodEnum.SKRILL]: {
      title: 'Skrill',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Email кошелька',
          description: 'например skrill@mail.com',
        },
        {
          label: 'Сумма и валюта',
          description: 'например 1112',
        },
      ],
      sample: 'skrill@mail.com\n1112',
    },
    [PaymentMethodEnum.PAYONEER]: {
      title: 'Payoneer',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Email кошелька',
          description: 'например payonner@mail.com',
        },
        {
          label: 'Сумма и валюта',
          description: 'например 1112',
        },
      ],
      sample: 'payonner@mail.com\n1112',
    },
    [PaymentMethodEnum.WISE]: {
      title: 'Wise',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Email кошелька',
          description: 'например wise@mail.com',
        },
        {
          label: 'ФИО латиницей',
          description: 'точно как в Wise',
        },
        {
          label: 'Номер карты Wise',
          optional: true,
          description: '16 цифр карты Wise',
        },
        {
          label: 'Сумма',
          description: 'например 1000',
        },
      ],
      sample: 'wise@mail.com\nJOHN DOE\n1000',
    },
  },
  [CurrencyEnum.AED]: {
    [PaymentMethodEnum.IBAN]: {
      title: 'IBAN',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'IBAN',
        },
        {
          label: 'Сумма',
          description: 'например 10000.00',
        },
        {
          label: 'ФИО латиницей',
        },
        {
          label: 'Название банка',
          description: 'Обязательно для AED',
        },
        {
          label: 'Сумма',
          description: 'например 10000.00',
        },
      ],
      sample: 'AE1111111111111111111111111\nMOHAMMED ALI\nBank Name\n10000.00',
    },
  },
  [CurrencyEnum.USD]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Номер карты - Сумма',
        },
        {
          label: 'ФИО латиницей',
          description: 'точно как на карте',
        },
      ],
      sample: '4000000012345678 1111 JOHN DOE',
    },
    [PaymentMethodEnum.SKRILL]: {
      title: 'Skrill',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Email кошелька',
          description: 'например skrill@mail.com',
        },
        {
          label: 'Сумма и валюта',
          description: 'например 1111',
        },
      ],
      sample: 'skrill@mail.com\n1111',
    },
    [PaymentMethodEnum.PAYONEER]: {
      title: 'Payoneer',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Email кошелька',
          description: 'например payoneer@mail.com',
        },
        {
          label: 'Сумма и валюта',
          description: 'например 1111',
        },
      ],
      sample: 'payoneer@mail.com\n1111',
    },
    [PaymentMethodEnum.WISE]: {
      title: 'Wise',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Email кошелька',
          description: 'например wise@mail.com',
        },
        {
          label: 'ФИО латиницей',
          description: 'точно как в Wise',
        },
        {
          label: 'Номер карты Wise',
          optional: true,
          description: '16 цифр карты Wise',
        },
        {
          label: 'Сумма',
          description: 'например 5000',
        },
      ],
      sample: 'wise@mail.com\nJOHN DOE\n5000',
    },
    [PaymentMethodEnum.PAYPAL]: {
      title: 'PayPal',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Email PayPal',
          description: 'например paypal@mail.com',
        },
        {
          label: 'ФИО латиницей',
          description: 'точно как в PayPal',
        },
        {
          label: 'Сумма',
          description: 'например 5000',
        },
      ],
      sample: 'paypal@mail.com\nJOHN DOE\n5000',
    },
  },
  [CurrencyEnum.PLN]: {
    [PaymentMethodEnum.IBAN]: {
      title: 'IBAN',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'ФИО латиницей',
        },
        {
          label: 'IBAN / номер счёта',
        },
        {
          label: 'Сумма',
          description: 'например 1000.00',
        },
      ],
      sample: 'NAME SURNAME\nPL00000000000000000000000000\n1000.00',
    },
  },
  [CurrencyEnum.THB]: {
    [PaymentMethodEnum.BANK]: {
      title: 'Bank payment',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'ФИО',
          description: 'Например NAME SURNAME',
        },

        {
          label: 'Сумма',
          description: 'Например 10000',
        },
        {
          label: 'Номер счета',
          description: '0123456789',
        },
        {
          label: 'Название банка',
        },
      ],
      sample: 'NAME SURNAME\n10000\n00000000\nBank Name',
    },
  },
  [CurrencyEnum.CZK]: {
    [PaymentMethodEnum.BANK]: {
      title: 'Bank payment',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'ФИО',
          description: 'Например NAME SURNAME',
        },

        {
          label: 'Сумма и валюта',
          description: 'Например 10000',
        },
        {
          label: 'Номер счета',
          description: '12345678/2200',
        },
        {
          label: 'Название банка',
          description: 'Обязательно для CZK',
        },
      ],
      sample: 'NAME SURNAME\n10000\n00000000/0000\nBank Name',
    },
  },
  [CurrencyEnum.KZT]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Номер карты Сумма',
        },
      ],
      sample: '0000000000000000 100000',
    },
    [PaymentMethodEnum.KZT_KASPI_BANK]: {
      title: 'Kaspi Bank',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Номер карты - Сумма',
        },
      ],
      sample: '0000000000000000 100000',
      notes: ['Оплата через Kaspi Bank'],
    },
    [PaymentMethodEnum.KZT_OTHER_BANKS]: {
      title: 'Остальные банки',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Номер карты - Сумма',
        },
      ],
      sample: '0000000000000000 100000',
      notes: ['Оплата через другие банки'],
    },
    [PaymentMethodEnum.PHONE]: {
      title: 'TEL-NUMBER',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'ФИО латиницей Номер телефона Сумма',
        },
      ],
      sample: 'NAME SURNAME 77000000000',
    },
  },
  [CurrencyEnum.TRY]: {
    [PaymentMethodEnum.IBAN]: {
      title: 'IBAN',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'ФИО латиницей',
        },
        {
          label: 'IBAN',
        },
        {
          label: 'Сумма',
          description: 'например 10000.00',
        },
        {
          label: 'Название банка',
        },
      ],
      sample: 'NAME SURNAME\nTR000000000000000000000000\n10000.00\nBank Name',
    },
  },
  [CurrencyEnum.AZN]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Номер карты - Сумма',
        },
        {
          label: 'Сумма',
          description: 'например 10000.00',
        },
        {
          label: 'ФИО латиницей',
          description: 'точно как на карте',
        },
        {
          label: 'Название банка',
        },
      ],
      sample: '4000000012345678 1111 JOHN DOE',
    },
  },
  [CurrencyEnum.CNY]: {
    [PaymentMethodEnum.CNY_ALIPAY]: {
      title: 'Alipay',
      intro: 'отправьте фото с подписью (сумма в подписи):',
      fields: [
        {
          label: 'Фото',
          description: 'скриншот перевода',
        },
        {
          label: 'Сумма',
          description: 'в подписи к фото, например 2812',
        },
      ],
      sample: '3000',
      notes: ['Отправьте фото + сумма в подписи'],
    },
    [PaymentMethodEnum.CNY_WECHAT]: {
      title: 'WeChat Pay',
      intro: 'отправьте фото с подписью (сумма в подписи):',
      fields: [
        {
          label: 'Фото',
          description: 'скриншот перевода',
        },
        {
          label: 'Сумма',
          description: 'в подписи к фото, например 2812',
        },
      ],
      sample: '3000',
      notes: ['Отправьте фото + сумма в подписи'],
    },
    [PaymentMethodEnum.CNY_CARD]: {
      title: 'Оплата по карте',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Номер карты - Сумма',
        },
        {
          label: 'ФИО на китайском',
          description: 'точно как на карте',
        },
      ],
      sample: '4000000012345678 3000 张三',
      notes: ['Оплата по китайской карте'],
    },
  },
};

export class PaymentFormFactory {
  static getForm(
    currency: CurrencyEnum,
    method: PaymentMethodEnum,
  ): PaymentMethodFormDefinition | null {
    return FORM_REGISTRY[currency]?.[method] ?? null;
  }

  static getCurrencyConfig(currency: CurrencyEnum): PaymentFormConfig | null {
    const forms = FORM_REGISTRY[currency];
    if (!forms) {
      return null;
    }
    return {
      currency,
      forms,
    };
  }
}
