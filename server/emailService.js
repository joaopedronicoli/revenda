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

async function sendApprovalEmail(email, nome) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://revenda.pelg.com.br';

    try {
        await transporter.sendMail({
            from: `"Patricia Elias" <${FROM}>`,
            to: email,
            subject: 'Cadastro Aprovado! - Patricia Elias Revenda',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <div style="background-color: #e8f5e9; display: inline-block; padding: 20px; border-radius: 50%;">
                            <span style="font-size: 48px;">&#10004;</span>
                        </div>
                    </div>
                    <h2 style="color: #2e7d32; text-align: center;">Parabens, ${nome || 'revendedor(a)'}!</h2>
                    <p style="text-align: center; font-size: 16px; color: #333;">Seu cadastro no programa de revenda <strong>Patricia Elias</strong> foi <strong>aprovado</strong> com sucesso!</p>
                    <p style="text-align: center; color: #666;">Agora voce ja pode acessar nossa loja exclusiva, fazer seus pedidos e comecar a revender.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${frontendUrl}"
                           style="background-color: #e91e63; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-size: 16px;">
                            Acessar a Loja
                        </a>
                    </div>
                    <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">Qualquer duvida, entre em contato pelo email revendedor@patriciaelias.com.br</p>
                </div>
            `,
        });
        return { success: true };
    } catch (err) {
        console.error('Erro ao enviar email de aprovacao:', err);
        return { success: false, error: err.message };
    }
}

async function sendNewReferralEmail(email, name, referredName) {
    try {
        await transporter.sendMail({
            from: `"Patricia Elias" <${FROM}>`,
            to: email,
            subject: 'Nova Indicacao! - Patricia Elias Revenda',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #333;">Ola, ${name || 'afiliado(a)'}!</h2>
                    <p style="font-size: 16px;">Temos uma otima noticia: <strong>${referredName || 'alguem'}</strong> se cadastrou usando o seu link de indicacao e ja fez a primeira compra!</p>
                    <p>Sua indicacao agora esta <strong>ativa</strong> e voce recebera comissoes sobre as compras desta pessoa.</p>
                    <p style="color: #999; font-size: 12px; margin-top: 30px;">Continue compartilhando seu link para ganhar ainda mais!</p>
                </div>
            `,
        });
        return { success: true };
    } catch (err) {
        console.error('Erro ao enviar email de nova indicacao:', err);
        return { success: false, error: err.message };
    }
}

async function sendCommissionEarnedEmail(email, name, amount, orderRef) {
    try {
        await transporter.sendMail({
            from: `"Patricia Elias" <${FROM}>`,
            to: email,
            subject: 'Comissao Creditada! - Patricia Elias Revenda',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #333;">Ola, ${name || 'afiliado(a)'}!</h2>
                    <p style="font-size: 16px;">Voce recebeu uma nova comissao!</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <span style="background-color: #e8f5e9; padding: 16px 32px; font-size: 28px; font-weight: bold; color: #2e7d32; border-radius: 8px; display: inline-block;">
                            R$ ${parseFloat(amount).toFixed(2)}
                        </span>
                    </div>
                    <p style="color: #666;">Referente ao pedido <strong>#${orderRef || ''}</strong>. O valor ja foi creditado no seu saldo de comissoes.</p>
                    <p style="color: #999; font-size: 12px; margin-top: 30px;">Acesse seu painel de afiliada para mais detalhes.</p>
                </div>
            `,
        });
        return { success: true };
    } catch (err) {
        console.error('Erro ao enviar email de comissao:', err);
        return { success: false, error: err.message };
    }
}

async function sendPayoutApprovedEmail(email, name, amount) {
    try {
        await transporter.sendMail({
            from: `"Patricia Elias" <${FROM}>`,
            to: email,
            subject: 'Saque Aprovado! - Patricia Elias Revenda',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <div style="background-color: #e8f5e9; display: inline-block; padding: 20px; border-radius: 50%;">
                            <span style="font-size: 48px;">&#10004;</span>
                        </div>
                    </div>
                    <h2 style="color: #2e7d32; text-align: center;">Saque Aprovado!</h2>
                    <p style="text-align: center;">Ola, <strong>${name || 'afiliado(a)'}</strong>! Seu pedido de saque no valor de <strong>R$ ${parseFloat(amount).toFixed(2)}</strong> foi aprovado.</p>
                    <p style="text-align: center; color: #666;">O pagamento sera processado em breve.</p>
                </div>
            `,
        });
        return { success: true };
    } catch (err) {
        console.error('Erro ao enviar email de saque aprovado:', err);
        return { success: false, error: err.message };
    }
}

async function sendPayoutRejectedEmail(email, name, reason) {
    try {
        await transporter.sendMail({
            from: `"Patricia Elias" <${FROM}>`,
            to: email,
            subject: 'Saque Recusado - Patricia Elias Revenda',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #c62828;">Saque Recusado</h2>
                    <p>Ola, <strong>${name || 'afiliado(a)'}</strong>. Infelizmente seu pedido de saque foi recusado.</p>
                    ${reason ? `<p><strong>Motivo:</strong> ${reason}</p>` : ''}
                    <p style="color: #666;">O valor foi devolvido ao seu saldo de comissoes. Se tiver duvidas, entre em contato conosco.</p>
                </div>
            `,
        });
        return { success: true };
    } catch (err) {
        console.error('Erro ao enviar email de saque recusado:', err);
        return { success: false, error: err.message };
    }
}

async function sendPayoutPaidEmail(email, name, amount) {
    try {
        await transporter.sendMail({
            from: `"Patricia Elias" <${FROM}>`,
            to: email,
            subject: 'Pagamento Enviado! - Patricia Elias Revenda',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <div style="background-color: #e8f5e9; display: inline-block; padding: 20px; border-radius: 50%;">
                            <span style="font-size: 48px;">&#128176;</span>
                        </div>
                    </div>
                    <h2 style="color: #2e7d32; text-align: center;">Pagamento Enviado!</h2>
                    <p style="text-align: center;">Ola, <strong>${name || 'afiliado(a)'}</strong>! O pagamento de <strong>R$ ${parseFloat(amount).toFixed(2)}</strong> foi enviado para voce.</p>
                    <p style="text-align: center; color: #666;">Verifique sua conta PIX. O valor pode levar alguns minutos para aparecer.</p>
                </div>
            `,
        });
        return { success: true };
    } catch (err) {
        console.error('Erro ao enviar email de pagamento:', err);
        return { success: false, error: err.message };
    }
}

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendOTPEmail,
    sendCartRecoveryEmail,
    sendApprovalEmail,
    sendNewReferralEmail,
    sendCommissionEarnedEmail,
    sendPayoutApprovedEmail,
    sendPayoutRejectedEmail,
    sendPayoutPaidEmail
};
