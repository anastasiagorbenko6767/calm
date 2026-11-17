// Отправка писем. Если SMTP не настроен (файл .env), письмо не уходит,
// а ссылка из него печатается в терминале: так можно проверять сайт без почтового сервиса.
import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;

const transport = SMTP_HOST
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: Number(SMTP_PORT) === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    })
  : null;

export async function sendMail({ to, subject, text, link }) {
  if (!transport) {
    console.log(`\n[mail] SMTP не настроен, письмо не отправлено.\n  Кому:  ${to}\n  Тема:  ${subject}\n  Ссылка: ${link}\n`);
    return;
  }
  await transport.sendMail({ from: MAIL_FROM || SMTP_USER, to, subject, text });
}
