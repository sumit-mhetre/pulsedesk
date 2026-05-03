# SimpleRx EMR Phase 1 Setup Guide

## Prerequisites
- Node.js (v18+)
- PostgreSQL (running locally)
- Git (optional)

---

## Step 1 - Create the Database

Open pgAdmin or psql and run:

```sql
CREATE DATABASE pulsedesk;
```

---

## Step 2 - Backend Setup

```bash
# Navigate to backend
cd pulsedesk/backend

# Install dependencies
npm install

# Copy environment file
copy .env.example .env
```

Now open `.env` and update:
```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/pulsedesk"
```
Replace `YOUR_PASSWORD` with your PostgreSQL password.

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations (creates all tables)
npx prisma migrate dev --name init

# Seed demo data
npm run seed

# Start the backend server
npm run dev
```

Backend will run on: **http://localhost:5000**

---

## Step 3 - Frontend Setup

Open a **new terminal window**:

```bash
# Navigate to frontend
cd pulsedesk/frontend

# Install dependencies
npm install

# Start the frontend
npm run dev
```

Frontend will run on: **http://localhost:5173**

---

## Step 4 - Open in Browser

Go to: **http://localhost:5173**

---

## Login Credentials

### Super Admin
| Field    | Value                    |
|----------|--------------------------|
| Email    | super@pulsedesk.com      |
| Password | superadmin123            |
| Note     | Leave Clinic ID blank, select "Super Admin" tab |

### Clinic Admin (Doctor)
| Field     | Value                         |
|-----------|-------------------------------|
| Clinic ID | (shown in terminal after seed)|
| Email     | admin@sharmaclinic.com        |
| Password  | password123                   |

### Doctor
| Field     | Value                         |
|-----------|-------------------------------|
| Clinic ID | (same as above)               |
| Email     | doctor@sharmaclinic.com       |
| Password  | password123                   |

### Receptionist
| Field     | Value                         |
|-----------|-------------------------------|
| Clinic ID | (same as above)               |
| Email     | reception@sharmaclinic.com    |
| Password  | password123                   |

> 💡 **Tip:** Copy the Clinic ID shown in the terminal after running `npm run seed`. You need it to log in as clinic users.

---

## What's Working in Phase 1

- ✅ Login with role-based access (Admin, Doctor, Receptionist, Super Admin)
- ✅ JWT authentication with auto token refresh
- ✅ Clinic setup page (admin can update clinic info)
- ✅ User management (admin can add/edit doctors and receptionists)
- ✅ Profile page (all users can update their profile)
- ✅ Super Admin dashboard (manage all clinics)
- ✅ Create new clinic from Super Admin panel

---

## Useful Commands

```bash
# View database in browser (Prisma Studio)
cd backend
npx prisma studio

# Reset database and re-seed
npx prisma migrate reset
npm run seed
```

---

## Folder Structure

```
pulsedesk/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma       ← Database schema
│   ├── src/
│   │   ├── controllers/        ← Business logic
│   │   ├── middleware/         ← Auth, validation
│   │   ├── routes/             ← API routes
│   │   ├── lib/                ← Prisma, JWT, helpers
│   │   ├── index.js            ← Server entry
│   │   └── seed.js             ← Demo data
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/         ← Reusable UI + guards
    │   ├── layouts/            ← Auth, Dash, Super layouts
    │   ├── lib/                ← Axios instance
    │   ├── pages/              ← All pages
    │   ├── store/              ← Zustand auth store
    │   ├── App.jsx             ← Routes
    │   ├── main.jsx            ← Entry
    │   └── index.css           ← Global styles
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
```

---

## Next: Phase 2
Once Phase 1 is running, say **"next"** and we build:
- Patient registration
- Token/Queue management
- Daily patient queue view
