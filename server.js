const express = require('express');
const path = require('path');
const { saveBets, db, getTableName } = require('./database');

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to get all saved bets for a specific game
app.get('/api/bets', (req, res) => {
    const gameType = req.query.game || 'day'; // Default to day game if not specified
    const tableName = getTableName(gameType);
    
    try {
        const rows = db.prepare(`SELECT * FROM ${tableName} ORDER BY timestamp DESC`).all();
        res.json({ bets: rows });
    } catch (err) {
        console.error("Error fetching bets:", err);
        res.status(500).json({ error: 'Failed to fetch bets from database.' });
    }
});

// API endpoint to save bets
app.post('/api/save-bets', (req, res) => {
    const betsToSave = req.body.bets;
    const gameType = req.query.game || 'day'; // Default to day game if not specified

    if (!Array.isArray(betsToSave)) {
        return res.status(400).json({ error: 'Invalid data format. Expected an array of bets.' });
    }

    const invalidBet = betsToSave.some(bet =>
        typeof bet.number !== 'number' || bet.number < 0 || bet.number > 99 ||
        typeof bet.amount !== 'number' || bet.amount <= 0
    );

    if (invalidBet) {
        return res.status(400).json({ error: 'Invalid bet data found.' });
    }

    saveBets(betsToSave, gameType, (err, result) => {
        if (err) {
            console.error("Server error saving bets:", err);
            return res.status(500).json({ error: 'Failed to save bets to database.' });
        }
        res.status(201).json(result);
    });
});

// API endpoint to delete all bets for a specific game
app.delete('/api/delete-all-bets', (req, res) => {
    const gameType = req.query.game || 'day';
    const tableName = getTableName(gameType);
    
    try {
        const result = db.prepare(`DELETE FROM ${tableName}`).run();
        res.json({ 
            message: 'All bets have been deleted successfully.',
            deletedCount: result.changes
        });
    } catch (err) {
        console.error("Error deleting bets:", err);
        res.status(500).json({ error: 'Failed to delete bets from database.' });
    }
});

// API endpoint to delete a single bet from a specific game
app.delete('/api/bets/:number', (req, res) => {
    const number = parseInt(req.params.number);
    const gameType = req.query.game || 'day';
    const tableName = getTableName(gameType);

    if (isNaN(number) || number < 0 || number > 99) {
        return res.status(400).json({ error: 'Invalid bet number.' });
    }

    try {
        const result = db.prepare(`DELETE FROM ${tableName} WHERE number = ?`).run(number);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Bet not found.' });
        }
        res.json({ message: 'Bet deleted successfully.' });
    } catch (err) {
        console.error("Error deleting bet:", err);
        res.status(500).json({ error: 'Failed to delete bet from database.' });
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});