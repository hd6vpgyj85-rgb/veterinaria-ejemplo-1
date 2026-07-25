import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

export async function sendOwnerEmail(subject: string, htmlBody: string) {
  const gmailUser = Deno.env.get("GMAIL_USER");
  const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD");
  const ownerEmail = Deno.env.get("OWNER_EMAIL") ?? gmailUser;

  if (!gmailUser || !gmailAppPassword || !ownerEmail) {
    throw new Error(
      "Faltan variables de entorno GMAIL_USER, GMAIL_APP_PASSWORD u OWNER_EMAIL en la función.",
    );
  }

  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: {
        username: gmailUser,
        password: gmailAppPassword,
      },
    },
  });

  await client.send({
    from: gmailUser,
    to: ownerEmail,
    subject,
    html: htmlBody,
  });

  await client.close();
}
