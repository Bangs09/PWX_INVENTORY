# PWX Inventory Management System

A modern dashboard for managing Packetworx inventory, including components, gateways, and warehouses.

## Project Structure

```
PWX_INVENTORY/
├── database/              ← SQL schemas & JSON definitions
│   ├── schema.sql
│   ├── db_schema.json
│   └── gateways_schema.json
├── scripts/               ← Utility & admin tools
│   ├── migrations/        ← Database migration scripts
│   │   ├── migrate-db.mjs
│   │   ├── migrate-activity.mjs
│   │   ├── migrate-inventory.mjs
│   │   └── migrate-tag.mjs
│   ├── tests/             ← Internal test scripts
│   │   ├── test-schema.js
│   │   ├── test-logs.js
│   │   └── test-gateways-schema.mjs
│   ├── fix-admin-password.mjs
│   ├── add-stock-constraints.mjs
│   └── check-db.mjs
├── src/                   ← Next.js source code
│   ├── app/               ← Pages & API routes
│   ├── components/        ← React components
│   ├── lib/               ← Shared libraries (DB connection, auth)
│   └── ...
├── public/                ← Static assets
├── database.sqlite        ← Local SQLite database (ignored by git)
├── package.json           ← Dependencies & scripts
└── ...
```

## Getting Started

### 1. Installation

```bash
npm install
```

### 2. Database Setup

Initialize the SQLite database with the current schema:

```bash
npm run db:migrate
```

(Optional) Seed with inventory data:

```bash
npm run db:migrate:all
```

### 3. Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Management Scripts

- `npm run db:migrate`: Applies `database/schema.sql` to the local database.
- `npm run db:fix-admin`: Resets default admin passwords and ensures admin accounts exist.
- `npm run db:check`: Checks the database connection and lists users.
- `npm run test`: Runs basic schema validation tests.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Database**: SQLite (better-sqlite3)
- **Styling**: Tailwind CSS
- **Components**: Shadcn/UI & Radix UI
- **Icons**: Lucide React
- **Forms**: React Hook Form & Zod
