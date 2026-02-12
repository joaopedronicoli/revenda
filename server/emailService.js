const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_ADDRESS || 'smtp.hostinger.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD,
    },
    tls: {
        rejectUnauthorized: process.env.SMTP_OPENSSL_VERIFY_MODE === 'peer',
    },
});

const FROM = process.env.SMTP_USERNAME || 'suporte@patriciaelias.com.br';

async function sendVerificationEmail(email, nome, token) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://revenda.pelg.com.br';
    const verifyLink = `${frontendUrl}/verify-email?token=${token}`;

    try {
        await transporter.sendMail({
            from: `"Patricia Elias" <${FROM}>`,
            to: email,
            subject: 'Confirme seu email - Patricia Elias Revenda',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #333;">Olá, ${nome}!</h2>
                    <p>Obrigada por se cadastrar no programa de revenda Patricia Elias.</p>
                    <p>Para confirmar seu email, clique no botão abaixo:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${verifyLink}"
                           style="background-color: #e91e63; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px;">
                            Confirmar Email
                        </a>
                    </div>
                    <p style="color: #666; font-size: 14px;">Se o botão não funcionar, copie e cole este link no navegador:</p>
                    <p style="color: #666; font-size: 12px; word-break: break-all;">${verifyLink}</p>
                    <p style="color: #999; font-size: 12px; margin-top: 30px;">Este link expira em 24 horas.</p>
                </div>
            `,
        });
        return { success: true };
    } catch (err) {
        console.error('Erro ao enviar email de verificacao:', err);
        return { success: false, error: err.message };
    }
}

async function sendPasswordResetEmail(email, nome, token) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://revenda.pelg.com.br';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    try {
        await transporter.sendMail({
            from: `"Patricia Elias" <${FROM}>`,
            to: email,
            subject: 'Recuperação de Senha - Patricia Elias Revenda',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #333;">Olá, ${nome}!</h2>
                    <p>Recebemos uma solicitação para redefinir sua senha.</p>
                    <p>Clique no botão abaixo para criar uma nova senha:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}"
                           style="background-color: #e91e63; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px;">
                            Redefinir Senha
                        </a>
                    </div>
                    <p style="color: #666; font-size: 14px;">Se o botão não funcionar, copie e cole este link no navegador:</p>
                    <p style="color: #666; font-size: 12px; word-break: break-all;">${resetLink}</p>
                    <p style="color: #999; font-size: 12px; margin-top: 30px;">Este link expira em 1 hora. Se você não solicitou, ignore este email.</p>
                </div>
            `,
        });
        return { success: true };
    } catch (err) {
        console.error('Erro ao enviar email de reset:', err);
        return { success: false, error: err.message };
    }
}

async function sendOTPEmail(email, otpCode) {
    try {
        await transporter.sendMail({
            from: `"Patricia Elias" <${FROM}>`,
            to: email,
            subject: 'Seu código de acesso - Patricia Elias Revenda',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #333;">Seu código de acesso</h2>
                    <p>Use o código abaixo para entrar na sua conta:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <span style="background-color: #f5f5f5; padding: 16px 32px; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 8px; display: inline-block;">
                            ${otpCode}
                        </span>
                    </div>
                    <p style="color: #999; font-size: 12px;">Este código expira em 15 minutos. Se você não solicitou, ignore este email.</p>
                </div>
            `,
        });
        return { success: true };
    } catch (err) {
        console.error('Erro ao enviar OTP por email:', err);
        return { success: false, error: err.message };
    }
}

async function sendCartRecoveryEmail(email, nome, recoveryLink, items) {
    const itemsList = (items || []).map(item => {
        const name = item.name || `Produto #${item.id}`;
        const qty = item.quantity || 1;
        return `<li style="padding: 4px 0;">${qty}x ${name}</li>`;
    }).join('');

    try {
        await transporter.sendMail({
            from: `"Patricia Elias" <${FROM}>`,
            to: email,
            subject: 'Voce esqueceu algo no carrinho! - Patricia Elias',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #333;">Oi, ${nome || 'cliente'}!</h2>
                    <p>Notamos que voce deixou alguns itens no seu carrinho. Eles ainda estao esperando por voce!</p>
                    ${itemsList ? `<div style="background: #f9f9f9; border-radius: 8px; padding: 16px; margin: 20px 0;"><h3 style="margin: 0 0 8px;">Seus itens:</h3><ul style="margin: 0; padding-left: 20px;">${itemsList}</ul></div>` : ''}
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${recoveryLink}"
                           style="background-color: #e91e63; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px;">
                            Finalizar meu pedido
                        </a>
                    </div>
                    <p style="color: #666; font-size: 14px;">Se o botao nao funcionar, copie e cole este link no navegador:</p>
                    <p style="color: #666; font-size: 12px; word-break: break-all;">${recoveryLink}</p>
                    <p style="color: #999; font-size: 12px; margin-top: 30px;">Se voce ja finalizou seu pedido, ignore este email.</p>
                </div>
            `,
        });
        return { success: true };
    } catch (err) {
        console.error('Erro ao enviar email de recuperacao de carrinho:', err);
        return { success: false, error: err.message };
    }
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendOTPEmail, sendCartRecoveryEmail };
