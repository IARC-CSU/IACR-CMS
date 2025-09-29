const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Simple user database (replace with real DB)
const users = [
  { username: 'csu', passwordHash: bcrypt.hashSync('password', 10) }
];

// Secret for JWT
const SECRET = 'your-strong-secret';

// Login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'Invalid user' });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).json({ error: 'Invalid password' });

  const token = jwt.sign({ username }, SECRET, { expiresIn: '2h' });
  res.json({ token });
});

// Optional: validate token
app.get('/validate', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).send('No token');

  try {
    const data = jwt.verify(token, SECRET);
    res.json({ valid: true, user: data.username });
  } catch {
    res.status(401).send('Invalid token');
  }
});

app.listen(3000, () => console.log('Auth server running on port 3000'));
