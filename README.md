# DealFlow360

DealFlow360 is an end-to-end quotation, approval, and billing engine built to handle complex B2B sales flows. It offers a comprehensive set of tools for sales representatives, managers, finance teams, and customers, streamlining everything from deal creation to recurring billing and fulfillment.

## 🚀 Key Features

*   **Dynamic Quotation Builder**: Create quotations with live margin calculations and real-time discount limits checking.
*   **Intelligent Auto-Routing & Approval Chains**: Implement complex approval workflows based on a **Blended Discount Risk Score**. Automatically route quotations to the correct level (Sales Manager, Finance) based on configured risk thresholds.
*   **Customer Portal & Negotiation**: A dedicated, role-restricted portal for customers to view quotations, negotiate discounts, communicate with reps in real-time, and confirm orders.
*   **Warehouse Auto-Split & Fulfillment**: Automatically calculate the optimal fulfillment split across multiple warehouses to minimize shipping costs and handle backorders seamlessly.
*   **Hybrid Billing Engine**: Handle both one-time purchases and recurring subscriptions in a single order, complete with automated proration and mid-cycle adjustments.
*   **Automated Invoicing & Payments**: Generate PDF invoices automatically and process payments securely via **Razorpay** integration.
*   **Real-Time Collaboration**: Powered by **Socket.io**, get instant updates on quotation status changes, approval actions, stock levels, and negotiation messages.
*   **Comprehensive Audit Trail**: Every action (approval, rejection, discount override, etc.) is logged with user, timestamp, and reason for complete accountability.

## 🛠️ Tech Stack

*   **Frontend**: React 18, Vite, React Router v6, TailwindCSS, Axios, React Query, Socket.io-client
*   **Backend**: Node.js, Express, Socket.io
*   **Database & ORM**: PostgreSQL, Prisma ORM
*   **Authentication**: JWT, bcrypt
*   **Integrations**: Nodemailer (Gmail SMTP), Razorpay, PDFKit (Invoice generation)
*   **Task Scheduling**: node-cron

## 📦 Project Structure

This project is a monorepo containing both the frontend and backend applications.

```
dealflow360/
├── frontend/       # React frontend application
├── backend/        # Node.js/Express backend application
└── docs/           # Documentation and architecture diagrams
```

## ⚙️ Prerequisites

Before you begin, ensure you have the following installed:
*   [Node.js](https://nodejs.org/) (v16 or higher)
*   [PostgreSQL](https://www.postgresql.org/)
*   [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

## 🚀 Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/dealflow360.git
    cd dealflow360
    ```

2.  **Setup the Backend:**
    ```bash
    cd backend
    npm install
    ```
    *   Create a `.env` file in the `backend` directory (see [Environment Variables](#environment-variables)).
    *   Run Prisma migrations to set up your database schema:
        ```bash
        npx prisma migrate dev
        ```
    *   Start the backend server:
        ```bash
        npm run dev
        ```

3.  **Setup the Frontend:**
    ```bash
    cd ../frontend
    npm install
    ```
    *   Create a `.env` file in the `frontend` directory.
    *   Start the frontend development server:
        ```bash
        npm run dev
        ```

## 🔐 Environment Variables

### Backend (`backend/.env`)
```env
PORT=5000
DATABASE_URL="postgresql://user:password@localhost:5432/dealflow360"
JWT_SECRET="your_jwt_secret_key"
GMAIL_USER="your-email@gmail.com"
GMAIL_APP_PASSWORD="your-gmail-app-password"
RAZORPAY_KEY_ID="your_razorpay_key_id"
RAZORPAY_KEY_SECRET="your_razorpay_secret"
```

### Frontend (`frontend/.env`)
```env
VITE_API_BASE_URL="http://localhost:5000/api"
VITE_SOCKET_URL="http://localhost:5000"
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
