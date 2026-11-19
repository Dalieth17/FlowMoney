const nodemailer = require('nodemailer');
const config = require('../config');
let transport;

async function sendPasswordReset(email, link) {
  transport ??= nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    requireTLS: config.isProduction,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.password } : undefined,
    pool: true,
    maxConnections: 2,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  });
  await transport.sendMail({
    from: config.mail.from,
    to: email,
    subject: 'FlowMoney · Recupera tu contraseña',
    text: `Recibimos una solicitud para cambiar tu contraseña de FlowMoney.\n\nAbre este enlace:\n${link}\n\nEl enlace caduca en 30 minutos y solo puede usarse una vez.\nSi no hiciste esta solicitud, puedes ignorar este correo.`,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}
const close = () => transport?.close();
module.exports = { sendPasswordReset, close };
