document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let currentBets = []; // Holds all bets
    let savedNumbers = new Set(); // Track numbers that are already saved
    let modifiedNumbers = new Set(); // Track numbers that have been modified
    let currentPage = 1;
    const rowsPerPage = 15;
    const gameType = window.GAME_TYPE || 'day'; // Get game type from the page

    // Set up game-specific configurations
    const gameConfig = {
        day: { minNumber: 0, maxNumber: 99 },
        night: { minNumber: 0, maxNumber: 99 },
        open: { minNumber: 0, maxNumber: 9 }
    };

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

    // Modal Elements
    const deleteModal = document.getElementById('deleteModal');
    const confirmDeleteBtn = document.getElementById('confirmDelete');
    const cancelDeleteBtn = document.getElementById('cancelDelete');
    const saveSuccessModal = document.getElementById('saveSuccessModal');
    const saveSuccessMessage = document.getElementById('saveSuccessMessage');
    const okSaveBtn = document.getElementById('okSave');

    // Add new modal elements for single bet deletion
    const deleteBetModal = document.getElementById('deleteBetModal');
    const deleteBetNumber = document.getElementById('deleteBetNumber');
    const confirmDeleteBetBtn = document.getElementById('confirmDeleteBet');
    const cancelDeleteBetBtn = document.getElementById('cancelDeleteBet');

    let betToDeleteId = null; // Store the bet ID to be deleted

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

    // Function to show a modal
    const showModal = (modal) => {
        modal.classList.add('show');
    };

    // Function to hide a modal
    const hideModal = (modal) => {
        modal.classList.remove('show');
    };

    // Check if there are any unsaved or modified bets
    const hasUnsavedBets = () => {
        return currentBets.some(bet => 
            !savedNumbers.has(bet.number) || 
            modifiedNumbers.has(bet.number)
        );
    };

    // Render the grid with pagination
    const renderGrid = () => {
        betsTableBody.innerHTML = ''; // Clear current table rows
        statusMessage.textContent = ''; // Clear status on redraw
        statusMessage.className = 'status';

        // Check if there are any unsaved or modified bets
        saveBetsBtn.disabled = !hasUnsavedBets();

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

            // Handle row classes for saved and modified states
            if (savedNumbers.has(bet.number)) {
                if (modifiedNumbers.has(bet.number)) {
                    row.classList.add('modified-bet');
                } else {
                    row.classList.add('saved-bet');
                }
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

        const { minNumber, maxNumber } = gameConfig[gameType];
        
        if (isNaN(number) || number < minNumber || number > maxNumber || !Number.isInteger(number)) {
            showMessage(errorMessage, `Number must be a whole number between ${minNumber.toString().padStart(2, '0')} and ${maxNumber}`);
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
            // Mark as modified if it was previously saved
            if (savedNumbers.has(number)) {
                modifiedNumbers.add(number);
            }
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

    // Update input attributes based on game type
    const updateInputConstraints = () => {
        const { minNumber, maxNumber } = gameConfig[gameType];
        betNumberInput.min = minNumber;
        betNumberInput.max = maxNumber;
        betNumberInput.placeholder = `${minNumber}-${maxNumber}`;
        const label = document.querySelector('label[for="betNumber"]');
        if (label) {
            label.textContent = `Number (${minNumber}-${maxNumber}):`;
        }
    };

    // Handle clicks within the table (for delete/edit) using event delegation
    const handleTableClick = (event) => {
        const target = event.target;
        if (target.tagName === 'BUTTON' && target.dataset.action === 'delete') {
            const betIdToDelete = target.dataset.id;
            const bet = currentBets.find(bet => bet.id === betIdToDelete);
            if (bet) {
                betToDeleteId = betIdToDelete;
                deleteBetNumber.textContent = bet.number.toString().padStart(2, '0');
                showModal(deleteBetModal);
            }
        }
    };

    // Delete a bet from both UI and database if saved
    const deleteBet = async (betId) => {
        const betToDelete = currentBets.find(bet => bet.id === betId);
        if (!betToDelete) return;

        try {
            // Only attempt to delete from database if it's a saved bet
            if (savedNumbers.has(betToDelete.number)) {
                const response = await fetch(`/api/bets/${betToDelete.number}?game=${gameType}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    const result = await response.json();
                    throw new Error(result.error || `HTTP error! Status: ${response.status}`);
                }
                savedNumbers.delete(betToDelete.number);
            }

            // Remove from local state
            currentBets = currentBets.filter(bet => bet.id !== betId);
            modifiedNumbers.delete(betToDelete.number);

            // Update pagination if needed
            const totalPages = Math.ceil(currentBets.length / rowsPerPage);
            if (currentPage > totalPages && totalPages > 0) {
                currentPage = totalPages;
            } else if (currentBets.length === 0) {
                currentPage = 1;
            }
            
            renderGrid();
            showMessage(statusMessage, 'Bet deleted successfully.', 'success');
        } catch (error) {
            console.error('Error deleting bet:', error);
            showMessage(statusMessage, `Error: ${error.message}`, 'error');
        }
    };

    // Delete All functionality with confirmation modal
    const deleteAllBets = async () => {
        showModal(deleteModal);

        const handleConfirmDelete = async () => {
            try {
                const response = await fetch(`/api/delete-all-bets?game=${gameType}`, {
                    method: 'DELETE',
                });

                if (!response.ok) {
                    const result = await response.json();
                    throw new Error(result.error || `HTTP error! Status: ${response.status}`);
                }

                // Clear local bets after successful server deletion
                currentBets = [];
                savedNumbers.clear();
                modifiedNumbers.clear();
                currentPage = 1;
                renderGrid();
                showMessage(statusMessage, 'All bets have been deleted.', 'success');
            } catch (error) {
                console.error('Error deleting bets:', error);
                showMessage(statusMessage, `Error: ${error.message}`, 'error');
            } finally {
                hideModal(deleteModal);
            }
        };

        const handleCancelDelete = () => {
            hideModal(deleteModal);
        };

        // Set up one-time event listeners
        confirmDeleteBtn.onclick = () => {
            handleConfirmDelete();
            // Remove listeners after execution
            confirmDeleteBtn.onclick = null;
            cancelDeleteBtn.onclick = null;
        };

        cancelDeleteBtn.onclick = () => {
            handleCancelDelete();
            // Remove listeners after execution
            confirmDeleteBtn.onclick = null;
            cancelDeleteBtn.onclick = null;
        };
    };

    // Save all unsaved bets to the database
    const saveBetsToServer = async () => {
        const betsToSave = currentBets.filter(bet => 
            !savedNumbers.has(bet.number) || 
            modifiedNumbers.has(bet.number)
        );

        if (betsToSave.length === 0) {
            showMessage(statusMessage, 'No new or modified bets to save.', 'info');
            return;
        }

        const betsData = betsToSave.map(({ number, amount }) => ({ number, amount }));
        saveBetsBtn.disabled = true;
        showMessage(statusMessage, 'Saving...', 'info');

        try {
            const response = await fetch(`/api/save-bets?game=${gameType}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ bets: betsData }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `HTTP error! Status: ${response.status}`);
            }

            // Mark the successfully saved bets and clear modifications
            betsToSave.forEach(bet => {
                savedNumbers.add(bet.number);
                modifiedNumbers.delete(bet.number); // This will remove modified status after saving
            });

            // Show success modal with the message directly from the server
            saveSuccessMessage.textContent = result.message;
            showModal(saveSuccessModal);
            
            // Set up one-time event listener for OK button
            okSaveBtn.onclick = () => {
                hideModal(saveSuccessModal);
                okSaveBtn.onclick = null;
            };

            renderGrid();
        } catch (error) {
            console.error('Error saving bets:', error);
            showMessage(statusMessage, `Error: ${error.message}`, 'error');
        } finally {
            saveBetsBtn.disabled = false;
        }
    };

    // Load saved bets from the database
    const loadSavedBets = async () => {
        try {
            const response = await fetch(`/api/bets?game=${gameType}`);
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

    // Handle number input validation and auto-focus
    betNumberInput.addEventListener('input', (e) => {
        const value = e.target.value;
        const number = parseInt(value, 10);
        
        // Check if the input is a valid number within the game-specific range
        const { minNumber, maxNumber } = gameConfig[gameType];
        if (value.length >= minNumber.toString().length && value.length <= maxNumber.toString().length && !isNaN(number) && number >= minNumber && number <= maxNumber) {
            betAmountInput.focus();
        }
    });

    // Allow pressing Enter in amount field to add bet
    betAmountInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
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

    // Set up event listeners for single bet deletion modal
    confirmDeleteBetBtn.addEventListener('click', () => {
        if (betToDeleteId) {
            deleteBet(betToDeleteId);
            hideModal(deleteBetModal);
            betToDeleteId = null;
        }
    });

    cancelDeleteBetBtn.addEventListener('click', () => {
        hideModal(deleteBetModal);
        betToDeleteId = null;
    });

    // Load saved bets when the page loads
    loadSavedBets();

    // Initialize input constraints
    updateInputConstraints();

    // --- Initial Render ---
    renderGrid();
});