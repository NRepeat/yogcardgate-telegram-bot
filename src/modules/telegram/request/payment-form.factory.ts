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
          label: 'Номер карты',
        },
        {
          label: 'Сумма и валюта',
          description: 'например 15000 UAH',
        },
      ],
      sample: '5168742012345678\n15000 UAH',
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
          label: 'Сумма и валюта',
          description: 'например 1111€',
        },
        {
          label: 'Номер карты',
        },
        {
          label: 'ФИО латиницей',
          description: 'точно как на карте',
        },
      ],
      sample: '1111€\n4000000012345678\nJOHN DOE',
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
      ],
      sample: 'JOHN DOE\nDE44500105175407324931',
    },
    [PaymentMethodEnum.SKRILL_EMAIL]: {
      title: 'Skrill/email',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Email кошелька',
          description: 'например payoneer@mail.com',
        },
        {
          label: 'Сумма и валюта',
          description: 'например 1112 €',
        },
      ],
      sample: 'payoneer@mail.com\n1112 €',
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
          label: 'ФИО латиницей',
        },
        {
          label: 'Название банка',
          optional: true,
          description: 'желательно указать',
        },
      ],
      sample: 'AE450001234567890123456\nMOHAMMED ALI\nDubai Islamic Bank',
    },
  },
  [CurrencyEnum.USD]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'ФИО латиницей',
        },
        {
          label: 'Номер карты',
        },
      ],
      sample: 'JOHN DOE\n4000000012345678',
    },
    [PaymentMethodEnum.SKRILL_EMAIL]: {
      title: 'Payoneer / Skrill',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Email кошелька',
          description: 'например payoneer@mail.com',
        },
        {
          label: 'Сумма и валюта',
          description: 'например 1111$',
        },
      ],
      sample: 'payoneer@mail.com\n1111$',
    },
    [PaymentMethodEnum.BANK_ACCOUNT]: {
      title: 'WIRE',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'ФИО получателя латиницей',
        },
        {
          label: 'Номер счёта / wire реквизиты',
        },
        {
          label: 'Сумма и валюта',
          description: 'например 5000 USD',
          optional: true,
        },
      ],
      sample: 'JOHN DOE\n1234567890\n5000 USD',
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
      ],
      sample: 'JAN KOWALSKI\nPL27114020040000300201355387',
    },
  },
  [CurrencyEnum.THB]: {
    [PaymentMethodEnum.BANK_ACCOUNT]: {
      title: 'Банковский счёт',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Сумма и валюта',
          description: 'например 65000 THB',
        },
        {
          label: 'Номер счёта',
          description: 'например 3880523258',
        },
        {
          label: 'ФИО латиницей',
          description: 'например Worapan Kittiworaroot',
        },
        {
          label: 'Название банка',
        },
      ],
      sample: '65000 THB\n3880523258\nWorapan Kittiworaroot\nKrungthai Bank',
    },
  },
  [CurrencyEnum.CZK]: {
    [PaymentMethodEnum.BANK_ACCOUNT]: {
      title: 'účet',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Účet (номер счёта)',
          description: 'например 96092666/5500',
        },
        {
          label: 'ФИО латиницей',
        },
        {
          label: 'Сумма и валюта',
          description: 'например 10000 CZK',
        },
      ],
      sample: '96092666/5500\nKonstantynov Dmytro\n10000 CZK',
    },
  },
  [CurrencyEnum.KZT]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'ФИО латиницей',
        },
        {
          label: 'Номер карты',
          description: 'или укажите номер телефона ниже',
        },
        {
          label: 'Номер телефона',
          optional: true,
        },
      ],
      sample: 'SERIK NURKEN\n5169497777777777\n+77001234567',
    },
    [PaymentMethodEnum.PHONE]: {
      title: 'TEL-NUMBER',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'ФИО латиницей',
        },
        {
          label: 'Номер телефона',
        },
      ],
      sample: 'SERIK NURKEN\n+77001234567',
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
          label: 'Название банка',
        },
      ],
      sample: 'AHMET YILMAZ\nTR330006100519786457841326\nZiraat Bankası',
    },
  },
  [CurrencyEnum.AZN]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Номер карты',
        },
        {
          label: 'ФИО латиницей',
        },
        {
          label: 'Название банка',
        },
      ],
      sample: '5169497777777777\nSAMIR ALIYEV\nKapital Bank',
    },
  },
  [CurrencyEnum.CNY]: {
    [PaymentMethodEnum.QR]: {
      title: 'QR',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Сумма и валюта',
          description: 'например 2812 CNY',
        },
        {
          label: 'Идентификатор/название получателя',
          description: 'например Lub*************',
        },
        {
          label: 'ФИО латиницей',
          description: 'например LIUBCHANKA ILYA',
        },
      ],
      sample: '2812 CNY\nLub*****************\nLIUBCHANKA ILYA',
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
