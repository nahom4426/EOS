# EOS - Ethiopian Orthodox Church Contribution Management System ⛪

A full-stack web application designed for managing church contributions, members, branches, audit logs, and reports.

---

## 📁 Repository Structure

```text
EOS/
├── backend/    # Node.js / Express API & PostgreSQL database scripts
└── frontend/   # Vue 3 + Vite web application interface
```

---

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd backend
npm install
```

- Create a `.env` file based on `.env.example`:
  ```env
  PORT=5000
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eos_church
  JWT_SECRET=your_secret_key
  JWT_EXPIRES_IN=7d
  NODE_ENV=development
  ```
- Initialize database:
  ```bash
  npm run db:setup
  ```
- Start backend dev server:
  ```bash
  npm run dev
  ```

---

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The application will be accessible at `http://localhost:5173`.

---

## 🛠️ Tech Stack

- **Frontend**: Vue 3, Vite, Pinia, Vue Router, Vue I18n, Tailwind CSS / Custom UI
- **Backend**: Node.js, Express, PostgreSQL (`pg`), MinIO Object Storage, JWT Authentication, Swagger API Docs
