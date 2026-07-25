import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { sendOwnerEmail } from "../_shared/mailer.ts";

const VALID_TYPES = ["entrada", "salida"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token, type } = await req.json();

    if (!token || !VALID_TYPES.includes(type)) {
      return new Response(JSON.stringify({ error: "Token o tipo de registro inválido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, full_name, active")
      .eq("checkin_token", token)
      .maybeSingle();

    if (employeeError || !employee || !employee.active) {
      return new Response(JSON.stringify({ error: "Empleado no encontrado o inactivo." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const occurredAt = new Date();

    const { error: insertError } = await supabase.from("attendance_logs").insert({
      employee_id: employee.id,
      type,
      occurred_at: occurredAt.toISOString(),
    });

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const label = type === "entrada" ? "registró su entrada" : "registró su salida";
    const timeLabel = occurredAt.toLocaleString("es-MX", { timeZone: "America/Ojinaga" });

    try {
      await sendOwnerEmail(
        `${employee.full_name} ${label}`,
        `<p><strong>${employee.full_name}</strong> ${label} el ${timeLabel}.</p>`,
      );
      await supabase
        .from("attendance_logs")
        .update({ notified: true })
        .eq("employee_id", employee.id)
        .eq("occurred_at", occurredAt.toISOString());
    } catch (mailError) {
      console.error("No se pudo enviar la notificación por correo:", mailError);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        employeeName: employee.full_name,
        type,
        occurredAt: occurredAt.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
