const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let currentUser = null;
let authMode = "login";
let toastTimer;
let activeCatalogType = "all";
let catalogItems = [];

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
function setAuthUI(user) {
  currentUser = user;
  $("#user-greeting").textContent = user ? `Hi, ${user.name.split(" ")[0]}` : "";
  $("#auth-button").classList.toggle("hidden", !!user);
  $("#logout-button").classList.toggle("hidden", !user);
  renderTrips([]);
  if (user) { loadTrips(); loadBookings(); } else renderBookings([]);
}
function openAuth(mode = "login") {
  authMode = mode;
  $("#auth-error").textContent = "";
  $("#auth-modal").classList.remove("hidden");
  updateAuthMode();
  setTimeout(() => $("#auth-email").focus(), 80);
}
function closeAuth() { $("#auth-modal").classList.add("hidden"); }
function updateAuthMode() {
  const register = authMode === "register";
  $("#auth-title").innerHTML = register ? "Start your <em>story.</em>" : "Welcome <em>aboard.</em>";
  $("#name-wrap").classList.toggle("hidden", !register);
  $("#auth-name").required = register;
  $("#auth-password").autocomplete = register ? "new-password" : "current-password";
  $("#auth-submit").textContent = register ? "Create account ↗" : "Sign in ↗";
  $$(".auth-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.mode === authMode));
  $("#auth-error").textContent = "";
}
function dateLabel(date) {
  if (!date) return "Date not set";
  return new Date(date + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function currency(amount) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount) || 0);
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
function renderTrips(trips) {
  $("#journey-count").textContent = `${trips.length} SAVED ${trips.length === 1 ? "TRIP" : "TRIPS"}`;
  const list = $("#trips-list");
  if (!currentUser) {
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">✳</span><h3>Your next story starts here.</h3><p>Sign in to save and revisit your travel plans.</p><button class="text-button" onclick="openAuth('login')">Sign in to begin ↗</button></div>`;
    return;
  }
  if (!trips.length) {
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">✳</span><h3>Your next story starts here.</h3><p>Your saved journeys will find a home here. Start with a destination that makes you curious.</p><a href="#planner" class="text-button">Start planning ↗</a></div>`;
    return;
  }
  list.innerHTML = trips.map(trip => `
    <article class="trip-card">
      <div class="trip-card-top"><span class="trip-style">${escapeHTML(trip.style || "YOUR JOURNEY").toUpperCase()} EDITION</span><h3>${escapeHTML(trip.title || trip.destination)}</h3><span class="trip-destination">⌖ &nbsp;${escapeHTML(trip.destination)}</span></div>
      <div class="trip-card-body">
        <div class="trip-meta"><span>↗ ${dateLabel(trip.startDate)}</span><span>↘ ${dateLabel(trip.endDate)}</span><span>♙ ${trip.travelers} traveler${trip.travelers === 1 ? "" : "s"}</span></div>
        <div class="trip-budget">${Number(trip.budget) ? currency(trip.budget) + " planned budget" : "Budget not set"}</div>
        ${trip.notes ? `<p class="trip-notes">${escapeHTML(trip.notes)}</p>` : ""}
        <div class="trip-actions"><button class="mini-button" data-edit="${trip.id}">Edit plan ↗</button><button class="mini-button delete" data-delete="${trip.id}">Delete</button></div>
      </div>
    </article>`).join("");
  $$("[data-edit]").forEach(btn => btn.addEventListener("click", () => editTrip(trips.find(t => t.id === btn.dataset.edit))));
  $$("[data-delete]").forEach(btn => btn.addEventListener("click", () => deleteTrip(btn.dataset.delete)));
}
async function loadTrips() {
  if (!currentUser) return;
  try { const data = await api("/api/trips"); renderTrips(data.trips); }
  catch (err) { if (err.message.includes("sign in")) setAuthUI(null); else toast(err.message); }
}
function editTrip(trip) {
  if (!trip) return;
  $("#trip-id").value = trip.id;
  $("#trip-title").value = trip.title || "";
  $("#destination").value = trip.destination || "";
  $("#start-date").value = trip.startDate || "";
  $("#end-date").value = trip.endDate || "";
  $("#travelers").value = String(Math.min(5, Number(trip.travelers) || 1));
  $("#style").value = trip.style || "Culture";
  $("#budget").value = trip.budget || "";
  $("#notes").value = trip.notes || "";
  $("#save-trip-button").innerHTML = "Update my journey <span>↗</span>";
  $("#planner").scrollIntoView({ behavior: "smooth" });
}
async function deleteTrip(id) {
  if (!confirm("Delete this journey? This cannot be undone.")) return;
  try { await api(`/api/trips/${encodeURIComponent(id)}`, { method: "DELETE" }); toast("Journey removed."); loadTrips(); }
  catch (err) { toast(err.message); }
}
function resetTripForm() {
  $("#trip-form").reset();
  $("#trip-id").value = "";
  $("#save-trip-button").innerHTML = "Save my journey <span>↗</span>";
}
$("#auth-button").addEventListener("click", () => openAuth("login"));
$("#logout-button").addEventListener("click", async () => {
  try { await api("/api/logout", { method: "POST" }); setAuthUI(null); toast("You've signed out. See you on the next adventure."); }
  catch (err) { toast(err.message); }
});
$$("[data-close-modal]").forEach(el => el.addEventListener("click", closeAuth));
$$(".auth-tab").forEach(tab => tab.addEventListener("click", () => { authMode = tab.dataset.mode; updateAuthMode(); }));
$("#auth-form").addEventListener("submit", async event => {
  event.preventDefault();
  $("#auth-error").textContent = "";
  const body = { email: $("#auth-email").value, password: $("#auth-password").value };
  if (authMode === "register") body.name = $("#auth-name").value;
  const submit = $("#auth-submit");
  submit.disabled = true;
  try {
    const data = await api(authMode === "register" ? "/api/register" : "/api/login", { method: "POST", body });
    setAuthUI(data.user);
    closeAuth();
    toast(authMode === "register" ? "Your travel journal is ready!" : "Welcome back. Let's wander.");
  } catch (err) { $("#auth-error").textContent = err.message; }
  finally { submit.disabled = false; }
});
$("#trip-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentUser) { openAuth("login"); toast("Sign in to save your journey."); return; }
  const id = $("#trip-id").value;
  const body = {
    title: $("#trip-title").value,
    destination: $("#destination").value,
    startDate: $("#start-date").value,
    endDate: $("#end-date").value,
    travelers: $("#travelers").value,
    style: $("#style").value,
    budget: $("#budget").value,
    notes: $("#notes").value
  };
  const button = $("#save-trip-button");
  button.disabled = true;
  try {
    await api(id ? `/api/trips/${encodeURIComponent(id)}` : "/api/trips", { method: id ? "PUT" : "POST", body });
    resetTripForm();
    await loadTrips();
    toast(id ? "Your journey has been updated." : "Journey saved. Let the countdown begin!");
    $("#my-trips").scrollIntoView({ behavior: "smooth" });
  } catch (err) { toast(err.message); if (err.message.includes("sign in")) openAuth("login"); }
  finally { button.disabled = false; }
});
$$("[data-destination]").forEach(card => card.addEventListener("click", () => {
  $("#destination").value = card.dataset.destination;
  $("#planner").scrollIntoView({ behavior: "smooth" });
  $("#destination").focus({ preventScroll: true });
}));
$("#surprise-button").addEventListener("click", () => {
  const places = ["Munnar, India", "Tbilisi, Georgia", "Hoi An, Vietnam", "Jaipur, India", "Madeira, Portugal", "Pokhara, Nepal"];
  const destination = places[Math.floor(Math.random() * places.length)];
  $("#destination").value = destination;
  $("#planner").scrollIntoView({ behavior: "smooth" });
  toast(`A little plot twist: ${destination} ✳`);
});
$("#mobile-menu").addEventListener("click", () => $(".desktop-nav").classList.toggle("open"));
$$(".nav-link").forEach(link => link.addEventListener("click", () => $(".desktop-nav").classList.remove("open")));
document.addEventListener("keydown", event => { if (event.key === "Escape") closeAuth(); });
const today = new Date();
const localISO = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
const week = new Date(today); week.setDate(today.getDate()+4);
$("#start-date").min = localISO(today);
$("#end-date").min = localISO(tomorrow);
$("#start-date").value = localISO(tomorrow);
$("#end-date").value = localISO(week);
$("#start-date").addEventListener("change", () => { $("#end-date").min = $("#start-date").value; if ($("#end-date").value < $("#start-date").value) $("#end-date").value = $("#start-date").value; });
(async function init() {
  try { const data = await api("/api/me"); setAuthUI(data.user); }
  catch { setAuthUI(null); }
  loadCatalog();
})();

