document.addEventListener("DOMContentLoaded", async () => {
  const $ = id => document.getElementById(id);
  const config = window.MON_HIPHOP_CONFIG || {};
  const configured = config.SUPABASE_URL && config.SUPABASE_ANON_KEY &&
    !config.SUPABASE_URL.includes("YOUR-PROJECT") &&
    !config.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");

  if (!configured) {
    $("loginMessage").textContent = "Supabase is not configured. Add your project URL and anon key to config.js.";
    $("loginMessage").classList.add("error");
    return;
  }

  const { createClient } = window.supabase;
  const db = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  let editingId = null;

  function message(text, error = false) {
    $("formMessage").textContent = text;
    $("formMessage").classList.toggle("error", error);
  }

  function loginMessage(text, error = false) {
    $("loginMessage").textContent = text;
    $("loginMessage").classList.toggle("error", error);
  }

  function driveImageUrl(url) {
    if (!url) return "";
    try {
      const parsed = new URL(url.trim());
      let id = parsed.searchParams.get("id");
      if (!id) {
        const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match) id = match[1];
      }
      if (!id && parsed.hostname === "drive.google.com") {
        const match = parsed.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match) id = match[1];
      }
      return id ? "https://drive.google.com/uc?export=view&id=" + encodeURIComponent(id) : url;
    } catch { return ""; }
  }

  function resetForm() {
    editingId = null;
    $("contentType").value = "artist";
    $("itemName").value = "";
    $("itemDescription").value = "";
    $("driveLink").value = "";
    $("saveItem").textContent = "ADD CONTENT ↗";
    $("cancelEdit").hidden = true;
  }

  async function isAdmin() {
    const { data: { user } } = await db.auth.getUser();
    if (!user) return false;
    const { data, error } = await db.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    return !error && !!data;
  }

  async function showAdmin() {
    if (!(await isAdmin())) {
      await db.auth.signOut();
      $("loginView").hidden = false;
      $("adminView").hidden = true;
      loginMessage("This account is not authorized as an Admin.", true);
      return;
    }
    $("loginView").hidden = true;
    $("adminView").hidden = false;
    await renderAdminList();
  }

  async function getItems() {
    const { data, error } = await db.from("content").select("id,type,name,description,drive_link,image,created_at,updated_at").order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function renderAdminList() {
    const list = $("adminList");
    list.innerHTML = "<p class='empty-admin'>Loading cloud content…</p>";
    try {
      const items = await getItems();
      list.innerHTML = "";
      if (!items.length) {
        list.innerHTML = '<p class="empty-admin">No cloud content yet. Add an artist or release above.</p>';
        return;
      }
      items.forEach((item, index) => {
        const row = document.createElement("article");
        row.className = "admin-item";
        const thumb = document.createElement("div");
        thumb.className = "admin-thumb";
        if (item.image) {
          const img = document.createElement("img");
          img.src = item.image;
          img.alt = item.name;
          img.onerror = () => { thumb.textContent = "NO IMAGE"; };
          thumb.appendChild(img);
        } else thumb.textContent = String(index + 1).padStart(2, "0");
        const info = document.createElement("div");
        info.className = "admin-item-info";
        const type = document.createElement("small");
        type.textContent = item.type === "artist" ? "ARTIST" : "RELEASE";
        const title = document.createElement("h3");
        title.textContent = item.name;
        const desc = document.createElement("p");
        desc.textContent = item.description || "No description";
        info.append(type, title, desc);
        const actions = document.createElement("div");
        actions.className = "admin-item-actions";
        const edit = document.createElement("button");
        edit.className = "edit-btn";
        edit.textContent = "EDIT";
        edit.onclick = () => editItem(item);
        const del = document.createElement("button");
        del.className = "delete-btn";
        del.textContent = "DELETE";
        del.onclick = async () => {
          if (!confirm(`Delete “${item.name}”?`)) return;
          const { error } = await db.from("content").delete().eq("id", item.id);
          if (error) return message(error.message, true);
          if (editingId === item.id) resetForm();
          message("Content deleted.");
          renderAdminList();
        };
        actions.append(edit, del);
        row.append(thumb, info, actions);
        list.appendChild(row);
      });
    } catch (error) {
      list.innerHTML = '<p class="empty-admin">Unable to load cloud content.</p>';
      message(error.message || "Unable to load content.", true);
    }
  }

  function editItem(item) {
    editingId = item.id;
    $("contentType").value = item.type;
    $("itemName").value = item.name;
    $("itemDescription").value = item.description || "";
    $("driveLink").value = item.drive_link || item.image || "";
    $("saveItem").textContent = "UPDATE CONTENT ↗";
    $("cancelEdit").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
    message("Editing: " + item.name);
  }

  $("loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    loginMessage("Signing in…");
    const { error } = await db.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
    if (error) return loginMessage(error.message, true);
    await showAdmin();
  });

  $("logoutBtn").onclick = async () => {
    await db.auth.signOut();
    location.reload();
  };

  $("saveItem").onclick = async () => {
    const type = $("contentType").value;
    const name = $("itemName").value.trim();
    const description = $("itemDescription").value.trim();
    const driveLink = $("driveLink").value.trim();
    if (!name) return message("Please enter a name or title.", true);
    const image = driveImageUrl(driveLink);
    if (driveLink && !image) return message("Please check the Google Drive image link.", true);

    const payload = { type, name, description, drive_link: driveLink, image };
    let result;
    if (editingId) result = await db.from("content").update(payload).eq("id", editingId);
    else result = await db.from("content").insert(payload);
    if (result.error) return message(result.error.message, true);
    message(editingId ? "Content updated successfully." : "Content added successfully.");
    resetForm();
    await renderAdminList();
  };

  $("cancelEdit").onclick = () => { resetForm(); message("Edit cancelled."); };

  $("importLocal").onclick = async () => {
    let localItems = [];
    try { localItems = JSON.parse(localStorage.getItem("monHipHopContentV1")) || []; } catch {}
    if (!localItems.length) return message("No old local content was found in this browser.", true);
    if (!confirm(`Import ${localItems.length} local item(s) into the cloud database?`)) return;
    const payload = localItems.map(item => ({
      type: item.type === "release" ? "release" : "artist",
      name: item.name || "Untitled",
      description: item.description || "",
      drive_link: item.driveLink || "",
      image: item.image || driveImageUrl(item.driveLink || "")
    }));
    const { error } = await db.from("content").insert(payload);
    if (error) return message(error.message, true);
    message(`Imported ${payload.length} item(s) to the cloud.`);
    await renderAdminList();
  };

  db.channel("admin-content-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "content" }, () => renderAdminList())
    .subscribe();

  const { data: { session } } = await db.auth.getSession();
  if (session) await showAdmin();
});
