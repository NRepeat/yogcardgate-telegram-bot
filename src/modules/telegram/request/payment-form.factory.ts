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
      sample: 'JOHN DOE\nDE44500105175407324931\n1000.00',
    },
    [PaymentMethodEnum.SKRILL_EMAIL]: {
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
     
        },
        {
          label: "Сумма",
          description: "например 10000.00",
        }
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
    [PaymentMethodEnum.SKRILL_EMAIL]: {
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
    [PaymentMethodEnum.WIRE]: {
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
          description: 'например 5000',
          optional: true,
        },
      ],
      sample: 'JOHN DOE\n1234567890\n5000',
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
    [PaymentMethodEnum.WIRE]: {
      title: 'Банковский счёт',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Сумма и валюта',
          description: 'например 65000',
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
      sample: '50000 \n0000000000\nNAME SURNAME\nBank Name',
    },   [PaymentMethodEnum.BANK]:{
      title: 'Bank payment',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'ФИО',
          description: 'Например 96092666/5500',
        },
  
        {
          label: 'Сумма',
          description: 'Например 10000',
        },
        {
          label:"Номер счета",
          description:"0123456789"
        },
        {
          label:"Название банка"
        }
      ],
      sample: '00000000/0000\nNAME SURNAME\n10000',
    }
  },
  [CurrencyEnum.CZK]: {
    [PaymentMethodEnum.WIRE]: {
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
          label: 'Сумма',
          description: 'например 10000',
        },
      ],
      sample: '00000000/0000\nNAME SURNAME\n10000',
    },
    [PaymentMethodEnum.BANK]:{
      title: 'Bank payment',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'ФИО',
          description: 'Например 96092666/5500',
        },
  
        {
          label: 'Сумма и валюта',
          description: 'Например 10000',
        },
        {
          label:"Номер счета",
          description:"12345678/2200"
        },
        {
          label:"Название банка"
        }
      ],
      sample: '00000000/0000\nNAME SURNAME\n10000',
    }
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
          label: 'ФИО латиницей',
          description: 'точно как на карте',
        },
      ],
      sample: '4000000012345678 1111 JOHN DOE',
    },
  },
  [CurrencyEnum.CNY]: {
    [PaymentMethodEnum.QR]: {
      title: 'QR',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Сумма и валюта',
          description: 'например 2812',
        },
        {
          label: 'Идентификатор/название получателя',
          description: 'например Lub*************',
        },
        {
          label: 'ФИО латиницей',
        },
      ],
      sample: '3000\nRECIPIENT IDENTIFIER\nNAME SURNAME',
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
