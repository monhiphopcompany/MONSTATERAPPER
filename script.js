document.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id);
  const config = window.MON_HIPHOP_CONFIG || {};
  const configured = config.SUPABASE_URL && config.SUPABASE_ANON_KEY &&
    !config.SUPABASE_URL.includes("YOUR-PROJECT") &&
    !config.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");

  const sidebar = $("sidebar");
  const overlay = $("overlay");
  $("year").textContent = new Date().getFullYear();

  function closeSidebar() {
    sidebar?.classList.remove("open");
    overlay?.classList.remove("show");
  }
  $("menuToggle")?.addEventListener("click", () => {
    sidebar.classList.add("open");
    overlay.classList.add("show");
  });
  $("closeMenu")?.addEventListener("click", closeSidebar);
  overlay?.addEventListener("click", closeSidebar);
  document.querySelectorAll(".side-nav a").forEach(link => link.addEventListener("click", closeSidebar));

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

  function createCard(item, index) {
    const card = document.createElement("article");
    card.className = item.type === "artist" ? "artist-card" : "release-card";
    if (item.image) {
      const img = document.createElement("img");
      img.src = driveImageUrl(item.image) || item.image;
      img.alt = item.name;
      img.loading = "lazy";
      img.onerror = () => img.remove();
      card.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "card-placeholder";
      placeholder.textContent = String(index + 1).padStart(2, "0");
      card.appendChild(placeholder);
    }
    const info = document.createElement("div");
    info.className = "card-info";
    const label = document.createElement("small");
    label.textContent = item.type === "artist" ? "MON HIPHOP ARTIST" : "MUSIC RELEASE";
    const title = document.createElement("h3");
    title.textContent = item.name;
    info.append(label, title);
    if (item.description) {
      const description = document.createElement("p");
      description.textContent = item.description;
      info.appendChild(description);
    }
    const arrow = document.createElement("span");
    arrow.className = "card-arrow";
    arrow.textContent = "↗";
    card.append(info, arrow);
    return card;
  }

  function render(items) {
    const artists = $("artistGrid");
    const releases = $("releaseGrid");
    artists.innerHTML = "";
    releases.innerHTML = "";
    const artistItems = items.filter(item => item.type === "artist");
    const releaseItems = items.filter(item => item.type === "release");
    (artistItems.length ? artistItems : Array.from({length: 5}, (_, i) => ({type: "artist", name: "ARTIST " + String(i + 1).padStart(2, "0")})))
      .forEach((item, i) => artists.appendChild(createCard(item, i)));
    (releaseItems.length ? releaseItems : Array.from({length: 5}, (_, i) => ({type: "release", name: "RELEASE " + String(i + 1).padStart(2, "0")})))
      .forEach((item, i) => releases.appendChild(createCard(item, i)));
  }

  if (!configured) {
    render([]);
    const warning = document.createElement("div");
    warning.className = "site-config-warning";
    warning.textContent = "Supabase is not configured yet. Add your project URL and anon key in config.js.";
    document.querySelector(".page")?.prepend(warning);
    return;
  }

  const { createClient } = window.supabase;
  const db = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

  async function loadContent() {
    const { data, error } = await db.from("content").select("id,type,name,description,drive_link,image,created_at,updated_at").order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      render([]);
      return;
    }
    render(data || []);
  }

  await loadContent();
  db.channel("public-content-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "content" }, () => loadContent())
    .subscribe();
});
