/**
 * Карточка заявки для рабочей группы и групп операторов: шапка обычным
 * текстом, реквизиты — одним блоком <pre>.
 *
 * В Telegram у <pre> есть кнопка «копировать»: оператор переносит реквизиты
 * в банк целиком, а не выделяет по строчке. Разметки внутри блока быть не
 * должно — <b>/<code> там показываются как есть, поэтому теги снимаем, а
 * значения экранируем заново.
 *
 * Клиент (PUBLIC) и админка (ADMIN) остаются на прежнем формате: копировать
 * там нечего, а <pre> ломает привычный вид карточки.
 */

/** Строки шапки: не реквизиты, копировать их незачем. Сверяем по метке до «:». */
const HEADER_LABELS = [
  'Заявка номер',
  'Валюта',
  'USDT',
  'Курс',
  'Принята',
  'Партнер',
  'Партнёр',
  'Оплачено',
];

/** Предупреждения — тоже в шапку: их читают, а не копируют. */
const HEADER_PREFIXES = ['🚫'];

const TAG_RE = /<\/?(?:b|i|u|s|em|strong|code|pre)>/gi;

/** Текст строки без разметки — то, что оператор реально видит. */
function stripTags(line: string): string {
  return line
    .replace(TAG_RE, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isHeaderLine(line: string): boolean {
  const plain = stripTags(line);
  if (HEADER_PREFIXES.some((prefix) => plain.includes(prefix))) {
    return true;
  }
  const label = plain.split(':')[0];
  return HEADER_LABELS.some((known) => label.includes(known));
}

/**
 * Шапка + копируемый блок. Если реквизитов не набралось — отдаём строки как
 * были: пустой <pre> в карточке хуже, чем его отсутствие.
 */
export function composeCopyableCaption(lines: string[]): string {
  const header: string[] = [];
  const block: string[] = [];

  for (const line of lines) {
    (isHeaderLine(line) ? header : block).push(line);
  }

  if (block.length === 0) {
    return lines.join('\n');
  }

  const body = block.map((line) => escapeHtml(stripTags(line))).join('\n');
  const parts = header.length > 0 ? [...header, ''] : [];

  return [...parts, `<pre>${body}</pre>`].join('\n');
}
