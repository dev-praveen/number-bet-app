const express = require('express');
const path = require('path');
const { saveBets, db } = require('./database'); // Import the save function and database

const app = express();
const port = 3000;

// Middleware
app.use(express.json()); // To parse JSON request bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files (HTML, CSS, JS)

// API endpoint to get all saved bets
app.get('/api/bets', (req, res) => {
    db.all('SELECT * FROM bets ORDER BY timestamp DESC', [], (err, rows) => {
        if (err) {
            console.error("Error fetching bets:", err);
            return res.status(500).json({ error: 'Failed to fetch bets from database.' });
        }
        res.json({ bets: rows });
    });
});

// API endpoint to save bets
app.post('/api/save-bets', (req, res) => {
    const betsToSave = req.body.bets; // Expecting { bets: [...] } in the request body

    if (!Array.isArray(betsToSave)) {
        return res.status(400).json({ error: 'Invalid data format. Expected an array of bets.' });
    }

    // Basic validation on the server side (optional but recommended)
    const invalidBet = betsToSave.some(bet =>
        typeof bet.number !== 'number' || bet.number < 0 || bet.number > 99 ||
        typeof bet.amount !== 'number' || bet.amount <= 0
    );

    if (invalidBet) {
         return res.status(400).json({ error: 'Invalid bet data found.' });
    }

    saveBets(betsToSave, (err, result) => {
        if (err) {
            console.error("Server error saving bets:", err);
            return res.status(500).json({ error: 'Failed to save bets to database.' });
        }
        res.status(201).json(result); // 201 Created
    });
});

// API endpoint to delete all bets
app.delete('/api/delete-all-bets', (req, res) => {
    db.run('DELETE FROM bets', [], (err) => {
        if (err) {
            console.error("Error deleting bets:", err);
            return res.status(500).json({ error: 'Failed to delete bets from database.' });
        }
        res.json({ message: 'All bets have been deleted successfully.' });
    });
});

// API endpoint to delete a single bet
app.delete('/api/bets/:number', (req, res) => {
    const number = parseInt(req.params.number);
    if (isNaN(number) || number < 0 || number > 99) {
        return res.status(400).json({ error: 'Invalid bet number.' });
    }

    db.run('DELETE FROM bets WHERE number = ?', [number], function(err) {
        if (err) {
            console.error("Error deleting bet:", err);
            return res.status(500).json({ error: 'Failed to delete bet from database.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Bet not found.' });
        }
        res.json({ message: 'Bet deleted successfully.' });
    });
});

// Catch-all for serving the main HTML file (optional, good for single-page apps)
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});