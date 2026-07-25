import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function findActiveEmployeeByToken(
  supabase: ReturnType<typeof createServiceClient>,
  token: string,
) {
  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, active")
    .eq("checkin_token", token)
    .maybeSingle();

  if (error || !data || !data.active) return null;
  return data;
}

export async function getNextAttendanceType(
  supabase: ReturnType<typeof createServiceClient>,
  employeeId: string,
): Promise<"entrada" | "salida"> {
  const { data } = await supabase
    .from("attendance_logs")
    .select("type")
    .eq("employee_id", employeeId)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return !data || data.type === "salida" ? "entrada" : "salida";
}
