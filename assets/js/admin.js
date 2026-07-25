(function () {
  var config = window.YUKLY_CONFIG || {};
  var isConfigured =
    config.SUPABASE_URL &&
    config.SUPABASE_ANON_KEY &&
    config.SUPABASE_URL.indexOf("REEMPLAZAR") === -1;

  if (!isConfigured || !window.supabase) {
    document.getElementById("configWarning").classList.remove("hidden");
    document.getElementById("loginScreen").classList.add("hidden");
    return;
  }

  var supabase = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

  var ICON_LABELS = {
    stethoscope: "Estetoscopio",
    syringe: "Jeringa",
    scissors: "Tijeras",
    surgery: "Cirugía",
    house: "Casa",
    cart: "Carrito",
  };

  function qs(id) {
    return document.getElementById(id);
  }

  function toast(message, type) {
    var root = qs("toastRoot");
    var el = document.createElement("div");
    el.className = "toast" + (type ? " toast-" + type : "");
    el.textContent = message;
    root.appendChild(el);
    requestAnimationFrame(function () {
      el.classList.add("show");
    });
    setTimeout(function () {
      el.classList.remove("show");
      setTimeout(function () {
        el.remove();
      }, 300);
    }, 3500);
  }

  function confirmModal(title, message) {
    return new Promise(function (resolve) {
      var root = qs("modalRoot");
      root.innerHTML =
        '<div class="modal-overlay"><div class="modal-card"><h3></h3><p></p>' +
        '<div class="modal-actions"><button class="btn btn-secondary" id="modalCancel">Cancelar</button>' +
        '<button class="btn btn-danger" id="modalConfirm">Confirmar</button></div></div></div>';
      root.querySelector("h3").textContent = title;
      root.querySelector("p").textContent = message;

      function close(result) {
        root.innerHTML = "";
        resolve(result);
      }

      root.querySelector("#modalCancel").addEventListener("click", function () {
        close(false);
      });
      root.querySelector("#modalConfirm").addEventListener("click", function () {
        close(true);
      });
      root.querySelector(".modal-overlay").addEventListener("click", function (event) {
        if (event.target.classList.contains("modal-overlay")) close(false);
      });
    });
  }

  function setFormMessage(id, message, isError) {
    var el = qs(id);
    if (!message) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML =
      '<div class="' + (isError ? "form-error" : "form-success") + '"></div>';
    el.firstChild.textContent = message;
  }

  var TABS = ["resumen", "dueno", "servicios", "resenas", "trabajadores", "asistencia"];
  var currentLoadToken = 0;

  function showTab(tab) {
    TABS.forEach(function (name) {
      qs("tab-" + name).classList.toggle("hidden", name !== tab);
    });
    document.querySelectorAll(".sidebar-nav button").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === tab);
    });
    qs("sidebar").classList.remove("open");

    var token = ++currentLoadToken;
    if (tab === "resumen") loadResumen(token);
    if (tab === "dueno") loadBusinessSettings(token);
    if (tab === "servicios") loadServices(token);
    if (tab === "resenas") loadReviews(token);
    if (tab === "trabajadores") loadEmployees(token);
    if (tab === "asistencia") loadAttendance(token);
  }

  function isStaleLoad(token) {
    return token !== currentLoadToken;
  }

  document.querySelectorAll(".sidebar-nav button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      showTab(btn.getAttribute("data-tab"));
    });
  });

  qs("mobileMenuBtn").addEventListener("click", function () {
    qs("sidebar").classList.toggle("open");
  });

  /* ---------- AUTH ---------- */

  qs("loginForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    var submitBtn = qs("loginSubmit");
    submitBtn.disabled = true;
    setFormMessage("loginError", "", false);

    var email = qs("loginEmail").value.trim();
    var password = qs("loginPassword").value;

    var result = await supabase.auth.signInWithPassword({ email: email, password: password });
    submitBtn.disabled = false;

    if (result.error) {
      setFormMessage("loginError", "Correo o contraseña incorrectos.", true);
      return;
    }
  });

  qs("logoutBtn").addEventListener("click", async function () {
    await supabase.auth.signOut();
  });

  var appShellVisible = false;

  supabase.auth.onAuthStateChange(function (event, session) {
    if (session) {
      qs("loginScreen").classList.add("hidden");
      qs("appShell").classList.remove("hidden");
      if (!appShellVisible) {
        appShellVisible = true;
        showTab("resumen");
      }
    } else {
      appShellVisible = false;
      qs("appShell").classList.add("hidden");
      qs("loginScreen").classList.remove("hidden");
      qs("loginForm").reset();
    }
  });

  /* ---------- RESUMEN ---------- */

  async function cleanupExpiredAppointments() {
    var result = await supabase.from("appointments").select("id, preferred_date, preferred_time");
    if (result.error || !result.data) return;

    var now = new Date();
    var expiredIds = result.data
      .filter(function (appt) {
        if (!appt.preferred_date) return false;
        var timePart = appt.preferred_time || "23:59:59";
        var dt = new Date(appt.preferred_date + "T" + timePart);
        return dt < now;
      })
      .map(function (appt) {
        return appt.id;
      });

    if (expiredIds.length) {
      await supabase.from("appointments").delete().in("id", expiredIds);
    }
  }

  async function loadResumen(token) {
    var statGrid = qs("statGrid");
    var recentWrap = qs("recentAppointments");

    await cleanupExpiredAppointments();
    if (isStaleLoad(token)) return;

    var [servicesRes, reviewsRes, employeesRes, appointmentsRes] = await Promise.all([
      supabase.from("services").select("id", { count: "exact", head: true }).eq("active", true),
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("approved", false),
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("active", true),
      supabase.from("appointments").select("*").order("created_at", { ascending: false }).limit(6),
    ]);

    if (isStaleLoad(token)) return;

    statGrid.innerHTML = "";
    recentWrap.innerHTML = "";

    var stats = [
      { label: "Servicios activos", value: servicesRes.count || 0 },
      { label: "Reseñas por revisar", value: reviewsRes.count || 0 },
      { label: "Trabajadores activos", value: employeesRes.count || 0 },
      { label: "Citas recientes", value: (appointmentsRes.data || []).length },
    ];

    stats.forEach(function (stat) {
      var card = document.createElement("div");
      card.className = "stat-card";
      card.innerHTML = '<div class="value"></div><div class="label"></div>';
      card.querySelector(".value").textContent = stat.value;
      card.querySelector(".label").textContent = stat.label;
      statGrid.appendChild(card);
    });

    var appointments = appointmentsRes.data || [];
    if (!appointments.length) {
      recentWrap.innerHTML = '<div class="empty-state">Todavía no hay citas registradas.</div>';
      return;
    }

    var table = document.createElement("table");
    table.innerHTML =
      "<thead><tr><th>Nombre</th><th>Mascota</th><th>Servicio</th><th>Fecha</th><th>Hora</th><th>Teléfono</th></tr></thead><tbody></tbody>";
    var tbody = table.querySelector("tbody");
    appointments.forEach(function (appt) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td></td><td></td><td></td><td></td><td></td><td></td>";
      var cells = tr.querySelectorAll("td");
      cells[0].textContent = appt.owner_name;
      cells[1].textContent = appt.pet_name;
      cells[2].textContent = appt.service;
      cells[3].textContent = appt.preferred_date || "—";
      cells[4].textContent = appt.preferred_time ? appt.preferred_time.slice(0, 5) : "—";
      cells[5].textContent = appt.phone;
      tbody.appendChild(tr);
    });
    recentWrap.appendChild(table);
  }

  /* ---------- DUEÑO ---------- */

  async function loadBusinessSettings(token) {
    var result = await supabase.from("business_settings").select("*").eq("id", 1).maybeSingle();
    if (isStaleLoad(token)) return;
    if (result.error || !result.data) return;
    var data = result.data;
    qs("bName").value = data.business_name || "";
    qs("bEmail").value = data.owner_email || "";
    qs("bWhatsapp").value = data.whatsapp_number || "";
    qs("bAddress").value = data.address || "";
    qs("bHoursWeekday").value = data.hours_weekday || "";
    qs("bHoursSaturday").value = data.hours_saturday || "";
    qs("bHoursSunday").value = data.hours_sunday || "";
    qs("bLatitude").value = data.checkin_latitude ?? "";
    qs("bLongitude").value = data.checkin_longitude ?? "";
    qs("bRadius").value = data.checkin_radius_meters ?? 150;
  }

  qs("businessForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    setFormMessage("businessFormMsg", "", false);

    var payload = {
      business_name: qs("bName").value.trim(),
      owner_email: qs("bEmail").value.trim(),
      whatsapp_number: qs("bWhatsapp").value.trim(),
      address: qs("bAddress").value.trim(),
      hours_weekday: qs("bHoursWeekday").value.trim(),
      hours_saturday: qs("bHoursSaturday").value.trim(),
      hours_sunday: qs("bHoursSunday").value.trim(),
    };

    var result = await supabase.from("business_settings").update(payload).eq("id", 1);
    if (result.error) {
      setFormMessage("businessFormMsg", "No se pudo guardar: " + result.error.message, true);
      return;
    }
    setFormMessage("businessFormMsg", "Datos del negocio actualizados.", false);
    toast("Información del negocio guardada", "success");
  });

  qs("useCurrentLocationBtn").addEventListener("click", function () {
    setFormMessage("locationFormMsg", "", false);

    if (!navigator.geolocation) {
      setFormMessage("locationFormMsg", "Tu navegador no permite obtener tu ubicación.", true);
      return;
    }

    var btn = qs("useCurrentLocationBtn");
    btn.disabled = true;
    btn.textContent = "Obteniendo ubicación...";

    navigator.geolocation.getCurrentPosition(
      function (position) {
        qs("bLatitude").value = position.coords.latitude;
        qs("bLongitude").value = position.coords.longitude;
        btn.disabled = false;
        btn.textContent = "Usar mi ubicación actual";
        setFormMessage("locationFormMsg", "Ubicación capturada. No olvides dar clic en \"Guardar ubicación\".", false);
      },
      function () {
        btn.disabled = false;
        btn.textContent = "Usar mi ubicación actual";
        setFormMessage("locationFormMsg", "No se pudo obtener tu ubicación. Revisa los permisos del navegador.", true);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });

  qs("locationForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    setFormMessage("locationFormMsg", "", false);

    var latitude = qs("bLatitude").value;
    var longitude = qs("bLongitude").value;

    var payload = {
      checkin_latitude: latitude === "" ? null : parseFloat(latitude),
      checkin_longitude: longitude === "" ? null : parseFloat(longitude),
      checkin_radius_meters: parseInt(qs("bRadius").value, 10) || 150,
    };

    var result = await supabase.from("business_settings").update(payload).eq("id", 1);
    if (result.error) {
      setFormMessage("locationFormMsg", "No se pudo guardar: " + result.error.message, true);
      return;
    }
    setFormMessage("locationFormMsg", "Ubicación guardada.", false);
    toast("Ubicación de registro guardada", "success");
  });

  qs("passwordForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    setFormMessage("passwordFormMsg", "", false);

    var newPassword = qs("newPassword").value;
    var confirmPassword = qs("confirmPassword").value;

    if (newPassword !== confirmPassword) {
      setFormMessage("passwordFormMsg", "Las contraseñas no coinciden.", true);
      return;
    }

    var result = await supabase.auth.updateUser({ password: newPassword });
    if (result.error) {
      setFormMessage("passwordFormMsg", "No se pudo actualizar: " + result.error.message, true);
      return;
    }
    qs("passwordForm").reset();
    setFormMessage("passwordFormMsg", "Contraseña actualizada correctamente.", false);
    toast("Contraseña actualizada", "success");
  });

  /* ---------- SERVICIOS ---------- */

  qs("newServiceBtn").addEventListener("click", function () {
    openServiceForm(null);
  });

  qs("cancelServiceBtn").addEventListener("click", function () {
    qs("serviceFormWrap").classList.add("hidden");
  });

  function openServiceForm(service) {
    qs("serviceFormWrap").classList.remove("hidden");
    setFormMessage("serviceFormMsg", "", false);
    qs("serviceId").value = service ? service.id : "";
    qs("serviceName").value = service ? service.name : "";
    qs("serviceDescription").value = service ? service.description : "";
    qs("serviceIcon").value = service ? service.icon : "stethoscope";
    qs("serviceOrder").value = service ? service.sort_order : 1;
    qs("serviceActive").value = service ? String(service.active) : "true";
    qs("serviceName").focus();
  }

  qs("serviceForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    setFormMessage("serviceFormMsg", "", false);

    var id = qs("serviceId").value;
    var payload = {
      name: qs("serviceName").value.trim(),
      description: qs("serviceDescription").value.trim(),
      icon: qs("serviceIcon").value,
      sort_order: parseInt(qs("serviceOrder").value, 10) || 1,
      active: qs("serviceActive").value === "true",
    };

    var result = id
      ? await supabase.from("services").update(payload).eq("id", id)
      : await supabase.from("services").insert(payload);

    if (result.error) {
      setFormMessage("serviceFormMsg", "No se pudo guardar: " + result.error.message, true);
      return;
    }

    qs("serviceFormWrap").classList.add("hidden");
    toast(id ? "Servicio actualizado" : "Servicio agregado", "success");
    loadServices(currentLoadToken);
  });

  async function loadServices(token) {
    var wrap = qs("servicesTableWrap");
    var result = await supabase.from("services").select("*").order("sort_order", { ascending: true });
    if (isStaleLoad(token)) return;

    if (result.error) {
      wrap.innerHTML = '<div class="empty-state">No se pudieron cargar los servicios.</div>';
      return;
    }

    var services = result.data || [];
    if (!services.length) {
      wrap.innerHTML = '<div class="empty-state">Todavía no hay servicios. Agrega el primero.</div>';
      return;
    }

    var table = document.createElement("table");
    table.innerHTML =
      "<thead><tr><th>Nombre</th><th>Descripción</th><th>Ícono</th><th>Orden</th><th>Estado</th><th>Acciones</th></tr></thead><tbody></tbody>";
    var tbody = table.querySelector("tbody");

    services.forEach(function (service) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td></td><td></td><td></td><td></td><td></td><td></td>";
      var cells = tr.querySelectorAll("td");
      cells[0].textContent = service.name;
      cells[1].textContent = service.description;
      cells[2].textContent = ICON_LABELS[service.icon] || service.icon;
      cells[3].textContent = service.sort_order;
      cells[4].innerHTML =
        '<span class="badge ' +
        (service.active ? "badge-green" : "badge-gray") +
        '">' +
        (service.active ? "Activo" : "Oculto") +
        "</span>";

      var actions = document.createElement("div");
      actions.className = "row-actions";

      var editBtn = document.createElement("button");
      editBtn.className = "btn btn-secondary btn-sm";
      editBtn.textContent = "Editar";
      editBtn.addEventListener("click", function () {
        openServiceForm(service);
      });

      var deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn-danger btn-sm";
      deleteBtn.textContent = "Eliminar";
      deleteBtn.addEventListener("click", async function () {
        var confirmed = await confirmModal(
          "Eliminar servicio",
          'Esta acción eliminará "' + service.name + '" del sitio. ¿Continuar?',
        );
        if (!confirmed) return;
        var deleteResult = await supabase.from("services").delete().eq("id", service.id);
        if (deleteResult.error) {
          toast("No se pudo eliminar el servicio", "error");
          return;
        }
        toast("Servicio eliminado", "success");
        loadServices(currentLoadToken);
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      cells[5].appendChild(actions);

      tbody.appendChild(tr);
    });

    wrap.innerHTML = "";
    wrap.appendChild(table);
  }

  /* ---------- RESEÑAS ---------- */

  async function loadReviews(token) {
    var wrap = qs("reviewsTableWrap");
    var result = await supabase.from("reviews").select("*").order("created_at", { ascending: false });
    if (isStaleLoad(token)) return;

    if (result.error) {
      wrap.innerHTML = '<div class="empty-state">No se pudieron cargar las reseñas.</div>';
      return;
    }

    var reviews = result.data || [];
    if (!reviews.length) {
      wrap.innerHTML = '<div class="empty-state">Todavía no hay reseñas enviadas.</div>';
      return;
    }

    var table = document.createElement("table");
    table.innerHTML =
      "<thead><tr><th>Foto</th><th>Nombre</th><th>Calificación</th><th>Comentario</th><th>Estado</th><th>Acciones</th></tr></thead><tbody></tbody>";
    var tbody = table.querySelector("tbody");

    reviews.forEach(function (review) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td></td><td></td><td></td><td></td><td></td><td></td>";
      var cells = tr.querySelectorAll("td");
      if (review.photo_url) {
        var thumb = document.createElement("img");
        thumb.src = review.photo_url;
        thumb.alt = "Foto de " + review.name;
        thumb.className = "review-thumb";
        cells[0].appendChild(thumb);
      } else {
        cells[0].textContent = "—";
      }
      cells[1].textContent = review.name;
      cells[2].innerHTML = '<span class="stars-static"></span>';
      cells[2].querySelector(".stars-static").textContent =
        "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
      cells[3].textContent = review.comment;
      cells[4].innerHTML =
        '<span class="badge ' +
        (review.approved ? "badge-green" : "badge-yellow") +
        '">' +
        (review.approved ? "Publicada" : "Pendiente") +
        "</span>";

      var actions = document.createElement("div");
      actions.className = "row-actions";

      var toggleBtn = document.createElement("button");
      toggleBtn.className = "btn btn-secondary btn-sm";
      toggleBtn.textContent = review.approved ? "Ocultar" : "Aprobar";
      toggleBtn.addEventListener("click", async function () {
        var updateResult = await supabase
          .from("reviews")
          .update({ approved: !review.approved })
          .eq("id", review.id);
        if (updateResult.error) {
          toast("No se pudo actualizar la reseña", "error");
          return;
        }
        toast(review.approved ? "Reseña oculta" : "Reseña publicada", "success");
        loadReviews(currentLoadToken);
      });

      var deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn-danger btn-sm";
      deleteBtn.textContent = "Eliminar";
      deleteBtn.addEventListener("click", async function () {
        var confirmed = await confirmModal("Eliminar reseña", "Esta reseña se eliminará permanentemente. ¿Continuar?");
        if (!confirmed) return;
        var deleteResult = await supabase.from("reviews").delete().eq("id", review.id);
        if (deleteResult.error) {
          toast("No se pudo eliminar la reseña", "error");
          return;
        }
        toast("Reseña eliminada", "success");
        loadReviews(currentLoadToken);
      });

      actions.appendChild(toggleBtn);
      actions.appendChild(deleteBtn);
      cells[5].appendChild(actions);

      tbody.appendChild(tr);
    });

    wrap.innerHTML = "";
    wrap.appendChild(table);
  }

  /* ---------- TRABAJADORES ---------- */

  qs("newEmployeeBtn").addEventListener("click", function () {
    openEmployeeForm(null);
  });

  qs("cancelEmployeeBtn").addEventListener("click", function () {
    qs("employeeFormWrap").classList.add("hidden");
  });

  function openEmployeeForm(employee) {
    qs("employeeFormWrap").classList.remove("hidden");
    setFormMessage("employeeFormMsg", "", false);
    qs("employeeId").value = employee ? employee.id : "";
    qs("employeeName").value = employee ? employee.full_name : "";
    qs("employeeEmail").value = employee ? employee.email || "" : "";
    qs("employeeRole").value = employee ? employee.role : "";
    qs("employeeActive").value = employee ? String(employee.active) : "true";
    qs("employeeName").focus();
  }

  qs("employeeForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    setFormMessage("employeeFormMsg", "", false);

    var id = qs("employeeId").value;
    var payload = {
      full_name: qs("employeeName").value.trim(),
      email: qs("employeeEmail").value.trim() || null,
      role: qs("employeeRole").value.trim(),
      active: qs("employeeActive").value === "true",
    };

    var result = id
      ? await supabase.from("employees").update(payload).eq("id", id)
      : await supabase.from("employees").insert(payload);

    if (result.error) {
      setFormMessage("employeeFormMsg", "No se pudo guardar: " + result.error.message, true);
      return;
    }

    qs("employeeFormWrap").classList.add("hidden");
    toast(id ? "Trabajador actualizado" : "Trabajador agregado", "success");
    loadEmployees(currentLoadToken);
  });

  function checkinUrl(token, type) {
    var url = new URL("checkin.html", window.location.href);
    url.searchParams.set("token", token);
    url.searchParams.set("type", type);
    return url.toString();
  }

  function personalRegisterUrl(token) {
    var url = new URL("mi-registro.html", window.location.href);
    url.searchParams.set("token", token);
    return url.toString();
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast("Enlace copiado", "success");
      }).catch(function () {
        toast("No se pudo copiar el enlace", "error");
      });
    } else {
      toast("No se pudo copiar el enlace", "error");
    }
  }

  async function loadEmployees(token) {
    var wrap = qs("employeesTableWrap");
    var result = await supabase.from("employees").select("*").order("full_name", { ascending: true });
    if (isStaleLoad(token)) return;

    if (result.error) {
      wrap.innerHTML = '<div class="empty-state">No se pudieron cargar los trabajadores.</div>';
      return;
    }

    var employees = result.data || [];
    if (!employees.length) {
      wrap.innerHTML = '<div class="empty-state">Todavía no hay trabajadores registrados.</div>';
      return;
    }

    var table = document.createElement("table");
    table.innerHTML =
      "<thead><tr><th>Nombre</th><th>Puesto</th><th>Estado</th><th>Enlaces NFC</th><th>Registro personal (GPS)</th><th>Acciones</th></tr></thead><tbody></tbody>";
    var tbody = table.querySelector("tbody");

    employees.forEach(function (employee) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td></td><td></td><td></td><td></td><td></td><td></td>";
      var cells = tr.querySelectorAll("td");
      cells[0].textContent = employee.full_name;
      cells[1].textContent = employee.role;
      cells[2].innerHTML =
        '<span class="badge ' +
        (employee.active ? "badge-green" : "badge-gray") +
        '">' +
        (employee.active ? "Activo" : "Inactivo") +
        "</span>";

      var linksWrap = document.createElement("div");
      ["entrada", "salida"].forEach(function (type) {
        var url = checkinUrl(employee.checkin_token, type);
        var row = document.createElement("div");
        row.className = "nfc-link";
        row.innerHTML =
          "<span>" + (type === "entrada" ? "Entrada:" : "Salida:") + '</span><code></code>';
        row.querySelector("code").textContent = url;
        var copyBtn = document.createElement("button");
        copyBtn.className = "btn btn-secondary btn-sm";
        copyBtn.textContent = "Copiar";
        copyBtn.addEventListener("click", function () {
          copyToClipboard(url);
        });
        row.appendChild(copyBtn);
        linksWrap.appendChild(row);
      });
      cells[3].appendChild(linksWrap);

      var personalUrl = personalRegisterUrl(employee.checkin_token);
      var personalRow = document.createElement("div");
      personalRow.className = "nfc-link";
      personalRow.innerHTML = "<code></code>";
      personalRow.querySelector("code").textContent = personalUrl;
      var personalCopyBtn = document.createElement("button");
      personalCopyBtn.className = "btn btn-secondary btn-sm";
      personalCopyBtn.textContent = "Copiar";
      personalCopyBtn.addEventListener("click", function () {
        copyToClipboard(personalUrl);
      });
      personalRow.appendChild(personalCopyBtn);
      cells[4].appendChild(personalRow);

      var actions = document.createElement("div");
      actions.className = "row-actions";

      var editBtn = document.createElement("button");
      editBtn.className = "btn btn-secondary btn-sm";
      editBtn.textContent = "Editar";
      editBtn.addEventListener("click", function () {
        openEmployeeForm(employee);
      });

      var deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn-danger btn-sm";
      deleteBtn.textContent = "Eliminar";
      deleteBtn.addEventListener("click", async function () {
        var confirmed = await confirmModal(
          "Eliminar trabajador",
          'Se eliminará a "' + employee.full_name + '" y su historial de asistencia. ¿Continuar?',
        );
        if (!confirmed) return;
        var deleteResult = await supabase.from("employees").delete().eq("id", employee.id);
        if (deleteResult.error) {
          toast("No se pudo eliminar al trabajador", "error");
          return;
        }
        toast("Trabajador eliminado", "success");
        loadEmployees(currentLoadToken);
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      cells[5].appendChild(actions);

      tbody.appendChild(tr);
    });

    wrap.innerHTML = "";
    wrap.appendChild(table);
  }

  /* ---------- ASISTENCIA ---------- */

  async function loadAttendance(token) {
    var wrap = qs("attendanceTableWrap");
    var result = await supabase
      .from("attendance_logs")
      .select("id, type, occurred_at, notified, source, employees(full_name)")
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false })
      .limit(100);
    if (isStaleLoad(token)) return;

    updateTrashBadge();

    if (result.error) {
      wrap.innerHTML = '<div class="empty-state">No se pudo cargar la asistencia.</div>';
      return;
    }

    var logs = result.data || [];
    if (!logs.length) {
      wrap.innerHTML =
        '<div class="empty-state">Todavía no hay registros de entrada o salida. Cuando un trabajador escanee su NFC, aparecerá aquí.</div>';
      return;
    }

    var table = document.createElement("table");
    table.innerHTML =
      "<thead><tr><th>Trabajador</th><th>Tipo</th><th>Origen</th><th>Fecha y hora</th><th>Notificado</th><th>Acciones</th></tr></thead><tbody></tbody>";
    var tbody = table.querySelector("tbody");

    logs.forEach(function (log) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td></td><td></td><td></td><td></td><td></td><td></td>";
      var cells = tr.querySelectorAll("td");
      var employeeName = log.employees ? log.employees.full_name : "Trabajador eliminado";
      cells[0].textContent = employeeName;
      cells[1].innerHTML =
        '<span class="badge ' +
        (log.type === "entrada" ? "badge-green" : "badge-gray") +
        '">' +
        (log.type === "entrada" ? "Entrada" : "Salida") +
        "</span>";
      cells[2].textContent = log.source === "geolocation" ? "GPS" : "NFC";
      cells[3].textContent = new Date(log.occurred_at).toLocaleString("es-MX");
      cells[4].textContent = log.notified ? "Sí" : "No";

      var deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn-danger btn-sm";
      deleteBtn.textContent = "Eliminar";
      deleteBtn.addEventListener("click", async function () {
        var confirmed = await confirmModal(
          "Eliminar registro de asistencia",
          "Se eliminará el registro de " +
            employeeName +
            " (" +
            (log.type === "entrada" ? "entrada" : "salida") +
            ") del " +
            new Date(log.occurred_at).toLocaleString("es-MX") +
            '. Podrás verlo y restaurarlo después en la papelera. ¿Continuar?',
        );
        if (!confirmed) return;
        var updateResult = await supabase
          .from("attendance_logs")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", log.id);
        if (updateResult.error) {
          toast("No se pudo eliminar el registro", "error");
          return;
        }
        toast("Registro movido a la papelera", "success");
        loadAttendance(currentLoadToken);
      });
      cells[5].appendChild(deleteBtn);

      tbody.appendChild(tr);
    });

    wrap.innerHTML = "";
    wrap.appendChild(table);
  }

  /* ---------- PAPELERA DE ASISTENCIA ---------- */

  async function updateTrashBadge() {
    var badge = qs("trashBadge");
    var result = await supabase
      .from("attendance_logs")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null);

    var count = result.count || 0;
    badge.textContent = count;
    badge.classList.toggle("hidden", count === 0);
  }

  async function openTrashModal() {
    var root = qs("modalRoot");
    root.innerHTML =
      '<div class="modal-overlay"><div class="modal-card trash-modal-card">' +
      "<h3>Papelera de asistencia</h3>" +
      '<p>Registros eliminados por el administrador. Nada se borra de forma permanente: puedes restaurarlos aquí en cualquier momento.</p>' +
      '<div id="trashListWrap"></div>' +
      '<div class="modal-actions"><button class="btn btn-secondary" id="closeTrashBtn">Cerrar</button></div>' +
      "</div></div>";

    root.querySelector("#closeTrashBtn").addEventListener("click", function () {
      root.innerHTML = "";
    });
    root.querySelector(".modal-overlay").addEventListener("click", function (event) {
      if (event.target.classList.contains("modal-overlay")) root.innerHTML = "";
    });

    var listWrap = root.querySelector("#trashListWrap");
    listWrap.innerHTML = '<p class="detail">Cargando...</p>';

    var result = await supabase
      .from("attendance_logs")
      .select("id, type, occurred_at, source, deleted_at, employees(full_name)")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(100);

    if (result.error) {
      listWrap.innerHTML = '<div class="empty-state">No se pudo cargar la papelera.</div>';
      return;
    }

    var logs = result.data || [];
    if (!logs.length) {
      listWrap.innerHTML = '<div class="empty-state">La papelera está vacía.</div>';
      return;
    }

    var table = document.createElement("table");
    table.innerHTML =
      "<thead><tr><th>Trabajador</th><th>Tipo</th><th>Fecha original</th><th>Eliminado</th><th>Acciones</th></tr></thead><tbody></tbody>";
    var tbody = table.querySelector("tbody");

    logs.forEach(function (log) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td></td><td></td><td></td><td></td><td></td>";
      var cells = tr.querySelectorAll("td");
      cells[0].textContent = log.employees ? log.employees.full_name : "Trabajador eliminado";
      cells[1].innerHTML =
        '<span class="badge ' +
        (log.type === "entrada" ? "badge-green" : "badge-gray") +
        '">' +
        (log.type === "entrada" ? "Entrada" : "Salida") +
        "</span>";
      cells[2].textContent = new Date(log.occurred_at).toLocaleString("es-MX");
      cells[3].textContent = new Date(log.deleted_at).toLocaleString("es-MX");

      var restoreBtn = document.createElement("button");
      restoreBtn.className = "btn btn-primary btn-sm";
      restoreBtn.textContent = "Restaurar";
      restoreBtn.addEventListener("click", async function () {
        var updateResult = await supabase
          .from("attendance_logs")
          .update({ deleted_at: null })
          .eq("id", log.id);
        if (updateResult.error) {
          toast("No se pudo restaurar el registro", "error");
          return;
        }
        toast("Registro restaurado", "success");
        root.innerHTML = "";
        loadAttendance(currentLoadToken);
      });
      cells[4].appendChild(restoreBtn);

      tbody.appendChild(tr);
    });

    listWrap.innerHTML = "";
    listWrap.appendChild(table);
  }

  qs("openTrashBtn").addEventListener("click", openTrashModal);
})();
