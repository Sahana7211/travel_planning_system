# Travel — Travel Planning System

A responsive, full-stack travel planner with an editorial travel-magazine design.

## Features
- Separate pages for Discover, Destinations, Stays & Food, Experiences & Transport, Trip Planner, My Journeys dashboard, and Saved Requests
- Destination guide cards with suggested trip length, best seasons, and indicative budgets
- Search and filter listings by category, city, name, and travel vibe
- Create an account, sign in, and sign out
- Save, edit, and delete personal trips
- Destination inspiration cards that prefill the planner
- Searchable catalog of 18 sample stays, food spots, cafés, experiences, and transport options
- Filter listings by category and search by name, city, or vibe
- Save sample booking/planning requests to a personal list and remove them
- Trip title, destination, dates, number of travelers, travel style, budget in INR, and notes
- Random destination “Surprise me” action
- Responsive desktop/mobile layout
- Passwords hashed with bcryptjs
- Data persists in local JSON files (`data/users.json` and `data/trips.json`)

## Important demo note
The listings, prices, ratings, destination budgets, and dates are sample planning information. This project does not connect to hotel inventory, restaurant reservation systems, airlines, tour operators, live availability, or payment processing. Verify details directly with providers before travelling.

## Requirements
- Node.js 18 or later
- npm

## Run on Windows
1. Extract the ZIP file.
2. Open Command Prompt in the extracted `travel-planning-system` folder.
3. Run:

   ```bat
   npm install
   npm start
   ```

4. Open `http://localhost:3000` in your browser.
5. Choose **Sign in → Create account** to create your own account.

## Run in VS Code
Open the extracted folder in VS Code, choose **Terminal → New Terminal**, then run `npm install` and `npm start`.

## Project structure
```text
travel-planning-system/
├── data/
│   ├── bookings.json
│   ├── trips.json
│   └── users.json
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── package.json
├── server.js
└── README.md
```

## Notes
- The app uses JSON files as a lightweight local database, so no separate database setup is required.
- The photos and Google Fonts are loaded from external services and need an internet connection. If photos fail to load, the rest of the app still works.
- For public deployment, set a strong `SESSION_SECRET`, use HTTPS, and replace the default in-memory session store with a production session store. The default configuration is intended for local development/class projects.


## Accommodation, food, cafés, activities and transport
The Explore section includes a curated sample catalog with 18 demo listings across stays/rooms, food, cafés, experiences and transport. Use the category tabs or search field to filter listings. “Add to my plans” stores a planning request under the signed-in user's account.

**Important:** the catalog is demo data, not live inventory. It does not verify actual availability, contact providers, make a real reservation, or process payments. Prices are sample planning estimates.
