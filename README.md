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

---

## 🐳 Docker Deployment (Recommended)

Deploy the entire stack (Vue 3 frontend, Express API, PostgreSQL database, and MinIO storage) with a single command.

### 1. Configure Environment

Copy the example environment file:
```bash
cp .env.example .env
```
*(Optional)* Edit `.env` to customize passwords, JWT secret, and ports.

### 2. Start Services

```bash
docker compose up -d --build
```

This will automatically:
1. Start **PostgreSQL 16** with persistent data volume (`postgres_data`).
2. Start **MinIO** object storage on ports 9000 & 9001.
3. Wait for PostgreSQL, automatically run database schema setup (`schema.sql`), and seed the initial superadmin.
4. Build and run the **Express API** backend exposed on port **5000**.
5. Build and serve the **Vue 3** frontend on port **5173**.

### 3. Access the Application

- **Frontend (Direct)**: `http://localhost:5173`
- **Backend API (Direct)**: `http://localhost:5000`
- **Host Nginx Gateway (if configured)**: `http://localhost:8080`
- **Default Superadmin Login**:
  - **Phone**: `0911000000`
  - **Password**: `Admin@1234`
  - *(Please change this password after your first login!)*
- **API Swagger Documentation**: `http://localhost:5000/api-docs` (or `http://localhost:8080/api-docs`)
- **MinIO Storage Console**: `http://localhost:9001` (User/Password: `minioadmin_change_me` / `minioadmin`)

### 4. Useful Docker Commands

```bash
# View live logs
docker compose logs -f

# Check status of containers
docker compose ps

# Stop all services
docker compose down

# Stop all services and remove persistent volumes (fresh start)
docker compose down -v
```

---

## 🚀 Manual Local Development Setup

### 1. Backend Setup

```bash
cd backend
npm install
```

- Create a `.env` file in `backend/.env`:
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
  npm run db:seed
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

- **Frontend**: Vue 3, Vite, Pinia, Vue Router, Vue I18n, Nginx Reverse Proxy
- **Backend**: Node.js, Express, PostgreSQL (`pg`), MinIO Object Storage, JWT Authentication, Swagger API Docs
- **Containerization**: Docker, Docker Compose, Multi-Stage Builds

