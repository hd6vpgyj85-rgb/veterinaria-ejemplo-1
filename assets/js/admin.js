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

  function showTab(tab) {
    TABS.forEach(function (name) {
      qs("tab-" + name).classList.toggle("hidden", name !== tab);
    });
    document.querySelectorAll(".sidebar-nav button").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === tab);
    });
    qs("sidebar").classList.remove("open");

    if (tab === "resumen") loadResumen();
    if (tab === "dueno") loadBusinessSettings();
    if (tab === "servicios") loadServices();
    if (tab === "resenas") loadReviews();
    if (tab === "trabajadores") loadEmployees();
    if (tab === "asistencia") loadAttendance();
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

  supabase.auth.onAuthStateChange(function (event, session) {
    if (session) {
      qs("loginScreen").classList.add("hidden");
      qs("appShell").classList.remove("hidden");
      showTab("resumen");
    } else {
      qs("appShell").classList.add("hidden");
      qs("loginScreen").classList.remove("hidden");
      qs("loginForm").reset();
    }
  });

  /* ---------- RESUMEN ---------- */

  async function loadResumen() {
    var statGrid = qs("statGrid");
    var recentWrap = qs("recentAppointments");
    statGrid.innerHTML = "";
    recentWrap.innerHTML = "";

    var [servicesRes, reviewsRes, employeesRes, appointmentsRes] = await Promise.all([
      supabase.from("services").select("id", { count: "exact", head: true }).eq("active", true),
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("approved", false),
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("active", true),
      supabase.from("appointments").select("*").order("created_at", { ascending: false }).limit(6),
    ]);

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
      "<thead><tr><th>Nombre</th><th>Mascota</th><th>Servicio</th><th>Fecha</th><th>Teléfono</th></tr></thead><tbody></tbody>";
    var tbody = table.querySelector("tbody");
    appointments.forEach(function (appt) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td></td><td></td><td></td><td></td><td></td>";
      var cells = tr.querySelectorAll("td");
      cells[0].textContent = appt.owner_name;
      cells[1].textContent = appt.pet_name;
      cells[2].textContent = appt.service;
      cells[3].textContent = appt.preferred_date || "—";
      cells[4].textContent = appt.phone;
      tbody.appendChild(tr);
    });
    recentWrap.appendChild(table);
  }

  /* ---------- DUEÑO ---------- */

  async function loadBusinessSettings() {
    var result = await supabase.from("business_settings").select("*").eq("id", 1).maybeSingle();
    if (result.error || !result.data) return;
    var data = result.data;
    qs("bName").value = data.business_name || "";
    qs("bEmail").value = data.owner_email || "";
    qs("bWhatsapp").value = data.whatsapp_number || "";
    qs("bAddress").value = data.address || "";
    qs("bHoursWeekday").value = data.hours_weekday || "";
    qs("bHoursSaturday").value = data.hours_saturday || "";
    qs("bHoursSunday").value = data.hours_sunday || "";
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
    loadServices();
  });

  async function loadServices() {
    var wrap = qs("servicesTableWrap");
    var result = await supabase.from("services").select("*").order("sort_order", { ascending: true });

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
        loadServices();
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

  async function loadReviews() {
    var wrap = qs("reviewsTableWrap");
    var result = await supabase.from("reviews").select("*").order("created_at", { ascending: false });

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
        loadReviews();
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
        loadReviews();
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
    loadEmployees();
  });

  function checkinUrl(token, type) {
    var url = new URL("checkin.html", window.location.href);
    url.searchParams.set("token", token);
    url.searchParams.set("type", type);
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

  async function loadEmployees() {
    var wrap = qs("employeesTableWrap");
    var result = await supabase.from("employees").select("*").order("full_name", { ascending: true });

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
      "<thead><tr><th>Nombre</th><th>Puesto</th><th>Estado</th><th>Enlaces NFC</th><th>Acciones</th></tr></thead><tbody></tbody>";
    var tbody = table.querySelector("tbody");

    employees.forEach(function (employee) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td></td><td></td><td></td><td></td><td></td>";
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
        loadEmployees();
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      cells[4].appendChild(actions);

      tbody.appendChild(tr);
    });

    wrap.innerHTML = "";
    wrap.appendChild(table);
  }

  /* ---------- ASISTENCIA ---------- */

  async function loadAttendance() {
    var wrap = qs("attendanceTableWrap");
    var result = await supabase
      .from("attendance_logs")
      .select("id, type, occurred_at, notified, employees(full_name)")
      .order("occurred_at", { ascending: false })
      .limit(100);

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
      "<thead><tr><th>Trabajador</th><th>Tipo</th><th>Fecha y hora</th><th>Notificado</th></tr></thead><tbody></tbody>";
    var tbody = table.querySelector("tbody");

    logs.forEach(function (log) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td></td><td></td><td></td><td></td>";
      var cells = tr.querySelectorAll("td");
      cells[0].textContent = log.employees ? log.employees.full_name : "Trabajador eliminado";
      cells[1].innerHTML =
        '<span class="badge ' +
        (log.type === "entrada" ? "badge-green" : "badge-gray") +
        '">' +
        (log.type === "entrada" ? "Entrada" : "Salida") +
        "</span>";
      cells[2].textContent = new Date(log.occurred_at).toLocaleString("es-MX");
      cells[3].textContent = log.notified ? "Sí" : "No";
      tbody.appendChild(tr);
    });

    wrap.innerHTML = "";
    wrap.appendChild(table);
  }
})();
