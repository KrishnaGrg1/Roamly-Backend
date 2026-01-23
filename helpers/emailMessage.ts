import env from '../config/env';

export enum EmailTopic {
  ForgotPassword = 'forgot-password',
  VerifyEmail = 'verify-email',
}

interface HtmlProps {
  token: string;
  username: string;
  topic: EmailTopic;
  userId?: string | number;
}

const message = (topic: EmailTopic): string => {
  switch (topic) {
    case EmailTopic.ForgotPassword:
      return 'You requested to reset your password. Use the button below or enter the token in the app to continue.';
    case EmailTopic.VerifyEmail:
      return 'Welcome! Please verify your email using the button below or enter the token in the app.';
    default:
      return '';
  }
};

const subject = (topic: EmailTopic): string => {
  switch (topic) {
    case EmailTopic.ForgotPassword:
      return '🔒 Reset Your Password';
    case EmailTopic.VerifyEmail:
      return '📩 Verify Your Email';
    default:
      return 'Notification';
  }
};

const actionButton = (
  topic: EmailTopic,
  token: string,
  userId?: string | number
): string => {
  const baseUrl =
    env.NODE_ENV === 'production'
      ? 'https://melevelup.me/eng'
      : 'http://localhost:3000/eng';

  const href =
    topic === EmailTopic.ForgotPassword
      ? `${baseUrl}/reset-password?token=${token}&id=${userId}`
      : `${baseUrl}/verify-email?token=${token}&id=${userId}`;

  const label =
    topic === EmailTopic.ForgotPassword ? 'Reset Password' : 'Verify Email';

  return `
    <a href="${href}"
      style="
        display:inline-block;
        width:100%;
        max-width:280px;
        background:#4f46e5;
        color:#ffffff;
        text-decoration:none;
        font-size:16px;
        font-weight:600;
        padding:14px 24px;
        border-radius:10px;
        text-align:center;
      ">
      ${label}
    </a>
  `;
};

const html = ({ token, topic, username, userId }: HtmlProps): string => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject(topic)}</title>
</head>

<body style="margin:0; padding:0; background:#f4f6f8; font-family:Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background:#ffffff; border-radius:16px; overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:28px; text-align:center; background:#4f46e5; color:#ffffff;">
              <h1 style="margin:0; font-size:22px;">${subject(topic)}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px; color:#333; font-size:16px; line-height:1.6;">
              <p style="margin-top:0;">Hi <b>${username}</b>,</p>
              <p>${message(topic)}</p>

              <!-- CTA -->
              <div style="margin:32px 0; text-align:center;">
                ${actionButton(topic, token, userId)}
              </div>

              <!-- Token Box -->
              <div style="
                background:#f9fafb;
                border:1px dashed #c7d2fe;
                border-radius:12px;
                padding:20px;
                text-align:center;
                margin-top:24px;
              ">
                <p style="margin:0 0 8px; font-size:14px; color:#555;">
                  Or enter this token in the app:
                </p>
                <p style="
                  margin:0;
                  font-size:20px;
                  font-weight:700;
                  letter-spacing:2px;
                  color:#111;
                ">
                  ${token}
                </p>
              </div>

              <p style="margin-top:24px; font-size:14px; color:#777;">
                If you didn’t request this, you can safely ignore this email.
                <br />Never share your token with anyone.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px; text-align:center; font-size:13px; color:#999; background:#fafafa;">
              <p style="margin:0;">
                — The <b>Roamly</b> Team
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export default html;
