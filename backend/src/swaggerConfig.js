const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EOS Church Contribution Management System API',
      version: '1.0.0',
      description: 'Full REST API documentation for Ethiopian Orthodox Church Contribution System (Superadmin, Branch Admin, Member roles)',
      contact: {
        name: 'EOS Church Tech Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Local Development Server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token obtained from POST /api/auth/login',
        },
      },
      schemas: {
        LoginRequest: {
          type: 'object',
          required: ['phone', 'password'],
          properties: {
            phone: { type: 'string', example: '0911000000' },
            password: { type: 'string', example: 'Admin@1234' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                full_name: { type: 'string' },
                role: { type: 'string', enum: ['superadmin', 'branch_admin', 'member'] },
                branch_id: { type: 'integer', nullable: true },
              },
            },
          },
        },
        Branch: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string', example: 'Addis Ababa Main' },
            location: { type: 'string', example: 'Bole, Addis Ababa' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            phone: { type: 'string', example: '0922000001' },
            full_name: { type: 'string', example: 'Tigist Haile' },
            role: { type: 'string', enum: ['superadmin', 'branch_admin', 'member'] },
            branch_id: { type: 'integer', nullable: true },
            avatar_url: { type: 'string', nullable: true, example: 'http://localhost:9000/eos-members/avatar-12345.png' },
            branch_name: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Contribution: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            member_id: { type: 'integer' },
            member_name: { type: 'string' },
            branch_id: { type: 'integer' },
            amount: { type: 'number', example: 150.5 },
            month_covered: { type: 'string', example: '2026-09-01' },
            date_paid: { type: 'string', example: '2026-09-16' },
            note: { type: 'string' },
          },
        },
      },
    },
    paths: {
      '/api/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Log in user (Superadmin, Branch Admin, or Member)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Successful login',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/LoginResponse' },
                },
              },
            },
            401: { description: 'Invalid phone or password' },
          },
        },
      },
      '/api/branches': {
        get: {
          tags: ['Branches (Superadmin Only)'],
          summary: 'List all branches',
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'List of branches' } },
        },
        post: {
          tags: ['Branches (Superadmin Only)'],
          summary: 'Create a new branch',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string' },
                    location: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'Branch created' } },
        },
      },
      '/api/members': {
        get: {
          tags: ['Members (Branch Admin Scoped)'],
          summary: 'List members in branch admin parish',
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'month', in: 'query', schema: { type: 'string', example: '2026-09' } },
          ],
          responses: { 200: { description: 'List of members' } },
        },
        post: {
          tags: ['Members (Branch Admin Scoped)'],
          summary: 'Create a member account with optional profile picture avatar',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['phone', 'password', 'full_name'],
                  properties: {
                    phone: { type: 'string', example: '0944000003' },
                    password: { type: 'string', example: 'Member@123' },
                    full_name: { type: 'string', example: 'Abebe Bikila' },
                    avatar: { type: 'string', format: 'binary', description: 'Optional profile picture file' },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'Member created' } },
        },
      },
      '/api/contributions': {
        get: {
          tags: ['Contributions'],
          summary: 'List contributions for parish',
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
            { name: 'month', in: 'query', schema: { type: 'string', example: '2026-09' } },
          ],
          responses: { 200: { description: 'Paginated contributions' } },
        },
        post: {
          tags: ['Contributions'],
          summary: 'Log cash or bank contribution for a member',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['member_id', 'amount', 'month_covered'],
                  properties: {
                    member_id: { type: 'integer' },
                    amount: { type: 'number', example: 200.0 },
                    month_covered: { type: 'string', example: '2026-09' },
                    note: { type: 'string', example: 'Cash payment' },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'Contribution recorded' } },
        },
      },
      '/api/reports/branch': {
        get: {
          tags: ['Reports'],
          summary: 'Branch monthly report with paid/unpaid breakdown',
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'month', in: 'query', schema: { type: 'string', example: '2026-09' } },
          ],
          responses: { 200: { description: 'Monthly report metrics and breakdown' } },
        },
      },
      '/api/reports/branch/export': {
        get: {
          tags: ['Reports'],
          summary: 'Export branch monthly report as CSV with UTF-8 BOM',
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'month', in: 'query', schema: { type: 'string', example: '2026-09' } },
          ],
          responses: { 200: { description: 'CSV file download' } },
        },
      },
      '/api/my-contributions': {
        get: {
          tags: ['Member Self-Service'],
          summary: 'Get logged in member personal contribution history',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'Personal contribution records' } },
        },
      },
    },
  },
  apis: [],
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = swaggerSpec;
