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
    [PaymentMethodEnum.IBAN_COMPANY]: {
      title: 'IBAN с ФОП на ФОП/ТОВ',
      intro: DEFAULT_INTRO,
      fields: [
        {
          label: 'Название компании / ФИО латиницей',
        },
        {
          label: 'IBAN',
          description: 'формат UAxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        },
        {
          label: 'ИНН / ЕДРПОУ (8 или 10 цифр)',
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
        'TOV PRYKLAD\nUA123456789012345678901234567\n12345678\n10000.00\nОплата услуг',
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
        {
          label: 'Название банка',
        },
      ],
      sample: '0000000000000000 100000 BANK',
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
          label: 'Номер карты - Сумма - ФИО латиницей',
          description: 'точно как на карте',
        },
        {
          label: 'Название банка',
        },
      ],
      sample: '4000000012345678 1111 JOHN DOE\nBank Name',
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
  [CurrencyEnum.GBP]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Номер карты' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Название банка' },
        { label: 'Номер счёта (Account Number)' },
        { label: 'Сумма', description: 'например 1000.00' },
        { label: 'Sort Code', optional: true, description: 'формат 12-34-56' },
      ],
      sample: '4000000012345678\nJOHN DOE\nBarclays\n12345678\n1000.00\n12-34-56',
    },
    [PaymentMethodEnum.IBAN]: {
      title: 'IBAN',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'IBAN' },
        { label: 'Номер счёта (Account Number)' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Название банка' },
        { label: 'Сумма', description: 'например 1000.00' },
        { label: 'Sort Code', optional: true, description: 'формат 12-34-56' },
        { label: 'Назначение платежа', optional: true },
      ],
      sample: 'GB00XXXX00000000000000\n12345678\nJOHN DOE\nBarclays\n1000.00',
    },
    [PaymentMethodEnum.WISE]: {
      title: 'Wise',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Email Wise' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Номер карты' },
        { label: 'Номер счёта (Account Number)' },
        { label: 'Sort Code', description: 'формат 12-34-56' },
        { label: 'Сумма', description: 'например 1000.00' },
        { label: 'Назначение платежа', optional: true },
      ],
      sample: 'wise@mail.com\nJOHN DOE\n4000000012345678\n12345678\n12-34-56\n1000.00',
    },
    [PaymentMethodEnum.PAYPAL]: {
      title: 'PayPal',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Email PayPal' },
        { label: 'Сумма', description: 'например 1000.00' },
      ],
      sample: 'paypal@mail.com\n1000.00',
    },
    [PaymentMethodEnum.REVOLUT]: {
      title: 'Revolut',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Номер карты' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Название банка' },
        { label: 'Номер счёта (Account Number)' },
        { label: 'Сумма', description: 'например 1000.00' },
        { label: 'Sort Code', optional: true, description: 'формат 12-34-56' },
      ],
      sample: '4000000012345678\nJOHN DOE\nRevolut\n12345678\n1000.00',
    },
  },
  [CurrencyEnum.SEK]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Номер карты' },
        { label: 'ФИО латиницей' },
        { label: 'Название банка' },
        { label: 'Сумма', description: 'например 10000' },
      ],
      sample: '4000000012345678\nSVEN SVENSSON\nSwedbank\n10000',
    },
    [PaymentMethodEnum.IBAN]: {
      title: 'IBAN',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Номер карты' },
        { label: 'IBAN' },
        { label: 'ФИО латиницей' },
        { label: 'Название банка' },
        { label: 'Сумма', description: 'например 10000' },
      ],
      sample: '4000000012345678\nSE0000000000000000000000\nSVEN SVENSSON\nSwedbank\n10000',
    },
  },
  [CurrencyEnum.MDL]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Номер карты' },
        { label: 'ФИО латиницей' },
        { label: 'Название банка' },
        { label: 'Телефон', description: 'например +37360000000' },
        { label: 'Сумма', description: 'например 5000' },
      ],
      sample: '4000000012345678\nION POPESCU\nMAIB\n+37360000000\n5000',
    },
  },
  [CurrencyEnum.AMD]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Номер счёта' },
        { label: 'Номер карты' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Название банка' },
        { label: 'Сумма', description: 'например 100000' },
      ],
      sample: '1234567890123456\n4000000012345678\nARAM ARAMYAN\nAmeriabank\n100000',
    },
    [PaymentMethodEnum.AMD_IDRAM]: {
      title: 'Idram',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Аккаунт Idram', description: '6-12 цифр' },
        { label: 'Номер карты' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Сумма', description: 'например 100000' },
      ],
      sample: '12345678\n4000000012345678\nARAM ARAMYAN\n100000',
    },
  },
  [CurrencyEnum.KGS]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Номер карты' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Название банка' },
        { label: 'Сумма', description: 'например 50000' },
      ],
      sample: '4000000012345678\nAIBEK AIBEKOV\nOptima Bank\n50000',
    },
    [PaymentMethodEnum.KGS_ELCART]: {
      title: 'Elcart',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Номер карты Elcart' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Телефон', description: 'например +996700000000' },
        { label: 'Сумма', description: 'например 50000' },
      ],
      sample: '9417000000000000\nAIBEK AIBEKOV\n+996700000000\n50000',
    },
  },
  [CurrencyEnum.BGN]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Номер карты' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Название банка' },
        { label: 'Сумма', description: 'например 2000' },
      ],
      sample: '4000000012345678\nIVAN IVANOV\nDSK Bank\n2000',
    },
    [PaymentMethodEnum.IBAN]: {
      title: 'IBAN',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Номер карты' },
        { label: 'IBAN' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Название банка' },
        { label: 'Сумма', description: 'например 2000' },
      ],
      sample: '4000000012345678\nBG00XXXX00000000000000\nIVAN IVANOV\nDSK Bank\n2000',
    },
  },
  [CurrencyEnum.HUF]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Номер карты' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Название банка' },
        { label: 'Сумма', description: 'например 300000' },
      ],
      sample: '4000000012345678\nNAGY ISTVAN\nOTP Bank\n300000',
    },
  },
  [CurrencyEnum.GEL]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'IBAN' },
        { label: 'Название банка' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Сумма', description: 'например 3000' },
        {
          label: 'Отдельное направление',
          optional: true,
          description: 'Credo Bank / Liberty Bank / Basis Bank',
        },
      ],
      sample: 'GE00XX0000000000000000\nTBC Bank\nGIORGI GIORGADZE\n3000',
    },
    [PaymentMethodEnum.IBAN]: {
      title: 'IBAN',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'IBAN' },
        { label: 'Название банка' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Сумма', description: 'например 3000' },
        {
          label: 'Отдельное направление',
          optional: true,
          description: 'Credo Bank / Liberty Bank / Basis Bank',
        },
      ],
      sample: 'GE00XX0000000000000000\nTBC Bank\nGIORGI GIORGADZE\n3000',
    },
  },
  [CurrencyEnum.TJS]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Номер карты' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Название банка' },
        { label: 'Сумма', description: 'например 10000' },
      ],
      sample: '4000000012345678\nFIRDAVS RAHIMOV\nDushanbe City Bank\n10000',
    },
  },
  [CurrencyEnum.INR]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'IFSC код', description: 'например SBIN0001234' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Название банка' },
        { label: 'Номер карты' },
        { label: 'Сумма', description: 'например 50000' },
        { label: 'Номер счёта', optional: true },
      ],
      sample: 'SBIN0001234\nRAHUL SHARMA\nSBI\n4000000012345678\n50000',
    },
    [PaymentMethodEnum.IBAN]: {
      title: 'Банковский счёт',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'IFSC код', description: 'например SBIN0001234' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Название банка' },
        { label: 'Номер счёта' },
        { label: 'Сумма', description: 'например 50000' },
      ],
      sample: 'SBIN0001234\nRAHUL SHARMA\nSBI\n12345678901\n50000',
    },
    [PaymentMethodEnum.INR_UPI]: {
      title: 'UPI',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'UPI ID', description: 'например user@bank' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Сумма', description: 'например 50000' },
      ],
      sample: 'rahul@sbi\nRAHUL SHARMA\n50000',
    },
    [PaymentMethodEnum.INR_PAYTM]: {
      title: 'Paytm',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Paytm кошелёк', description: 'телефон, например +919876543210' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Сумма', description: 'например 50000' },
      ],
      sample: '+919876543210\nRAHUL SHARMA\n50000',
    },
  },
  [CurrencyEnum.IDR]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Номер счёта' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Название банка' },
        { label: 'Сумма', description: 'например 1000000' },
        { label: 'Назначение платежа', optional: true },
      ],
      sample: '1234567890\nBUDI SANTOSO\nBCA\n1000000',
    },
    [PaymentMethodEnum.IBAN]: {
      title: 'Банковский счёт',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Номер счёта' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Название банка' },
        { label: 'Сумма', description: 'например 1000000' },
        { label: 'Назначение платежа', optional: true },
      ],
      sample: '1234567890\nBUDI SANTOSO\nBCA\n1000000',
    },
  },
  [CurrencyEnum.RON]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Номер карты' },
        { label: 'IBAN' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Название банка' },
        { label: 'Сумма', description: 'например 5000' },
      ],
      sample: '4000000012345678\nRO00XXXX0000000000000000\nION POPESCU\nBanca Transilvania\n5000',
    },
    [PaymentMethodEnum.IBAN]: {
      title: 'IBAN',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'IBAN' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Название банка' },
        { label: 'Сумма', description: 'например 5000' },
        { label: 'Назначение платежа', optional: true },
      ],
      sample: 'RO00XXXX0000000000000000\nION POPESCU\nBanca Transilvania\n5000',
    },
  },
  [CurrencyEnum.BRL]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'CPF', description: 'формат 000.000.000-00' },
        { label: 'Сумма', description: 'например 5000' },
      ],
      sample: 'JOAO SILVA\n000.000.000-00\n5000',
    },
    [PaymentMethodEnum.BRL_PIX]: {
      title: 'Pix',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Pix ключ' },
        { label: 'Сумма', description: 'например 5000' },
        { label: 'CPF', optional: true, description: 'формат 000.000.000-00' },
      ],
      sample: 'JOAO SILVA\npix-key-123\n5000',
    },
    [PaymentMethodEnum.BRL_ATM_QR]: {
      title: 'ATM QR-код',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Telegram', description: 'например @username' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Сумма', description: 'например 5000' },
        { label: 'Pix ключ', optional: true },
        { label: 'CPF', optional: true, description: 'формат 000.000.000-00' },
      ],
      sample: '@joaosilva\nJOAO SILVA\n5000',
    },
  },
  [CurrencyEnum.ARS]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Название банка' },
        { label: 'Сумма', description: 'например 100000' },
        { label: 'CVU / CBU / SBU', optional: true },
      ],
      sample: 'JUAN PEREZ\nBanco Nacion\n100000',
    },
    [PaymentMethodEnum.IBAN]: {
      title: 'Банковский счёт',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Название банка' },
        { label: 'Сумма', description: 'например 100000' },
        { label: 'CVU / CBU / SBU', optional: true },
      ],
      sample: 'JUAN PEREZ\nBanco Nacion\n100000',
    },
    [PaymentMethodEnum.ARS_MERCADO_PAGO]: {
      title: 'Mercado Pago',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Название банка' },
        { label: 'Сумма', description: 'например 100000' },
        { label: 'CVU / CBU / SBU', optional: true },
      ],
      sample: 'JUAN PEREZ\nMercado Pago\n100000',
    },
  },
  [CurrencyEnum.VND]: {
    [PaymentMethodEnum.CARD]: {
      title: 'CARD',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'Номер счёта' },
        { label: 'Название банка' },
        { label: 'ФИО латиницей' },
        { label: 'Сумма', description: 'например 5000000' },
      ],
      sample: '1234567890\nVietcombank\nNGUYEN VAN A\n5000000',
    },
    [PaymentMethodEnum.IBAN]: {
      title: 'Банковский счёт',
      intro: DEFAULT_INTRO,
      fields: [
        { label: 'IBAN / номер счёта' },
        { label: 'Получатель', description: 'ФИО или название компании' },
        { label: 'Название банка' },
        { label: 'Сумма', description: 'например 5000000' },
        { label: 'Назначение платежа', optional: true },
      ],
      sample: '1234567890\nNGUYEN VAN A\nVietcombank\n5000000',
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
