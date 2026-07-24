(function () {
  var config = window.YUKLY_CONFIG || {};
  var isConfigured =
    config.SUPABASE_URL &&
    config.SUPABASE_ANON_KEY &&
    config.SUPABASE_URL.indexOf("REEMPLAZAR") === -1;

  var client = null;
  if (isConfigured && window.supabase) {
    client = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }

  async function callFunction(name, payload) {
    if (!isConfigured) {
      throw new Error("Supabase no está configurado todavía.");
    }
    var url = config.SUPABASE_URL + "/functions/v1/" + name;
    var response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + config.SUPABASE_ANON_KEY,
        apikey: config.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    });
    var body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || "Error al llamar la función " + name);
    }
    return body;
  }

  window.YuklyData = {
    isConfigured: isConfigured,
    client: client,

    async getActiveServices() {
      if (!client) return null;
      var result = await client
        .from("services")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (result.error) throw result.error;
      return result.data;
    },

    async getApprovedReviews() {
      if (!client) return null;
      var result = await client
        .from("reviews")
        .select("*")
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .limit(12);
      if (result.error) throw result.error;
      return result.data;
    },

    async submitReview(review, photoFile) {
      if (!client) throw new Error("Supabase no está configurado todavía.");

      var photoUrl = null;
      if (photoFile) {
        var path = Date.now() + "-" + Math.random().toString(36).slice(2) + "-" + photoFile.name;
        var uploadResult = await client.storage.from("review-photos").upload(path, photoFile);
        if (uploadResult.error) throw uploadResult.error;
        photoUrl = client.storage.from("review-photos").getPublicUrl(path).data.publicUrl;
      }

      var result = await client.from("reviews").insert({
        name: review.name,
        rating: review.rating,
        comment: review.comment,
        photo_url: photoUrl,
        approved: false,
      });
      if (result.error) throw result.error;
      return result.data;
    },

    async submitAppointment(appointment) {
      if (!client) return;
      var result = await client.from("appointments").insert({
        owner_name: appointment.ownerName,
        phone: appointment.phone,
        pet_name: appointment.petName,
        service: appointment.service,
        preferred_date: appointment.date || null,
      });
      if (result.error) throw result.error;

      try {
        await callFunction("send-appointment-email", {
          ownerName: appointment.ownerName,
          phone: appointment.phone,
          petName: appointment.petName,
          service: appointment.service,
          preferredDate: appointment.date,
        });
      } catch (emailError) {
        console.error("La cita se guardó, pero el correo no pudo enviarse:", emailError);
      }
    },

    async checkin(token, type) {
      return callFunction("checkin", { token: token, type: type });
    },

    async getBusinessSettings() {
      if (!client) return null;
      var result = await client.from("business_settings").select("*").eq("id", 1).maybeSingle();
      if (result.error) throw result.error;
      return result.data;
    },
  };
})();
