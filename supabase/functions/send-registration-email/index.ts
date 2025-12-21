import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  userId: string;
  userEmail: string;
  userName: string;
  userFullName?: string;
  templateType?: 'admin' | 'client';
}

interface InvitationTemplate {
  subject: string;
  body_html: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { userId, userEmail, userName, userFullName, templateType = 'admin' }: RequestBody = await req.json();

    if (!userId || !userEmail) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing required fields: userId and userEmail",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    let displayName = userFullName || userName || "there";

    if (!userFullName) {
      const userResponse = await fetch(
        `${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=name`,
        {
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            apikey: supabaseServiceKey,
          },
        }
      );

      if (userResponse.ok) {
        const users = await userResponse.json();
        if (users && users.length > 0 && users[0].name) {
          displayName = users[0].name;
        }
      }
    }


    const token = generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const tokenInsertResponse = await fetch(
      `${supabaseUrl}/rest/v1/user_registration_tokens`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
          apikey: supabaseServiceKey,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          user_id: userId,
          token: token,
          expires_at: expiresAt.toISOString(),
          is_used: false,
          created_at: new Date().toISOString(),
        }),
      }
    );

    if (!tokenInsertResponse.ok) {
      const error = await tokenInsertResponse.text();
      throw new Error(`Failed to create token: ${error}`);
    }

    const emailConfigResponse = await fetch(
      `${supabaseUrl}/rest/v1/email_monitoring_config?select=*`,
      {
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      }
    );

    if (!emailConfigResponse.ok) {
      throw new Error("Failed to load email configuration");
    }

    const emailConfigs = await emailConfigResponse.json();
    if (!emailConfigs || emailConfigs.length === 0) {
      throw new Error("No email configuration found");
    }

    const emailConfig = emailConfigs[0];
    const registrationUrl = `${req.headers.get("origin") || "https://yourdomain.com"}/password-setup?token=${token}`;

    const template = await loadInvitationTemplate(supabaseUrl, supabaseServiceKey, templateType);
    const companyName = await loadCompanyName(supabaseUrl, supabaseServiceKey);
    
    const emailSubject = replaceTemplateVariables(template.subject, {
      name: displayName,
      username: userName || "there",
      reset_link: registrationUrl,
      company_name: companyName,
      expiration_hours: "48",
    });

    const emailBody = replaceTemplateVariables(template.body_html, {
      name: displayName,
      username: userName || "there",
      reset_link: registrationUrl,
      company_name: companyName,
      expiration_hours: "48",
    });

    let emailSent = false;

    if (emailConfig.provider === "office365") {
      const tokenResponse = await fetch(
        `https://login.microsoftonline.com/${emailConfig.tenant_id}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: emailConfig.client_id,
            client_secret: emailConfig.client_secret,
            scope: "https://graph.microsoft.com/.default",
            grant_type: "client_credentials",
          }),
        }
      );

      if (!tokenResponse.ok) {
        throw new Error("Failed to get Office 365 access token");
      }

      const { access_token } = await tokenResponse.json();

      const sendEmailResponse = await fetch(
        `https://graph.microsoft.com/v1.0/users/${emailConfig.default_send_from_email}/sendMail`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              subject: emailSubject,
              body: {
                contentType: "HTML",
                content: emailBody,
              },
              toRecipients: [
                {
                  emailAddress: {
                    address: userEmail,
                  },
                },
              ],
            },
            saveToSentItems: false,
          }),
        }
      );

      if (!sendEmailResponse.ok) {
        const error = await sendEmailResponse.text();
        throw new Error(`Failed to send email: ${error}`);
      }

      emailSent = true;
    } else if (emailConfig.provider === "gmail") {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: emailConfig.gmail_client_id,
          client_secret: emailConfig.gmail_client_secret,
          refresh_token: emailConfig.gmail_refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error("Failed to get Gmail access token");
      }

      const { access_token } = await tokenResponse.json();

      const rawEmail = createRawEmail(
        emailConfig.default_send_from_email,
        userEmail,
        emailSubject,
        emailBody
      );

      const sendEmailResponse = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            raw: rawEmail,
          }),
        }
      );

      if (!sendEmailResponse.ok) {
        const error = await sendEmailResponse.text();
        throw new Error(`Failed to send email: ${error}`);
      }

      emailSent = true;
    }

    if (!emailSent) {
      throw new Error("Unsupported email provider");
    }

    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${userId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
          apikey: supabaseServiceKey,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          invitation_sent_at: new Date().toISOString(),
          invitation_sent_count: await getIncrementedInvitationCount(supabaseUrl, supabaseServiceKey, userId),
        }),
      }
    );

    if (!updateResponse.ok) {
      console.error("Failed to update invitation tracking:", await updateResponse.text());
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Registration email sent successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || "Failed to send registration email",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

async function loadInvitationTemplate(
  supabaseUrl: string,
  supabaseServiceKey: string,
  templateType: 'admin' | 'client' = 'admin'
): Promise<InvitationTemplate> {
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/invitation_email_templates?is_default=eq.true&template_type=eq.${templateType}&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      }
    );

    if (response.ok) {
      const templates = await response.json();
      if (templates && templates.length > 0) {
        return {
          subject: templates[0].subject,
          body_html: templates[0].body_html,
        };
      }
    }
  } catch (error) {
    console.error("Error loading invitation template:", error);
  }

  return {
    subject: "Complete Your Account Registration",
    body_html: getDefaultEmailHtml(),
  };
}

async function loadCompanyName(
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<string> {
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/company_branding?limit=1`,
      {
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      }
    );

    if (response.ok) {
      const branding = await response.json();
      if (branding && branding.length > 0 && branding[0].company_name) {
        return branding[0].company_name;
      }
    }
  } catch (error) {
    console.error("Error loading company name:", error);
  }

  return "Order Entry";
}

function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

function getDefaultEmailHtml(): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complete Your Registration</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #14b8a6 0%, #0891b2 100%); padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                Welcome to {{company_name}}!
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hello {{name}},
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Your account has been created! To complete your registration and access your account, please set your password by clicking the button below.
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                This link will expire in <strong>{{expiration_hours}} hours</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="{{reset_link}}" style="display: inline-block; padding: 16px 32px; background-color: #14b8a6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(20, 184, 166, 0.3);">
                      Set Your Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; padding-top: 30px; border-top: 1px solid #e5e7eb;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="color: #14b8a6; font-size: 13px; word-break: break-all; margin: 10px 0 0 0;">
                {{reset_link}}
              </p>
              <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin: 30px 0 0 0;">
                If you didn't request this registration, please ignore this email or contact your administrator.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                {{company_name}}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function createRawEmail(
  from: string,
  to: string,
  subject: string,
  htmlBody: string
): string {
  const email = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    htmlBody,
  ].join("\r\n");

  return btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getIncrementedInvitationCount(
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string
): Promise<number> {
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=invitation_sent_count`,
      {
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      }
    );

    if (response.ok) {
      const users = await response.json();
      if (users && users.length > 0) {
        return (users[0].invitation_sent_count || 0) + 1;
      }
    }
  } catch (error) {
    console.error("Error getting invitation count:", error);
  }
  return 1;
}
