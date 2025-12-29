# Mango Trade

A seasonal mango trading management application built with React and Supabase.

## Features

- **Farmer Management**: Track farmers and credit purchases
- **Customer Management**: Walk-in, Delivery, and Credit customers
- **Sales & Billing**: Auto-generated invoices with suggested pricing
- **Payment Tracking**: Customer and farmer payments
- **Expense Management**: Rent, transport, and daily expenses
- **Reports**: Profit/Loss, Credit Ledger, Excel export

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Open http://localhost:3000

## Environment Variables

Create a `.env.local` file with:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Tech Stack

- React 18
- Vite
- Supabase (Backend & Auth)
- React Router
- Lucide React (Icons)
- SheetJS (Excel Export)
