import { corsHeaders } from "../_shared/cors.ts";
import { sendOwnerEmail } from "../_shared/mailer.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { ownerName, phone, petName, service, preferredDate } = await req.json();

    if (!ownerName || !phone || !petName || !service) {
      return new Response(JSON.stringify({ error: "Faltan datos de la cita." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = `
      <h2>Nueva solicitud de cita — Yukly Pets</h2>
      <p><strong>Nombre:</strong> ${ownerName}</p>
      <p><strong>Teléfono:</strong> ${phone}</p>
      <p><strong>Mascota:</strong> ${petName}</p>
      <p><strong>Servicio:</strong> ${service}</p>
      <p><strong>Fecha preferida:</strong> ${preferredDate ?? "No especificada"}</p>
    `;

    await sendOwnerEmail(`Nueva cita: ${petName} (${service})`, html);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
