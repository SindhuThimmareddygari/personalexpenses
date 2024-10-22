const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./database'); // Import the database setup
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your_secret_key'; // Replace with a strong secret key

app.use(bodyParser.json());

// User Registration
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
      // Check if the username already exists
      const existingUser = await new Promise((resolve, reject) => {
          db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
              if (err) reject(err);
              resolve(row);
          });
      });

      if (existingUser) {
          return res.status(409).json({ error: 'Username already exists' }); // Conflict error
      }

      // Hash the password and insert the new user
      const hashedPassword = await bcrypt.hash(password, 10);

      await new Promise((resolve, reject) => {
          db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashedPassword], function (err) {
              if (err) reject(err);
              resolve(this.lastID);
          });
      });

      res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
      console.error(error.message);
      res.status(500).json({ error: 'Failed to register user' });
  }
});


// User Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
      // Retrieve the user from the database
      const user = await new Promise((resolve, reject) => {
          db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
              if (err) reject(err);
              resolve(row);
          });
      });

      if (!user) {
          return res.status(401).json({ error: 'Invalid username or password' });
      }

      // Validate the password using bcrypt.compare
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
          return res.status(401).json({ error: 'Invalid username or password' });
      }

      // Generate a JWT token if login is successful
      const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });
      res.status(200).json({ token });
  } catch (error) {
      console.error('Error during login:', error.message);
      res.status(500).json({ error: 'Failed to login user' });
  }
});

// Middleware to authenticate JWT
function authenticateToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user; // Attach user information to request
        next();
    });
}

// Add a new transaction
app.post('/transactions', authenticateToken, async (req, res) => {
    const { type, category, amount, date, description } = req.body;

    if (!type || !category || !amount || !date) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        await db.run(`INSERT INTO transactions (user_id, type, category, amount, date, description) VALUES (?, ?, ?, ?, ?, ?)`,
            [req.user.id, type, category, amount, date, description]);
        res.status(201).json({ message: 'Transaction added successfully' });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: 'Failed to add transaction' });
    }
});

// Retrieve all transactions with optional pagination
app.get('/transactions', authenticateToken, async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    try {
        const transactions = await db.all(`SELECT * FROM transactions WHERE user_id = ? LIMIT ? OFFSET ?`, [req.user.id, limit, offset]);
        res.status(200).json(transactions);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: 'Failed to retrieve transactions' });
    }
});

// Get a transaction by ID
app.get('/transactions/:id', authenticateToken, async (req, res) => {
    const id = req.params.id;

    try {
        const transaction = await db.get(`SELECT * FROM transactions WHERE id = ? AND user_id = ?`, [id, req.user.id]);
        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        res.status(200).json(transaction);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: 'Failed to retrieve transaction' });
    }
});

// Update a transaction by ID
app.put('/transactions/:id', authenticateToken, async (req, res) => {
    const id = req.params.id;
    const { type, category, amount, date, description } = req.body;

    try {
        const result = await db.run(`UPDATE transactions SET type = ?, category = ?, amount = ?, date = ?, description = ? WHERE id = ? AND user_id = ?`,
            [type, category, amount, date, description, id, req.user.id]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Transaction not found or not authorized' });
        }

        res.status(200).json({ message: 'Transaction updated successfully' });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: 'Failed to update transaction' });
    }
});

// Delete a transaction by ID
app.delete('/transactions/:id', authenticateToken, async (req, res) => {
    const id = req.params.id;

    try {
        const result = await db.run(`DELETE FROM transactions WHERE id = ? AND user_id = ?`, [id, req.user.id]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Transaction not found or not authorized' });
        }

        res.status(204).send();
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});

// Retrieve summary of transactions
app.get('/summary', authenticateToken, async (req, res) => {
    try {
        const summary = await db.all(`
            SELECT type, SUM(amount) as total FROM transactions WHERE user_id = ? GROUP BY type
        `, [req.user.id]);

        const totalIncome = summary.find(item => item.type === 'income')?.total || 0;
        const totalExpenses = summary.find(item => item.type === 'expense')?.total || 0;
        const balance = totalIncome - totalExpenses;

        res.status(200).json({ totalIncome, totalExpenses, balance });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: 'Failed to retrieve summary' });
    }
});

// Generate monthly spending report by category
app.get('/reports/monthly-spending', authenticateToken, async (req, res) => {
    const { year, month } = req.query;

    if (!year || !month) {
        return res.status(400).json({ error: 'Year and month are required' });
    }

    try {
        const report = await db.all(`
            SELECT category, SUM(amount) as total_spent
            FROM transactions
            WHERE user_id = ? AND type = 'expense'
            AND strftime('%Y', date) = ? AND strftime('%m', date) = ?
            GROUP BY category
        `, [req.user.id, year, month]);

        res.status(200).json(report);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`API Server is running on http://localhost:${PORT}`);
});
