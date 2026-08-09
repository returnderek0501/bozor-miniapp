import { listAdmins } from './admins.js';
import { listOperators } from './operators.js';
import { attachmentAbsolutePath } from './attachments.js';
import { getTelegramIdByPhone, normalizePhone } from './store.js';

let botRef = null;

export const KYC_STATUS_LABELS = {
  none: 'Не пройден',
  pending: 'На проверке',
  approved: 'Подтверждён',
  rejected: 'Отклонён',
};

export function setKycBot(bot) {
  botRef = bot;
}

function phoneDigits(phone) {
  return normalizePhone(phone)?.replace(/\D/g, '') || '';
}

export function kycModerationKeyboard(phone) {
  const digits = phoneDigits(phone);
  return {
    inline_keyboard: [[
      { text: '✅ Принять', callback_data: `kyc_ok:${digits}` },
      { text: '❌ Отклонить', callback_data: `kyc_rej:${digits}` },
    ]],
  };
}

function reviewerTargets(emp) {
  const targets = new Set();
  if (emp.createdBy) targets.add(Number(emp.createdBy));
  for (const id of listAdmins()) targets.add(Number(id));
  return [...targets];
}

export async function notifyOperatorKycReview(emp) {
  if (!botRef || !emp) return;

  const targets = reviewerTargets(emp);
  if (!targets.length) return;

  const header = [
    '<b>🪪 KYC — новая заявка</b>',
    `Клиент: <b>${emp.fullName || '—'}</b>`,
    `ID: <code>#${emp.clientId || '—'}</code>`,
    `Тел: <code>${emp.phone}</code>`,
    `Оператор: <b>${emp.operator || emp.createdByName || '—'}</b>`,
    '',
    'Проверьте документы и примите решение:',
  ].join('\n');

  const idCardFront = emp.kycDocuments?.idCardFront;
  const idCardBack = emp.kycDocuments?.idCardBack;
  const selfie = emp.kycDocuments?.selfie;
  const keyboard = kycModerationKeyboard(emp.phone);

  for (const chatId of targets) {
    try {
      await botRef.sendMessage(chatId, header, { reply_markup: keyboard });
      if (idCardFront?.path) {
        await botRef.sendPhotoFile(
          chatId,
          attachmentAbsolutePath(idCardFront.path),
          '📄 ID-карта (лицевая сторона)',
        );
      }
      if (idCardBack?.path) {
        await botRef.sendPhotoFile(
          chatId,
          attachmentAbsolutePath(idCardBack.path),
          '📄 ID-карта (обратная сторона)',
        );
      }
      if (selfie?.path) {
        await botRef.sendPhotoFile(
          chatId,
          attachmentAbsolutePath(selfie.path),
          '🤳 Селфи с ID-картой',
        );
      }
    } catch (e) {
      console.error(`KYC notify failed for ${chatId}:`, e.message);
    }
  }
}

export async function notifyClientKycResult(emp, approved) {
  if (!botRef || !emp) return;
  const tid = getTelegramIdByPhone(emp.phone);
  if (!tid) return;

  const text = approved
    ? '✅ <b>KYC подтверждён</b>\n\nТеперь вы можете выводить аванс в личном кабинете.'
    : [
      '❌ <b>KYC отклонён</b>',
      '\nДокументы не прошли проверку. Загрузите их заново в разделе «Документы».',
    ].join('');

  try {
    await botRef.sendMessage(tid, text);
  } catch (e) {
    console.error(`KYC client notify failed for ${emp.phone}:`, e.message);
  }
}

export async function notifyOnboardingKycReview(record) {
  if (!botRef || !record) return;
  const targets = new Set([
    ...listAdmins(),
    ...listOperators().map(operator => operator.telegramId).filter(Boolean),
  ]);
  const telegramName = [
    record.telegramFirstName,
    record.telegramLastName,
  ].filter(Boolean).join(' ') || '—';
  const message = [
    '<b>🪪 KYC до ввода телефона</b>',
    `Telegram: <b>${telegramName}</b>`,
    record.telegramUsername ? `Username: @${record.telegramUsername}` : 'Username: —',
    `Telegram ID: <code>${record.telegramId}</code>`,
    '',
    'Откройте служебную Mini App для проверки документов.',
  ].join('\n');
  for (const chatId of targets) {
    try {
      await botRef.sendMessage(chatId, message);
    } catch (error) {
      console.error(`Onboarding KYC notify failed for ${chatId}:`, error.message);
    }
  }
}

export async function notifyOnboardingKycResult(record, approved) {
  if (!botRef || !record?.telegramId) return;
  const text = approved
    ? '✅ <b>KYC подтверждён</b>\n\nТеперь вернитесь в Mini App и укажите номер телефона.'
    : `❌ <b>KYC отклонён</b>\n\n${record.kycRejectionReason || 'Загрузите документы повторно.'}`;
  try {
    await botRef.sendMessage(record.telegramId, text);
  } catch (error) {
    console.error(`Onboarding KYC result notify failed for ${record.telegramId}:`, error.message);
  }
}

export async function sendKycDocumentsToChat(bot, chatId, emp) {
  const idCardFront = emp.kycDocuments?.idCardFront;
  const idCardBack = emp.kycDocuments?.idCardBack;
  const selfie = emp.kycDocuments?.selfie;
  if (!idCardFront?.path && !idCardBack?.path && !selfie?.path) {
    await bot.sendMessage(chatId, 'KYC документы не загружены.');
    return;
  }
  await bot.sendMessage(chatId, `🪪 KYC — #<code>${emp.clientId}</code> (${emp.fullName || emp.phone})`, {
    reply_markup: kycModerationKeyboard(emp.phone),
  });
  const documents = [
    [idCardFront, '📄 ID-карта (лицевая сторона)'],
    [idCardBack, '📄 ID-карта (обратная сторона)'],
    [selfie, '🤳 Селфи с ID-картой'],
  ];
  for (const [document, caption] of documents) {
    if (!document?.path) continue;
    try {
      await bot.sendPhotoFile(chatId, attachmentAbsolutePath(document.path), caption);
    } catch (error) {
      console.error(`KYC photo send failed for ${emp.phone}:`, error.message);
      await bot.sendMessage(chatId, `⚠️ Не удалось открыть: ${caption}`);
    }
  }
}

export function kycStatusLabel(status) {
  return KYC_STATUS_LABELS[status] || status || '—';
}