const typeLabels = { stay: "Stay / room", food: "Food", cafe: "Café", activity: "Experience", transport: "Transport" };
function renderCatalog(items) {
  catalogItems = items;
  $("#catalog-result-count").textContent = `${items.length} ${items.length === 1 ? "find" : "curated finds"}`;
  const grid = $("#catalog-grid");
  if (!items.length) {
    grid.innerHTML = `<div class="catalog-empty">No matches yet. Try another city or category.</div>`;
    return;
  }
  grid.innerHTML = items.map(item => `
    <article class="catalog-card">
      <div class="catalog-image" style="background-image:url('${escapeHTML(item.image)}')">
        <span class="catalog-type">${escapeHTML(typeLabels[item.type] || item.type)}</span>
        <span class="catalog-rating">★ ${Number(item.rating).toFixed(1)}</span>
      </div>
      <div class="catalog-content">
        <span class="catalog-place">${escapeHTML(item.city)} · ${escapeHTML(item.region)}</span>
        <h3>${escapeHTML(item.name)}</h3>
        <p class="catalog-description">${escapeHTML(item.description)}</p>
        <div class="catalog-bottom"><div class="catalog-price"><strong>${currency(item.price)}</strong><small> / ${escapeHTML(item.unit)}</small></div><button class="catalog-book" data-book="${escapeHTML(item.id)}">Add to my plans ↗</button></div>
      </div>
    </article>`).join("");
  $$("[data-book]").forEach(button => button.addEventListener("click", () => startBooking(button.dataset.book)));
}
async function loadCatalog() {
  const q = $("#catalog-search").value.trim();
  $("#catalog-grid").innerHTML = `<div class="catalog-loading">Finding lovely places...</div>`;
  try {
    const params = new URLSearchParams({ type: activeCatalogType, q });
    const data = await api(`/api/catalog?${params.toString()}`);
    renderCatalog(data.items);
  } catch (err) {
    $("#catalog-grid").innerHTML = `<div class="catalog-empty">Could not load the catalog. Please refresh the page.</div>`;
  }
}
function startBooking(itemId) {
  const item = catalogItems.find(i => i.id === itemId);
  if (!item) return;
  if (!currentUser) { openAuth("login"); toast("Sign in to add this to your plans."); return; }
  const date = prompt(`Choose a date for "${item.name}" (YYYY-MM-DD):`, $("#start-date").value || new Date().toISOString().slice(0,10));
  if (date === null) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast("Please enter the date as YYYY-MM-DD."); return; }
  const quantityLabel = item.type === "stay" ? "How many nights?" : item.type === "transport" ? "How many rides / days?" : "How many people?";
  const raw = prompt(quantityLabel, "1");
  if (raw === null) return;
  const quantity = Number(raw);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 30) { toast("Choose a quantity from 1 to 30."); return; }
  api("/api/bookings", { method: "POST", body: { itemId, date, quantity } })
    .then(data => { toast(data.note || "Planning request saved."); loadBookings(); $("#my-bookings").scrollIntoView({ behavior: "smooth" }); })
    .catch(err => toast(err.message));
}
function renderBookings(bookings) {
  const list = $("#bookings-list");
  if (!list) return;
  $("#booking-count").textContent = `${bookings.length} ${bookings.length === 1 ? "REQUEST" : "REQUESTS"}`;
  if (!currentUser || !bookings.length) {
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">✳</span><h3>Your stay-and-savour list.</h3><p>${currentUser ? "Browse the catalog and add a sample booking request to see it here." : "Sign in and save a sample booking request from the catalog."}</p><a href="#explore" class="text-button">Explore places ↗</a></div>`;
    return;
  }
  list.innerHTML = bookings.map(b => `
    <article class="booking-item"><div><h3>${escapeHTML(b.itemName)}</h3><p>${escapeHTML(typeLabels[b.type] || b.type)} · ${escapeHTML(b.city)}<br>${dateLabel(b.date)} · Qty ${b.quantity}</p></div>
    <div class="booking-total"><strong>${currency(b.total)}</strong><span class="booking-status">${escapeHTML(b.status)}</span><br><button class="booking-delete" data-cancel-booking="${escapeHTML(b.id)}">Remove request</button></div></article>`).join("");
  $$("[data-cancel-booking]").forEach(btn => btn.addEventListener("click", async () => {
    if (!confirm("Remove this planning request?")) return;
    try { await api(`/api/bookings/${encodeURIComponent(btn.dataset.cancelBooking)}`, { method: "DELETE" }); toast("Planning request removed."); loadBookings(); }
    catch (err) { toast(err.message); }
  }));
}
async function loadBookings() {
  if (!currentUser) { renderBookings([]); return; }
  try { const data = await api("/api/bookings"); renderBookings(data.bookings); }
  catch (err) { if (err.message.includes("sign in")) renderBookings([]); }
}
$$(".catalog-tab").forEach(tab => tab.addEventListener("click", () => {
  activeCatalogType = tab.dataset.type;
  $$(".catalog-tab").forEach(item => item.classList.toggle("active", item === tab));
  loadCatalog();
}));
let catalogSearchTimer;
$("#catalog-search").addEventListener("input", () => {
  clearTimeout(catalogSearchTimer);
  catalogSearchTimer = setTimeout(loadCatalog, 180);
});
