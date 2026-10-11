import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

export const isMailConfigured = () => Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
  return transporter;
}

export async function sendMail({ to, subject, html, text }) {
  if (!isMailConfigured()) {
    console.log(`\n[mail:dev] To: ${to}\nSubject: ${subject}\n${text || html}\n`);
    return { dev: true };
  }
  return getTransporter().sendMail({ from: env.smtp.from, to, subject, html, text });
}

const wrap = (salonName, inner) => `
  <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0f172a">
    <h2 style="color:#059669;margin:0 0 12px">${salonName}</h2>
    ${inner}
  </div>`;

export function resetPasswordTemplate({ name, link, salonName = 'SaloonEase' }) {
  return {
    subject: `${salonName} - Reset your password`,
    text: `Hi ${name},\n\nOpen the link below to reset your password (valid for 30 minutes):\n${link}\n\nIf you did not request this, ignore this email.`,
    html: wrap(
      salonName,
      `<p>Hi ${name},</p>
       <p>Tap the button below to reset your password. The link is valid for <b>30 minutes</b>.</p>
       <p style="margin:24px 0">
         <a href="${link}" style="background:#059669;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:700">Reset Password</a>
       </p>
       <p style="font-size:12px;color:#64748b">If the button does not work, copy this link:<br>${link}</p>
       <p style="font-size:12px;color:#64748b">If you did not request this, you can safely ignore this email.</p>`,
    ),
  };
}

export function bookingConfirmedTemplate({ name, tokenNumber, serviceName, date, slotTime, barberName, salonName }) {
  return {
    subject: `${salonName} - Token #${tokenNumber} confirmed`,
    text: `Hi ${name}, your booking is confirmed.\nToken: #${tokenNumber}\nService: ${serviceName}\nBarber: ${barberName}\nDate: ${date} at ${slotTime}`,
    html: wrap(
      salonName,
      `<p>Hi ${name}, your booking is confirmed.</p>
       <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center">
         <div style="font-size:12px;color:#64748b;text-transform:uppercase">Your token</div>
         <div style="font-size:32px;font-weight:800;color:#059669">#${tokenNumber}</div>
         <div style="font-weight:600">${serviceName}</div>
         <div style="font-size:13px;color:#475569">${barberName} - ${date} at ${slotTime}</div>
       </div>`,
    ),
  };
}
