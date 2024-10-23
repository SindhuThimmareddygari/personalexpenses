
# Personal Expense Tracker

## Setup Instructions

1. Clone the repository.
2. Navigate to the project directory.
3. Install dependencies:
   ```bash
   npm install
Run the application:

node index.js
The API will be available at http://localhost:3000.
API Endpoints
1. Add Transaction
POST /transactions
Request Body:
json
Copy code
{
    "type": "expense",
    "category": "Food",
    "amount": 20.5,
    "date": "2024-10-23",
    "description": "Lunch"
}
2. Get Transactions
GET /transactions
Response: Array of transactions.
3. Get Transaction by ID
GET /transactions/:id
Response: Single transaction object.
4. Update Transaction
PUT /transactions/:id
Request Body: Same as POST.
Response: Confirmation message.
5. Delete Transaction
DELETE /transactions/:id
Response: Confirmation message.
6. Get Summary
GET /summary
Response: Summary of transactions.
Postman Tests

### Conclusion


# Personal Expense Tracker

## Overview

The Personal Expense Tracker is a RESTful API designed to help users manage their personal financial records. Users can record their income and expenses, retrieve past transactions, and obtain summaries by category or time period. The API is built using Node.js and Express.js, with SQLite as the database.
