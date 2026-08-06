import { Command, Ctx, Update } from 'nestjs-telegraf';
import { SceneContext } from 'telegraf/typings/scenes';
import { PrismaService } from '../../prisma/prisma.service';
import { BoxApiService } from '../../payout-fields/box-api.service';
import { UserService } from '../../user/user.service';
import { PAYOUT_FIELD_KEYS } from '../../payout-fields/payout-fields.constants';
import {
  FIELD_PRESETS,
  UAH_GROUP,
  parseFieldsCommand,
} from '../../payout-fields/payout-fields.presets';

const USAGE = [
  'Использование: /fields [НАПРАВЛЕНИЕ] [пресет|поле,поле|off]',
  '',
  '/fields — показать все заданные наборы',
  '/fields CORPUAH — показать набор направления',
  '/fields CORPUAH fop — применить пресет (поля + курс)',
  '/fields CORPUAH iban,inn — задать поля вручную',
  '/fields CORPUAH off — вернуть направление на схему плагина',
  '/fields uah card — массово: Visa/Master Card + 12 банков',
  '(Счет компании и Банковский счет группа uah не трогает)',
  '',
  `Пресеты: ${Object.entries(FIELD_PRESETS).map(([k, v]) => `${k} -> ${v.parser}`).join(', ')}`,
  'Изменение подхватывается обменником в течение 30 секунд (кэш плагина).',
].join('\n');

@Update()
export class PayoutFieldsActions {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly box: BoxApiService,
  ) {}

  /** Справка по наборам полей и пресетам. */
  @Command('fields_info')
  async onFieldsInfo(@Ctx() ctx: SceneContext) {
    if (!(await this.userService.isAdminChat(ctx))) return;
    await ctx.reply(
      `${USAGE}\n\nДоступные поля:\n${PAYOUT_FIELD_KEYS.join(', ')}\n\n` +
        `Группа uah (${UAH_GROUP.length}): ${UAH_GROUP.join(', ')}`,
    );
  }

  /** Наборы полей формы выплаты. Не админам не отвечаем — команду не палим. */
  @Command('fields')
  async onFields(@Ctx() ctx: SceneContext) {
    if (!(await this.userService.isAdminChat(ctx))) return;
    const text = (ctx.message as { text?: string })?.text ?? '';
    const cmd = parseFieldsCommand(text);

    if (cmd.kind === 'error') {
      await ctx.reply(`${cmd.message}\n\n${USAGE}`);
      return;
    }

    if (cmd.kind === 'list') {
      const all = await this.prisma.payoutFieldPreset.findMany({
        orderBy: { xml: 'asc' },
      });
      if (!all.length) {
        await ctx.reply(`Наборов нет — все направления на схеме плагина.\n\n${USAGE}`);
        return;
      }
      const lines = all.map(
        (p) => `${p.xml}${p.enabled ? '' : ' (выкл)'}: ${p.fields.join(', ')}`,
      );
      await ctx.reply(lines.join('\n'));
      return;
    }

    if (cmd.kind === 'show') {
      const rows = await this.prisma.payoutFieldPreset.findMany({
        where: { xml: { in: cmd.targets } },
        orderBy: { xml: 'asc' },
      });
      const found = new Map(rows.map((r) => [r.xml, r]));
      const lines = cmd.targets.map((xml) => {
        const row = found.get(xml);
        if (!row) return `${xml}: схема плагина`;
        return `${xml}${row.enabled ? '' : ' (выкл)'}: ${row.fields.join(', ')}`;
      });
      await ctx.reply(lines.join('\n'));
      return;
    }

    if (cmd.kind === 'off') {
      const { count } = await this.prisma.payoutFieldPreset.updateMany({
        where: { xml: { in: cmd.targets } },
        data: { enabled: false },
      });
      await ctx.reply(
        `Выключено наборов: ${count}. Направления вернулись на схему плагина:\n${cmd.targets.join(', ')}`,
      );
      return;
    }

    const note = cmd.preset ? `preset:${cmd.preset}` : 'custom';
    for (const xml of cmd.targets) {
      const data = { fields: cmd.fields, enabled: true, note };
      await this.prisma.payoutFieldPreset.upsert({
        where: { xml },
        create: { xml, ...data },
        update: data,
      });
    }

    const lines = [
      `Поля (${cmd.targets.length}): ${cmd.fields.join(', ')}`,
      cmd.targets.join(', '),
    ];

    // Курс следует за методом: пресет тянет за собой парсер направления.
    if (cmd.parser) {
      const res = await this.box.setParserForXmls(cmd.targets, cmd.parser);
      lines.push(
        res.error
          ? `Курс НЕ переключён (${cmd.parser}): ${res.error}`
          : `Курс ${cmd.parser}: обновлено ${res.ok}, без изменений ${res.skipped}` +
              (res.fail ? `, ошибок ${res.fail}` : ''),
      );
    }
    lines.push('Обменник подхватит поля в течение 30 секунд.');
    await ctx.reply(lines.join('\n'));
  }
}
