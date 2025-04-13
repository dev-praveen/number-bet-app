document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let currentBets = []; // Holds all bets
    let savedNumbers = new Set(); // Track numbers that are already saved
    let currentPage = 1;
    const rowsPerPage = 15;

    // --- DOM Elements ---
    const betForm = document.getElementById('betForm');
    const betNumberInput = document.getElementById('betNumber');
    const betAmountInput = document.getElementById('betAmount');
    const addBetBtn = document.getElementById('addBetBtn');
    const betsTableBody = document.getElementById('betsTableBody');
    const noBetsMessage = document.getElementById('no-bets-message');
    const paginationControls = document.getElementById('paginationControls');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageInfo = document.getElementById('pageInfo');
    const saveBetsBtn = document.getElementById('saveBetsBtn');
    const deleteAllBtn = document.getElementById('deleteAllBtn');
    const errorMessage = document.getElementById('error-message');
    const statusMessage = document.getElementById('status-message');

    // --- Functions ---

    // Generate a simple unique temporary ID for client-side operations
    const generateTempId = () => '_' + Math.random().toString(36).substr(2, 9);

    // Display status/error messages
    const showMessage = (element, message, type = 'error') => {
        element.textContent = message;
        element.className = type; // Add 'error' or 'success' class if needed for styling
        // Clear message after a delay
        if (message) {
            setTimeout(() => {
                element.textContent = '';
                element.className = '';
            }, 4000);
        }
    };

    // Render the grid with pagination
    const renderGrid = () => {
        betsTableBody.innerHTML = ''; // Clear current table rows
        statusMessage.textContent = ''; // Clear status on redraw
        statusMessage.className = 'status';

        // Check if there are any unsaved bets
        const hasUnsavedBets = currentBets.some(bet => !savedNumbers.has(bet.number));
        saveBetsBtn.disabled = !hasUnsavedBets;

        if (currentBets.length === 0) {
            noBetsMessage.style.display = 'block';
            paginationControls.style.display = 'none';
            deleteAllBtn.disabled = true;
            betsTableBody.innerHTML = ''; // Ensure it's really empty
            return;
        }

        noBetsMessage.style.display = 'none';
        paginationControls.style.display = 'block';
        deleteAllBtn.disabled = false;

        // Sort bets by number for better readability
        currentBets.sort((a, b) => a.number - b.number);

        // Pagination calculations
        const totalPages = Math.ceil(currentBets.length / rowsPerPage);
        currentPage = Math.min(currentPage, totalPages); // Adjust if currentPage > totalPages after deletion
        if (currentPage < 1) currentPage = 1; // Ensure currentPage is at least 1

        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedBets = currentBets.slice(startIndex, endIndex);

        // Populate table body
        paginatedBets.forEach(bet => {
            const row = betsTableBody.insertRow();
            row.setAttribute('data-id', bet.id); // Add data-id to the row

            const cellNumber = row.insertCell();
            const cellAmount = row.insertCell();
            const cellActions = row.insertCell();

            // Format number to always show two digits (e.g., 05)
            cellNumber.textContent = bet.number.toString().padStart(2, '0');
            // Format amount (e.g., to 2 decimal places) - adjust as needed
            cellAmount.textContent = bet.amount.toFixed(2);

            // Add status indicator to saved bets
            if (savedNumbers.has(bet.number)) {
                row.classList.add('saved-bet');
            }

            // Add Delete Button
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.classList.add('delete-btn');
            deleteBtn.setAttribute('data-action', 'delete');
            deleteBtn.setAttribute('data-id', bet.id); // Add id to button for easier event handling
            cellActions.appendChild(deleteBtn);
        });

        // Update pagination controls
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;
    };

    // Add a new bet to the temporary list
    const addBet = () => {
        errorMessage.textContent = ''; // Clear previous errors
        const numberStr = betNumberInput.value.trim();
        const amountStr = betAmountInput.value.trim();

        // --- Validation ---
        if (numberStr === '' || amountStr === '') {
            showMessage(errorMessage, 'Both number and amount are required.');
            return;
        }

        const number = parseInt(numberStr, 10);
        const amount = parseFloat(amountStr);

        if (isNaN(number) || number < 0 || number > 99 || !Number.isInteger(number)) {
            showMessage(errorMessage, 'Number must be a whole number between 00 and 99.');
            return;
        }

        if (isNaN(amount) || amount <= 0) {
            showMessage(errorMessage, 'Amount must be a positive number.');
            return;
        }

        // Check if number already exists
        const existingBetIndex = currentBets.findIndex(bet => bet.number === number);
        if (existingBetIndex !== -1) {
            // Add amount to existing bet
            currentBets[existingBetIndex].amount += amount;
        } else {
            // Add new bet
            const newBet = {
                id: generateTempId(), // Temporary ID
                number: number,
                amount: amount
            };
            currentBets.push(newBet);
        }

        betForm.reset(); // Clear form fields
        betNumberInput.focus(); // Focus back on number field

        // Go to the last page to show the newly added item (optional)
        currentPage = Math.ceil(currentBets.length / rowsPerPage);
        renderGrid();
    };

    // Handle clicks within the table (for delete/edit) using event delegation
    const handleTableClick = (event) => {
        const target = event.target;
        if (target.tagName === 'BUTTON' && target.dataset.action === 'delete') {
            const betIdToDelete = target.dataset.id;
            deleteBet(betIdToDelete);
        }
    };

    // Delete a bet from the temporary list
    const deleteBet = (betId) => {
        currentBets = currentBets.filter(bet => bet.id !== betId);
        // If the current page becomes empty after deletion, go to the previous page
        const totalPages = Math.ceil(currentBets.length / rowsPerPage);
        if (currentPage > totalPages && totalPages > 0) {
            currentPage = totalPages;
        } else if (currentBets.length === 0) {
            currentPage = 1; // Reset to page 1 if all bets are deleted
        }
        renderGrid();
    };

    // Delete All functionality with confirmation
    const deleteAllBets = async () => {
        if (!confirm('Are you sure you want to delete all bets?')) {
            return;
        }

        try {
            const response = await fetch('/api/delete-all-bets', {
                method: 'DELETE',
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || `HTTP error! Status: ${response.status}`);
            }

            // Clear local bets after successful server deletion
            currentBets = [];
            savedNumbers.clear(); // Clear saved numbers
            currentPage = 1;
            renderGrid();
            showMessage(statusMessage, 'All bets have been deleted.', 'success');
        } catch (error) {
            console.error('Error deleting bets:', error);
            showMessage(statusMessage, `Error: ${error.message}`, 'error');
        }
    };

    // Save all unsaved bets to the database
    const saveBetsToServer = async () => {
        // Filter out already saved numbers
        const unsavedBets = currentBets.filter(bet => !savedNumbers.has(bet.number));

        if (unsavedBets.length === 0) {
            showMessage(statusMessage, 'No new bets to save.', 'info');
            return;
        }

        const betsToSave = unsavedBets.map(({ number, amount }) => ({ number, amount }));
        saveBetsBtn.disabled = true; // Disable button during request
        showMessage(statusMessage, 'Saving...', 'info');

        try {
            const response = await fetch('/api/save-bets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ bets: betsToSave }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `HTTP error! Status: ${response.status}`);
            }

            // Mark the successfully saved bets
            unsavedBets.forEach(bet => {
                savedNumbers.add(bet.number);
            });

            const skippedMsg = result.skippedCount ? ` (${result.skippedCount} already existed)` : '';
            showMessage(statusMessage, result.message + skippedMsg, 'success');
            renderGrid();

        } catch (error) {
            console.error('Error saving bets:', error);
            showMessage(statusMessage, `Error: ${error.message}`, 'error');
        } finally {
            saveBetsBtn.disabled = false; // Re-enable button
        }
    };

    // Load saved bets from the database
    const loadSavedBets = async () => {
        try {
            const response = await fetch('/api/bets');
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            currentBets = data.bets.map(bet => ({
                ...bet,
                id: bet.id.toString() // Convert DB id to string to match client-side format
            }));
            // Update the saved numbers set
            savedNumbers = new Set(currentBets.map(bet => bet.number));
            renderGrid();
        } catch (error) {
            console.error('Error loading bets:', error);
            showMessage(statusMessage, `Error loading saved bets: ${error.message}`, 'error');
        }
    };

    // --- Event Listeners ---
    addBetBtn.addEventListener('click', addBet);
    deleteAllBtn.addEventListener('click', deleteAllBets);
    // Allow pressing Enter in amount field to add bet
    betAmountInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent default form submission if it were type="submit"
            addBet();
        }
    });

    betsTableBody.addEventListener('click', handleTableClick); // Event delegation

    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderGrid();
        }
    });

    nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(currentBets.length / rowsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderGrid();
        }
    });

    saveBetsBtn.addEventListener('click', saveBetsToServer);

    // Load saved bets when the page loads
    loadSavedBets();

    // --- Initial Render ---
    renderGrid();
});