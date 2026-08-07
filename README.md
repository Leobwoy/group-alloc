# Group Number Allocation System

A modern, multi-tenant web application for university classes to allocate unique, sequential group numbers in real-time.

---

## 🌟 Key Features

- **⚡ Race-Condition-Proof Sequential Allocation**: Atomic `UPDATE ... RETURNING` counter row in PostgreSQL guarantees zero duplicates (`#1, #2, #3...`) even under simultaneous submissions.
- **🛡️ Multi-Tenant Architecture**: Shared database with `tenant_id` isolation. Course reps can manage multiple classes across semesters.
- **👥 Two Fully Separate Portals**:
  - **Group Leader Portal (`/submit/:classCode`)**: Public, fast, mobile-first single submission with permanent assignment lock.
  - **Course Rep Portal (`/admin`)**: Authenticated JWT dashboard with live 4s polling, instant PDF roster generation, and CSV export.
- **📱 Highly Mobile Responsive**: Clean vertical cards on mobile devices, touch-friendly 48px tap targets, and safe-area notch padding.
- **📄 1-Click PDF Roster Export**: Formatted printable PDF presentation schedule for lecturers.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, PostgreSQL (`pg`), JWT authentication, `bcryptjs`, `nanoid`, `express-rate-limit`
- **Frontend**: React, Vite, React Router DOM, `jspdf`, `jspdf-autotable`, Vanilla CSS (Custom Design System)
- **Database**: PostgreSQL (Hosted on [Neon](https://neon.tech))

---

## 🚀 Local Development Setup

### 1. Prerequisites
- Node.js (v18+)
- Free PostgreSQL instance from [Neon.tech](https://neon.tech)

### 2. Configure Environment Variables
Inside `server/.env`:
```env
DATABASE_URL=postgresql://user:password@ep-xyz.region.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=your-secure-random-secret-key
PORT=5000
```

### 3. Install Dependencies
```bash
# From the root directory:
npm run install-all
```

### 4. Start Development Server
```bash
npm run dev
```
- **Course Rep Admin Portal**: [http://localhost:5173/admin](http://localhost:5173/admin)
- **Group Leader Portal**: `http://localhost:5173/submit/{classCode}`

---

## 🌐 Production Deployment Guide

### Step 1: Database (Neon — Free)
1. Sign up at [neon.tech](https://neon.tech) and create a new project.
2. Copy your connection string (`postgresql://...`).
3. The server automatically initializes tables on its first startup.

---

### Step 2: Deploy Backend (Render / Railway)

#### Option A: Render (Free Web Service)
1. Go to [dashboard.render.com](https://dashboard.render.com) and click **New > Web Service**.
2. Connect your GitHub repository (`Leobwoy/group-alloc`).
3. Configure the service:
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
4. Add **Environment Variables**:
   - `DATABASE_URL` = `<your_neon_connection_string>`
   - `JWT_SECRET` = `<any_random_string>`
   - `PORT` = `5000`
5. Click **Create Web Service**. Note your backend URL (e.g. `https://group-alloc-api.onrender.com`).

---

### Step 3: Deploy Frontend (Vercel / Netlify)

#### Option A: Vercel (Recommended)
1. Go to [vercel.com](https://vercel.com) and click **Add New > Project**.
2. Import `Leobwoy/group-alloc`.
3. Configure:
   - **Root Directory**: `client`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add **Environment Variable**:
   - `VITE_API_URL` = `https://group-alloc-api.onrender.com/api` (your backend URL + `/api`)
5. Click **Deploy**.

---

## 📁 Repository Structure

```
group-alloc/
├── package.json               # Root scripts (concurrent dev runner)
│
├── server/                    # Express Backend
│   ├── index.js               # Express entry & auto schema init
│   ├── db/
│   │   ├── pool.js            # PostgreSQL connection pool (Neon SSL)
│   │   └── schema.sql         # Multi-tenant schema DDL
│   ├── middleware/
│   │   └── auth.js            # JWT auth middleware
│   └── routes/
│       ├── rep.js             # /api/rep (admin auth, classes, groups, CSV)
│       └── submit.js          # /api/submit (atomic sequential allocation)
│
└── client/                    # React Frontend
    ├── index.html
    ├── vite.config.js         # Vite configuration with proxy
    └── src/
        ├── App.jsx            # Two isolated route trees (/admin & /submit)
        ├── index.css          # Mobile-first responsive design system
        ├── lib/
        │   └── api.js         # Fetch wrapper with JWT injection
        └── pages/
            ├── rep/
            │   ├── Login.jsx        # Rep sign in
            │   ├── Register.jsx     # Rep registration
            │   ├── Dashboard.jsx    # Class list & share links
            │   └── ClassDetail.jsx  # Live submission table & PDF/CSV
            └── submit/
                └── SubmitPage.jsx   # Mobile leader submission & assigned card
```

---

## 📄 License
MIT
