import { corsHeaders } from "../_shared/cors.ts";
import { createServiceClient, findActiveEmployeeByToken, getNextAttendanceType } from "../_shared/employee.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Falta el token." }), {
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

    const nextType = await getNextAttendanceType(supabase, employee.id);

    return new Response(JSON.stringify({ employeeName: employee.full_name, nextType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
