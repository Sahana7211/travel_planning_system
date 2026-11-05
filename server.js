const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const TRIPS_FILE = path.join(DATA_DIR, "trips.json");
const BOOKINGS_FILE = path.join(DATA_DIR, "bookings.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
for (const file of [USERS_FILE, TRIPS_FILE, BOOKINGS_FILE]) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, "[]", "utf8");
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return []; }
}
function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}
function safeUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Please sign in to continue." });
  next();
}

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "change-this-travel-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/me", (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = readJson(USERS_FILE).find(u => u.id === req.session.userId);
  res.json({ user: user ? safeUser(user) : null });
});

app.post("/api/register", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (name.length < 2) return res.status(400).json({ error: "Enter your name (at least 2 characters)." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 6) return res.status(400).json({ error: "Password must contain at least 6 characters." });
  const users = readJson(USERS_FILE);
  if (users.some(u => u.email === email)) return res.status(409).json({ error: "An account with this email already exists. Please sign in." });
  const user = { id: "u_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), name, email, passwordHash: await bcrypt.hash(password, 10), createdAt: new Date().toISOString() };
  users.push(user);
  writeJson(USERS_FILE, users);
  req.session.userId = user.id;
  res.status(201).json({ user: safeUser(user) });
});

app.post("/api/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = readJson(USERS_FILE).find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  req.session.userId = user.id;
  res.json({ user: safeUser(user) });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/trips", requireAuth, (req, res) => {
  const trips = readJson(TRIPS_FILE)
    .filter(t => t.userId === req.session.userId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json({ trips });
});

app.post("/api/trips", requireAuth, (req, res) => {
  const body = req.body || {};
  const destination = String(body.destination || "").trim();
  const startDate = String(body.startDate || "");
  const endDate = String(body.endDate || "");
  if (!destination) return res.status(400).json({ error: "Add a destination first." });
  if (!startDate || !endDate || endDate < startDate) return res.status(400).json({ error: "Choose valid travel dates." });
  const trip = {
    id: "t_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    userId: req.session.userId,
    title: String(body.title || `${destination} escape`).trim().slice(0, 80),
    destination: destination.slice(0, 100),
    startDate,
    endDate,
    travelers: Math.max(1, Math.min(30, Number(body.travelers) || 1)),
    budget: Math.max(0, Number(body.budget) || 0),
    style: String(body.style || "Culture").slice(0, 40),
    notes: String(body.notes || "").slice(0, 2000),
    itinerary: Array.isArray(body.itinerary) ? body.itinerary.slice(0, 80) : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const trips = readJson(TRIPS_FILE);
  trips.push(trip);
  writeJson(TRIPS_FILE, trips);
  res.status(201).json({ trip });
});

app.put("/api/trips/:id", requireAuth, (req, res) => {
  const trips = readJson(TRIPS_FILE);
  const index = trips.findIndex(t => t.id === req.params.id && t.userId === req.session.userId);
  if (index < 0) return res.status(404).json({ error: "Trip not found." });
  const body = req.body || {};
  const old = trips[index];
  const destination = String(body.destination ?? old.destination).trim();
  const startDate = String(body.startDate ?? old.startDate);
  const endDate = String(body.endDate ?? old.endDate);
  if (!destination) return res.status(400).json({ error: "Destination is required." });
  if (!startDate || !endDate || endDate < startDate) return res.status(400).json({ error: "Choose valid travel dates." });
  trips[index] = {
    ...old,
    title: String(body.title ?? old.title).trim().slice(0, 80),
    destination: destination.slice(0, 100),
    startDate, endDate,
    travelers: Math.max(1, Math.min(30, Number(body.travelers ?? old.travelers) || 1)),
    budget: Math.max(0, Number(body.budget ?? old.budget) || 0),
    style: String(body.style ?? old.style).slice(0, 40),
    notes: String(body.notes ?? old.notes).slice(0, 2000),
    itinerary: Array.isArray(body.itinerary) ? body.itinerary.slice(0, 80) : old.itinerary,
    updatedAt: new Date().toISOString()
  };
  writeJson(TRIPS_FILE, trips);
  res.json({ trip: trips[index] });
});

app.delete("/api/trips/:id", requireAuth, (req, res) => {
  const trips = readJson(TRIPS_FILE);
  const next = trips.filter(t => !(t.id === req.params.id && t.userId === req.session.userId));
  if (next.length === trips.length) return res.status(404).json({ error: "Trip not found." });
  writeJson(TRIPS_FILE, next);
  res.json({ ok: true });
});


// Curated sample catalog for discovery and demo bookings. These are examples, not live inventory.
const catalog = [
  { id:"stay-01", type:"stay", name:"The Fern Residency", city:"Bengaluru", region:"Karnataka", price:4200, unit:"night", rating:4.4, tag:"Eco comfort", image:"https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80", description:"A comfortable city base with green touches and easy access to central Bengaluru." },
  { id:"stay-02", type:"stay", name:"Misty Mountain Retreat", city:"Munnar", region:"Kerala", price:5600, unit:"night", rating:4.7, tag:"Hill escape", image:"https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=900&q=80", description:"Wake up to misty hills, tea gardens and slow mornings." },
  { id:"stay-03", type:"stay", name:"Ocean Pearl Stay", city:"Goa", region:"Goa", price:6800, unit:"night", rating:4.5, tag:"Coastal hideaway", image:"https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=80", description:"A laid-back stay for beach days and sunset walks." },
  { id:"stay-04", type:"stay", name:"Pink City Haveli", city:"Jaipur", region:"Rajasthan", price:3900, unit:"night", rating:4.6, tag:"Heritage charm", image:"https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=900&q=80", description:"Traditional details, courtyard calm and easy access to old Jaipur." },
  { id:"stay-05", type:"stay", name:"Lakeview House", city:"Udaipur", region:"Rajasthan", price:7200, unit:"night", rating:4.8, tag:"Lake views", image:"https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=900&q=80", description:"A romantic lakeside-style stay for an unhurried city break." },
  { id:"stay-06", type:"stay", name:"Himalayan Basecamp Lodge", city:"Manali", region:"Himachal Pradesh", price:3400, unit:"night", rating:4.3, tag:"Mountain base", image:"https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=900&q=80", description:"A cosy base for mountain air, scenic drives and outdoor days." },
  { id:"food-01", type:"food", name:"The Local Thali Table", city:"Jaipur", region:"Rajasthan", price:450, unit:"person", rating:4.6, tag:"Regional favourites", image:"https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=900&q=80", description:"A welcoming spot for a generous regional thali and local flavours." },
  { id:"food-02", type:"food", name:"Coastal Curry House", city:"Goa", region:"Goa", price:750, unit:"person", rating:4.5, tag:"Coastal cuisine", image:"https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=900&q=80", description:"Seafood-inspired coastal plates and bright, bold Goan flavours." },
  { id:"food-03", type:"food", name:"Spice Route Kitchen", city:"Kochi", region:"Kerala", price:600, unit:"person", rating:4.4, tag:"Kerala classics", image:"https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=900&q=80", description:"Comforting Kerala dishes with aromatic spices and seasonal ingredients." },
  { id:"food-04", type:"food", name:"Mountain Momos Corner", city:"Manali", region:"Himachal Pradesh", price:280, unit:"person", rating:4.3, tag:"Quick bite", image:"https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=900&q=80", description:"A casual stop for warm dumplings and quick mountain-town bites." },
  { id:"cafe-01", type:"cafe", name:"Little Fern Café", city:"Bengaluru", region:"Karnataka", price:500, unit:"person", rating:4.7, tag:"Garden café", image:"https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=900&q=80", description:"Coffee, brunch plates and a leafy corner to pause between plans." },
  { id:"cafe-02", type:"cafe", name:"Blue Door Coffee", city:"Jaipur", region:"Rajasthan", price:380, unit:"person", rating:4.4, tag:"Coffee & quiet", image:"https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=900&q=80", description:"A relaxed café stop for espresso, iced coffee and a little downtime." },
  { id:"cafe-03", type:"cafe", name:"Seaside Brew Bar", city:"Goa", region:"Goa", price:420, unit:"person", rating:4.5, tag:"Beach-town café", image:"https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=900&q=80", description:"A breezy coffee stop for slow breakfasts and post-beach refreshers." },
  { id:"activity-01", type:"activity", name:"Sunrise Tea Garden Walk", city:"Munnar", region:"Kerala", price:900, unit:"person", rating:4.8, tag:"Nature", image:"https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=900&q=80", description:"A guided early walk through scenic tea-country viewpoints." },
  { id:"activity-02", type:"activity", name:"Old City Heritage Trail", city:"Jaipur", region:"Rajasthan", price:700, unit:"person", rating:4.6, tag:"Culture", image:"https://images.unsplash.com/photo-1599661046827-dacff0c0f09a?auto=format&fit=crop&w=900&q=80", description:"Explore historic lanes, colourful markets and architectural details." },
  { id:"activity-03", type:"activity", name:"Backwater Canoe Experience", city:"Alleppey", region:"Kerala", price:1500, unit:"person", rating:4.7, tag:"On the water", image:"https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=900&q=80", description:"A small-group paddle through peaceful backwater scenery." },
  { id:"activity-04", type:"activity", name:"Sunset Fort Photo Walk", city:"Udaipur", region:"Rajasthan", price:850, unit:"person", rating:4.5, tag:"Golden hour", image:"https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=900&q=80", description:"A photo-friendly walk timed for warm evening light." },
  { id:"transport-01", type:"transport", name:"Airport-to-City Transfer", city:"Bengaluru", region:"Karnataka", price:1200, unit:"ride", rating:4.4, tag:"Easy arrival", image:"https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=900&q=80", description:"A sample private transfer option for planning your arrival." },
  { id:"transport-02", type:"transport", name:"Hill Country Day Cab", city:"Munnar", region:"Kerala", price:2600, unit:"day", rating:4.5, tag:"Scenic route", image:"https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=900&q=80", description:"A sample full-day car hire for flexible sightseeing." }
].filter(item => !item.image.includes("unsplash.com/photo-156324%20공"));

app.get("/api/catalog", (req, res) => {
  const type = String(req.query.type || "all");
  const city = String(req.query.city || "").trim().toLowerCase();
  const q = String(req.query.q || "").trim().toLowerCase();
  let items = catalog.filter(item => (type === "all" || item.type === type)
    && (!city || item.city.toLowerCase().includes(city) || item.region.toLowerCase().includes(city))
    && (!q || [item.name, item.city, item.region, item.description, item.tag].some(v => v.toLowerCase().includes(q))));
  res.json({ items, total: items.length, demoInventory: true });
});

app.get("/api/bookings", requireAuth, (req, res) => {
  const bookings = readJson(BOOKINGS_FILE).filter(b => b.userId === req.session.userId).sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
  res.json({ bookings });
});

app.post("/api/bookings", requireAuth, (req, res) => {
  const itemId = String(req.body.itemId || "");
  const item = catalog.find(i => i.id === itemId);
  if (!item) return res.status(404).json({ error: "That listing could not be found." });
  const date = String(req.body.date || "");
  const quantity = Math.max(1, Math.min(30, Number(req.body.quantity) || 1));
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Choose a valid date." });
  const booking = {
    id: "b_" + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    userId: req.session.userId,
    itemId: item.id, itemName: item.name, type: item.type, city: item.city,
    date, quantity, unitPrice: item.price, total: item.price * quantity,
    status: "Planning request", createdAt: new Date().toISOString()
  };
  const bookings = readJson(BOOKINGS_FILE);
  bookings.push(booking);
  writeJson(BOOKINGS_FILE, bookings);
  res.status(201).json({ booking, note: "Demo planning request saved. No real reservation or payment has been made." });
});

app.delete("/api/bookings/:id", requireAuth, (req, res) => {
  const bookings = readJson(BOOKINGS_FILE);
  const next = bookings.filter(b => !(b.id === req.params.id && b.userId === req.session.userId));
  if (next.length === bookings.length) return res.status(404).json({ error: "Booking request not found." });
  writeJson(BOOKINGS_FILE, next);
  res.json({ ok: true });
});


app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`Travel is running at http://localhost:${PORT}`));
