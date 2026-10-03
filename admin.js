document.addEventListener("DOMContentLoaded", async () => {

  const $ = id => document.getElementById(id);

  const config = window.MON_HIPHOP_CONFIG || {};

  const configured =
    config.SUPABASE_URL &&
    config.SUPABASE_ANON_KEY &&
    !config.SUPABASE_URL.includes("YOUR-PROJECT") &&
    !config.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");

  if (!configured) {

    $("loginMessage").textContent =
      "Supabase is not configured. Add your project URL and anon key to config.js.";

    $("loginMessage").classList.add("error");

    return;
  }


  const { createClient } = window.supabase;

  const db = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY
  );


  let editingId = null;


  // ==========================================
  // MESSAGE
  // ==========================================

  function message(text, error = false) {

    $("formMessage").textContent = text;

    $("formMessage").classList.toggle(
      "error",
      error
    );
  }


  function loginMessage(text, error = false) {

    $("loginMessage").textContent = text;

    $("loginMessage").classList.toggle(
      "error",
      error
    );
  }


  // ==========================================
  // GOOGLE DRIVE IMAGE
  // ==========================================

  function driveImageUrl(url) {

    if (!url) return "";

    try {

      const parsed = new URL(url.trim());

      let id = parsed.searchParams.get("id");


      if (!id) {

        const match =
          url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);

        if (match) {
          id = match[1];
        }

      }


      if (!id && parsed.hostname === "drive.google.com") {

        const match =
          parsed.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);

        if (match) {
          id = match[1];
        }

      }


      return id
        ? "https://drive.google.com/uc?export=view&id=" +
          encodeURIComponent(id)
        : url;

    } catch {

      return "";

    }

  }


  // ==========================================
  // RESET FORM
  // ==========================================

  function resetForm() {

    editingId = null;

    $("contentType").value = "artist";

    $("itemName").value = "";

    $("itemDescription").value = "";

    $("driveLink").value = "";

    $("saveItem").textContent =
      "ADD CONTENT ↗";

    $("cancelEdit").hidden = true;

  }


  // ==========================================
  // CURRENT USER
  // ==========================================

  async function getCurrentUser() {

    const {
      data,
      error
    } = await db.auth.getUser();

    if (error) throw error;

    return data?.user || null;

  }


  // ==========================================
  // CHECK ADMIN
  // ==========================================

  async function isAdmin() {

    const user =
      await getCurrentUser();


    if (!user) {

      return {
        ok: false,
        user: null,
        reason: "not_signed_in"
      };

    }


    const {
      data,
      error
    } = await db
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();


    if (error) {

      return {
        ok: false,
        user,
        reason: "admin_check_error",
        error
      };

    }


    if (!data) {

      return {
        ok: false,
        user,
        reason: "not_authorized"
      };

    }


    return {
      ok: true,
      user
    };

  }


  // ==========================================
  // SHOW ADMIN
  // ==========================================

  async function showAdmin() {

    try {

      const result =
        await isAdmin();


      if (!result.ok) {

        if (
          result.reason ===
          "admin_check_error"
        ) {

          loginMessage(
            "Login succeeded, but Admin permission check failed: " +
            (result.error?.message ||
              "Unknown database error") +
            "\nCheck the admin_users row and RLS policy.",
            true
          );

        }

        else if (
          result.reason ===
          "not_authorized"
        ) {

          loginMessage(
            "Login succeeded, but this account is not an Admin.\n" +
            "Your Auth User UUID is: " +
            result.user.id +
            "\n\nAdd this UUID to public.admin_users.",
            true
          );

        }

        else {

          loginMessage(
            "Please sign in again.",
            true
          );

        }


        await db.auth.signOut();

        $("loginView").hidden = false;

        $("adminView").hidden = true;

        return false;

      }


      // ======================================
      // LOGIN SUCCESS
      // ======================================

      $("loginView").hidden = true;

      $("adminView").hidden = false;

      await renderAdminList();

      return true;

    }

    catch (error) {

      $("loginView").hidden = false;

      $("adminView").hidden = true;

      loginMessage(
        "Login succeeded, but the Admin page could not initialize: " +
        (error?.message ||
          "Unknown error"),
        true
      );

      return false;

    }

  }


  // ==========================================
  // GET CONTENT
  // ==========================================

  async function getItems() {

    const {
      data,
      error
    } = await db
      .from("content")
      .select(
        "id,type,name,description,drive_link,image,created_at,updated_at"
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      );


    if (error) throw error;

    return data || [];

  }


  // ==========================================
  // RENDER ADMIN LIST
  // ==========================================

  async function renderAdminList() {

    const list =
      $("adminList");

    list.innerHTML =
      "<p class='empty-admin'>Loading cloud content…</p>";


    try {

      const items =
        await getItems();


      list.innerHTML = "";


      if (!items.length) {

        list.innerHTML =
          '<p class="empty-admin">' +
          "No cloud content yet. Add an artist or release above." +
          "</p>";

        return;

      }


      items.forEach(
        (item, index) => {

          const row =
            document.createElement("article");

          row.className =
            "admin-item";


          const thumb =
            document.createElement("div");

          thumb.className =
            "admin-thumb";


          if (item.image) {

            const img =
              document.createElement("img");

            img.src =
              item.image;

            img.alt =
              item.name;


            img.onerror = () => {

              thumb.textContent =
                "NO IMAGE";

            };


            thumb.appendChild(img);

          }

          else {

            thumb.textContent =
              String(index + 1)
                .padStart(2, "0");

          }


          const info =
            document.createElement("div");

          info.className =
            "admin-item-info";


          const type =
            document.createElement("small");

          type.textContent =
            item.type === "artist"
              ? "ARTIST"
              : "RELEASE";


          const title =
            document.createElement("h3");

          title.textContent =
            item.name;


          const desc =
            document.createElement("p");

          desc.textContent =
            item.description ||
            "No description";


          info.append(
            type,
            title,
            desc
          );


          const actions =
            document.createElement("div");

          actions.className =
            "admin-item-actions";


          // EDIT
          const edit =
            document.createElement("button");

          edit.className =
            "edit-btn";

          edit.textContent =
            "EDIT";

          edit.onclick =
            () => editItem(item);


          // DELETE
          const del =
            document.createElement("button");

          del.className =
            "delete-btn";

          del.textContent =
            "DELETE";


          del.onclick =
            async () => {

              if (
                !confirm(
                  `Delete “${item.name}”?`
                )
              ) return;


              const {
                error
              } = await db
                .from("content")
                .delete()
                .eq(
                  "id",
                  item.id
                );


              if (error) {

                return message(
                  error.message,
                  true
                );

              }


              if (
                editingId ===
                item.id
              ) {

                resetForm();

              }


              message(
                "Content deleted."
              );


              renderAdminList();

            };


          actions.append(
            edit,
            del
          );


          row.append(
            thumb,
            info,
            actions
          );


          list.appendChild(row);

        }
      );

    }

    catch (error) {

      list.innerHTML =
        '<p class="empty-admin">' +
        "Unable to load cloud content." +
        "</p>";


      message(
        error.message ||
        "Unable to load content.",
        true
      );

    }

  }


  // ==========================================
  // EDIT
  // ==========================================

  function editItem(item) {

    editingId =
      item.id;


    $("contentType").value =
      item.type;


    $("itemName").value =
      item.name;


    $("itemDescription").value =
      item.description || "";


    $("driveLink").value =
      item.drive_link ||
      item.image ||
      "";


    $("saveItem").textContent =
      "UPDATE CONTENT ↗";


    $("cancelEdit").hidden =
      false;


    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });


    message(
      "Editing: " +
      item.name
    );

  }


  // ==========================================
  // LOGIN
  // ==========================================

  $("loginForm").addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const email =
        $("email").value.trim();


      const password =
        $("password").value;


      if (!email || !password) {
        return;
      }


      const button =
        event.submitter ||
        $("loginForm")
          .querySelector(
            "button[type=submit]"
          );


      if (button) {
        button.disabled = true;
      }


      loginMessage(
        "Signing in…"
      );


      try {

        const {
          data,
          error
        } = await db.auth
          .signInWithPassword({
            email,
            password
          });


        if (error) {

          loginMessage(
            error.message,
            true
          );

          return;

        }


        if (!data?.user) {

          loginMessage(
            "Supabase did not return a user session.",
            true
          );

          return;

        }


        loginMessage(
          "Login successful. Checking Admin permission…"
        );


        await showAdmin();

      }

      finally {

        if (button) {
          button.disabled = false;
        }

      }

    }
  );


  // ==========================================
  // LOGOUT
  // ==========================================

  $("logoutBtn").onclick =
    async () => {

      await db.auth.signOut();

      location.reload();

    };


  // ==========================================
  // SAVE / UPDATE
  // ==========================================

  $("saveItem").onclick =
    async () => {

      const type =
        $("contentType").value;


      const name =
        $("itemName")
          .value
          .trim();


      const description =
        $("itemDescription")
          .value
          .trim();


      const driveLink =
        $("driveLink")
          .value
          .trim();


      if (!name) {

        return message(
          "Please enter a name or title.",
          true
        );

      }


      const image =
        driveImageUrl(
          driveLink
        );


      if (
        driveLink &&
        !image
      ) {

        return message(
          "Please check the Google Drive image link.",
          true
        );

      }


      const payload = {

        type,

        name,

        description,

        drive_link:
          driveLink,

        image

      };


      let result;


      if (editingId) {

        result =
          await db
            .from("content")
            .update(payload)
            .eq(
              "id",
              editingId
            );

      }

      else {

        result =
          await db
            .from("content")
            .insert(
              payload
            );

      }


      if (result.error) {

        return message(
          result.error.message,
          true
        );

      }


      message(
        editingId
          ? "Content updated successfully."
          : "Content added successfully."
      );


      resetForm();

      await renderAdminList();

    };


  // ==========================================
  // CANCEL EDIT
  // ==========================================

  $("cancelEdit").onclick =
    () => {

      resetForm();

      message(
        "Edit cancelled."
      );

    };


  // ==========================================
  // IMPORT OLD LOCAL DATA
  // ==========================================

  $("importLocal").onclick =
    async () => {

      let localItems = [];


      try {

        localItems =
          JSON.parse(
            localStorage.getItem(
              "monHipHopContentV1"
            )
          ) || [];

      }

      catch {}


      if (!localItems.length) {

        return message(
          "No old local content was found in this browser.",
          true
        );

      }


      if (
        !confirm(
          `Import ${localItems.length} local item(s) into the cloud database?`
        )
      ) {
        return;
      }


      const payload =
        localItems.map(
          item => ({

            type:
              item.type === "release"
                ? "release"
                : "artist",

            name:
              item.name ||
              "Untitled",

            description:
              item.description ||
              "",

            drive_link:
              item.driveLink ||
              "",

            image:
              item.image ||
              driveImageUrl(
                item.driveLink ||
                ""
              )

          })
        );


      const {
        error
      } = await db
        .from("content")
        .insert(
          payload
        );


      if (error) {

        return message(
          error.message,
          true
        );

      }


      message(
        `Imported ${payload.length} item(s) to the cloud.`
      );


      await renderAdminList();

    };


  // ==========================================
  // REALTIME
  // ==========================================

  db.channel(
    "admin-content-sync"
  )

    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "content"
      },
      () => renderAdminList()
    )

    .subscribe();


  // ==========================================
  // CHECK EXISTING SESSION
  // ==========================================

  const {
    data: {
      session
    },
    error: sessionError
  } = await db.auth.getSession();


  if (sessionError) {

    loginMessage(
      sessionError.message,
      true
    );

  }

  else if (session) {

    await showAdmin();

  }

});
