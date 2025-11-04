# Lapip Backend API

Backend API for Lapip Store built with Node.js, Express, SQL Server, and Better Auth.

## Features

- **Authentication**: Email/password authentication using JWT
- **Products Management**: CRUD operations for products with categories
- **Orders Management**: Order creation and tracking
- **Payment Integration**: Easykash payment gateway integration
- **File Upload**: Image upload to Supabase Storage
- **Content Management**: Banners, blogs, testimonials, branches, and news

## Prerequisites

- Node.js >= 18
- SQL Server (local or remote)
- Supabase account (for image storage)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Configure your environment variables in `.env`

4. Create database:
```sql
CREATE DATABASE lapipDb;
```

5. Run SQL schema script:
```bash
# Connect to your SQL Server and run:
# backend/src/scripts/create-tables.sql
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Production

```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/logout` - Logout

### Products
- `GET /api/products` - Get all products (with pagination & filters)
- `GET /api/products/:id` - Get product by ID
- `GET /api/products/best-sellers` - Get best sellers
- `GET /api/products/limited-offers` - Get limited offers
- `POST /api/products` - Create product (Admin)
- `PUT /api/products/:id` - Update product (Admin)
- `DELETE /api/products/:id` - Delete product (Admin)

### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category (Admin)
- `PUT /api/categories/:id` - Update category (Admin)
- `DELETE /api/categories/:id` - Delete category (Admin)

### Orders
- `POST /api/orders` - Create order
- `GET /api/orders/my-orders` - Get user orders (Auth)
- `GET /api/orders/:id` - Get order by ID
- `GET /api/orders/tracking/:id` - Track order (Public)
- `PUT /api/orders/:id/status` - Update order status (Admin)

### Payment
- `POST /api/payment/initiate` - Initiate Easykash payment
- `POST /api/payment/callback` - Easykash callback webhook
- `GET /api/payment/:order_id/status` - Get payment status

### Content
- `GET /api/content/banners` - Get banners
- `GET /api/content/blogs` - Get blogs
- `GET /api/content/testimonials` - Get testimonials
- `GET /api/content/branches` - Get branches
- `GET /api/content/news` - Get news

### Upload
- `POST /api/upload/single` - Upload single file (Admin)
- `POST /api/upload/multiple` - Upload multiple files (Admin)
- `DELETE /api/upload` - Delete file (Admin)

## Environment Variables

See `.env.example` for all required environment variables.

## License

ISC


