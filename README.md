# Casper Signal Analytics Dashboard

An internal analytics and business intelligence dashboard designed for **Head Office / Admins** and **Global Analysts** to monitor, query, and rank affiliate streamers' conversion performance based on structured daily recaps parsed automatically from Telegram channels.

---

## 🛠️ Tech Stack
- **Frontend**: React + Vite + Tailwind CSS v3 + Chart.js (React Chartjs-2)
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL (Dockerized for quick setups)
- **Telegram integration**: Telegraf Telegram Bot API (with polling listener)

---

## 📁 Project Structure
```text
/casper-signal-analytics
  ├── backend/               # Express Server & Telegraf Telegram Service
  │    ├── src/
  │    │    ├── config/      # PostgreSQL pool configuration
  │    │    ├── controllers/ # Auth, Streamers, Reports, and Dashboard calculations
  │    │    ├── db/          # SQL schemas, db initialization, and mock seed data
  │    │    ├── middleware/  # JWT Role permission validations
  │    │    ├── routes/      # REST API route binders
  │    │    └── services/    # Telegram message isolation block regex parser
  │    ├── .env              # Backend runtime environment configuration
  │    └── package.json      # Express dependencies definition
  │
  ├── frontend/              # Vite + React Client
  │    ├── src/
  │    │    ├── assets/
  │    │    ├── components/  # Layout shell, Sidebar navigations, Protected route
  │    │    ├── context/     # AuthContext state manager & JWT token cache
  │    │    ├── pages/       # Login, Dashboard, Ledger Reports, Leaderboards, Streamers
  │    │    └── services/    # Axios API request coordinator
  │    ├── tailwind.config.js# Tailwind design theme definitions
  │    ├── index.html        # Main template index file
  │    └── package.json      # React dependencies definition
  │
  ├── docker-compose.yml     # PostgreSQL docker compose image configuration
  └── package.json           # Monorepo command runner script configuration
```

---

## 🚀 How to Run the App Locally

### 1. Prerequisite
Ensure you have [Node.js (v18+)](https://nodejs.org/) installed and [Docker Desktop](https://www.docker.com/products/docker-desktop/) running.

### 2. Install Dependencies
Run the install command in the root folder to bootstrap both backend and frontend applications:
```bash
npm run install:all
```

### 3. Setup the Database
Spin up the local PostgreSQL database using Docker:
```bash
docker-compose up -d
```

Once the database container is online, initialize the tables and seed mock data:
```bash
# Initialize DB tables and seed default users
npm run db:init

# (Optional) Seed 30 days of mock streamers & historical performance data
npm run db:seed
```

### 4. Running the Servers
Open two terminal windows to run both servers simultaneously:

**Terminal 1 (Backend API & Bot Polling):**
```bash
npm run dev:backend
```
*(Runs on [http://localhost:5000](http://localhost:5000))*

**Terminal 2 (React Frontend Server):**
```bash
npm run dev:frontend
```
*(Runs on [http://localhost:5173](http://localhost:5173))*

---

## 🔒 Default Credentials
The database initialize script boots the application with two default accounts:
- **Admin / Head Office**:
  - Username: `admin`
  - Password: `password123`
- **Global Analyst**:
  - Username: `analyst`
  - Password: `password123`

---

## 🤖 Telegram Bot Message Format
To trigger the Telegram bot or the built-in Admin Simulator console, send messages matching this format:

```text
STREAMING (or NON STREAMING)
Tanggal : 20 JUNI 2026
Nama : Tizza

UPLOAD:
TikTok : 2 video
Youtube Short : -
Instagram Reels : -
Facebook FP : -

LIVE:
2 jam

CHAT:
150

REGISTRASI:
18

FTD:
5
```

### Ingestion Logic:
1. **Self-Healing Streamers**: If a streamer name is sent that doesn't exist in the database (e.g. `Tizza`), the bot will dynamically create the streamer on the fly and save the daily log.
2. **Double entry protection**: If a report is sent for the same streamer on the same date, the database executes an `UPSERT` to overwrite the existing log instead of creating duplicate records.
