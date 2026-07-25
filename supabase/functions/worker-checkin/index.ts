import { corsHeaders } from "../_shared/cors.ts";
import { sendOwnerEmail } from "../_shared/mailer.ts";
import { createServiceClient, findActiveEmployeeByToken, getNextAttendanceType } from "../_shared/employee.ts";
import { distanceMeters } from "../_shared/geo.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token, lat, lng } = await req.json();

    if (!token || typeof lat !== "number" || typeof lng !== "number") {
      return new Response(JSON.stringify({ error: "Faltan el token o la ubicación." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createServiceClient();

    const employee = await findActiveEmployeeByToken(supabase, token);
    if (!employee) {
      return new Response(JSON.stringify({ error: "Empleado no encontrado o inactivo." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await supabase
      .from("business_settings")
      .select("checkin_latitude, checkin_longitude, checkin_radius_meters")
      .eq("id", 1)
      .maybeSingle();

    if (!settings || settings.checkin_latitude == null || settings.checkin_longitude == null) {
      return new Response(
        JSON.stringify({ error: "El negocio todavía no ha configurado su ubicación de registro." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const distance = distanceMeters(lat, lng, settings.checkin_latitude, settings.checkin_longitude);
    const radius = settings.checkin_radius_meters ?? 150;

    if (distance > radius) {
      return new Response(
        JSON.stringify({
          error: "No estás en la ubicación del negocio.",
          distanceMeters: Math.round(distance),
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const nextType = await getNextAttendanceType(supabase, employee.id);
    const occurredAt = new Date();

    const { error: insertError } = await supabase.from("attendance_logs").insert({
      employee_id: employee.id,
      type: nextType,
      occurred_at: occurredAt.toISOString(),
      source: "geolocation",
    });

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const label = nextType === "entrada" ? "registró su entrada" : "registró su salida";
    const timeLabel = occurredAt.toLocaleString("es-MX", { timeZone: "America/Ojinaga" });

    try {
      await sendOwnerEmail(
        `${employee.full_name} ${label}`,
        `<p><strong>${employee.full_name}</strong> ${label} el ${timeLabel} desde su celular (a ${Math.round(distance)}m del negocio).</p>`,
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
        type: nextType,
        occurredAt: occurredAt.toISOString(),
        distanceMeters: Math.round(distance),
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
