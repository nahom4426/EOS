require('dotenv').config();
const express = require('express');
const cors = require('cors');

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swaggerConfig');

const authRouter = require('./routes/auth');
const branchesRouter = require('./routes/branches');
const branchAdminsRouter = require('./routes/branchAdmins');
const membersRouter = require('./routes/members');
const contributionsRouter = require('./routes/contributions');
const reportsRouter = require('./routes/reports');
const myContributionsRouter = require('./routes/myContributions');
const settingsRouter = require('./routes/settings');
const auditLogsRouter = require('./routes/auditLogs');

const path = require('path');

const app = express();

// Middleware — open CORS so frontend & Swagger can call API without restrictions
app.use(cors());
app.use(express.json());

// Serve static uploaded files (local fallback)
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/branches', branchesRouter);
app.use('/api/branch-admins', branchAdminsRouter);
app.use('/api/members', membersRouter);
app.use('/api/contributions', contributionsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/my-contributions', myContributionsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/audit-logs', auditLogsRouter);


// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

module.exports = app;
