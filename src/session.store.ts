import * as LocalSession from 'telegraf-session-local';

/**
 * Единственный экземпляр сессий: его подключает app.module как middleware,
 * его же читаем напрямую, когда бухгалтеру нужно проставить курс в чужом
 * визарде. Ключ сессии — `chatId:userId`, поэтому состояние оператора в
 * контекст бухгалтера не попадает и достать его можно только из стора.
 */
// Файл сессий — в примонтированном storage: внутри образа он умирал вместе
// с контейнером, и любой деплой ронял открытые визарды (заявку приходилось
// возвращать в очередь руками).
export const localSession = new LocalSession({
  database: 'storage/sessions.json',
});

export type ForeignCloseSession = {
  /** Ключ сессии `chatId:userId` — им же сохраняем изменения обратно. */
  key: string;
  /** Telegram id оператора, который ведёт заявку. */
  operatorTgId: number;
  /** Вся сессия оператора: пишется обратно целиком. */
  data: Record<string, any>;
  /** Состояние визарда внутри `data.__scenes.state` — ссылка, не копия. */
  state: Record<string, any>;
};

/**
 * Чужой открытый шаг закрытия в этом чате. Ищем только стадии из `stages`:
 * 'checking' сюда не передают — пока идёт сверка с биржей, вмешиваться нельзя.
 */
export function findForeignCloseSession(
  chatId: number,
  exceptTgId: number,
  stages: string[],
): ForeignCloseSession | null {
  const db = (localSession as any).DB;
  const rows: any[] = db.get('sessions').value() ?? [];
  for (const row of rows) {
    const [chat, user] = String(row?.id ?? '').split(':');
    if (Number(chat) !== chatId || Number(user) === exceptTgId) continue;
    const state = row?.data?.__scenes?.state;
    if (state && stages.includes(state.closeStage)) {
      return {
        key: row.id,
        operatorTgId: Number(user),
        data: row.data,
        state,
      };
    }
  }
  return null;
}

/** Сохранить правки чужой сессии (стадию закрытия, очистку визарда). */
export async function saveForeignSession(
  key: string,
  data: Record<string, any>,
): Promise<void> {
  await localSession.saveSession(key, data);
}
