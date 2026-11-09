const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send temporary password to new user
 */
const sendTempPassword = async (to, fullName, tempPassword) => {
  const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background: #1a3c5e; padding: 30px; text-align: center; }
        .header h1 { color: #fff; margin: 0; font-size: 24px; letter-spacing: 1px; }
        .header p { color: #c0d4e8; margin: 5px 0 0; font-size: 13px; }
        .body { padding: 30px; }
        .body p { color: #333; line-height: 1.6; }
        .password-box { background: #f0f4f8; border-left: 4px solid #1a3c5e; padding: 15px 20px; margin: 20px 0; border-radius: 4px; }
        .password-box span { font-size: 22px; font-weight: bold; color: #1a3c5e; letter-spacing: 2px; }
        .warning { background: #fff8e1; border-left: 4px solid #ffc107; padding: 12px 16px; border-radius: 4px; margin: 15px 0; color: #856404; font-size: 13px; }
        .footer { background: #f4f6f9; padding: 20px; text-align: center; font-size: 12px; color: #888; }
        .btn { display: inline-block; background: #1a3c5e; color: #fff; padding: 12px 28px; text-decoration: none; border-radius: 5px; margin: 15px 0; font-size: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏭 LUMIÉ</h1>
          <p>Hệ thống Quản lý Kho Thông minh</p>
        </div>
        <div class="body">
          <p>Xin chào <strong>${fullName}</strong>,</p>
          <p>Tài khoản của bạn trong hệ thống Lumié đã được tạo thành công. Dưới đây là mật khẩu tạm thời để đăng nhập lần đầu:</p>
          <div class="password-box">
            <p style="margin:0 0 5px; color:#555; font-size:13px;">Mật khẩu tạm thời:</p>
            <span>${tempPassword}</span>
          </div>
          <div class="warning">
            ⚠️ <strong>Quan trọng:</strong> Vui lòng đăng nhập ngay và đổi mật khẩu trong lần sử dụng đầu tiên để bảo mật tài khoản.
          </div>
          <p>Thông tin đăng nhập:</p>
          <ul>
            <li><strong>Email:</strong> ${to}</li>
            <li><strong>Mật khẩu:</strong> ${tempPassword}</li>
          </ul>
          <p>Nếu bạn không yêu cầu tạo tài khoản này, vui lòng liên hệ quản trị viên ngay lập tức.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} LUMIÉ Smart Warehouse Management System</p>
          <p>Email này được gửi tự động, vui lòng không trả lời.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"LUMIÉ System" <${process.env.SMTP_USER}>`,
    to,
    subject: '[LUMIÉ] Thông tin tài khoản của bạn',
    html,
  });
};

/**
 * Send generic notification email
 */
const sendNotification = async (to, subject, html) => {
  const wrappedHtml = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background: #1a3c5e; padding: 20px 30px; }
        .header h1 { color: #fff; margin: 0; font-size: 20px; }
        .body { padding: 30px; color: #333; line-height: 1.6; }
        .footer { background: #f4f6f9; padding: 15px 20px; text-align: center; font-size: 12px; color: #888; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏭 LUMIÉ - Thông báo hệ thống</h1>
        </div>
        <div class="body">
          ${html}
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} LUMIÉ Smart Warehouse Management System</p>
          <p>Email này được gửi tự động, vui lòng không trả lời.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"LUMIÉ System" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html: wrappedHtml,
  });
};

module.exports = { sendTempPassword, sendNotification };
