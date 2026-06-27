// --- DATABASE & STATE ---
let users = JSON.parse(localStorage.getItem('growpay_pro_users')) || [];
let currentUser = null;
const ADMIN_PIN = "4455";

// Share Market Variables
let marketPrice = 250.50;
let marketChange = 1.5;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Inject html2canvas for receipt downloading
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    document.head.appendChild(script);

    startMarketSimulation();
});

// --- AUTHENTICATION LOGIC ---
function generateAccount() {
    const phone = document.getElementById('phone-input').value.trim();
    
    if (phone.length < 10) return alert("Please enter a valid phone number");

    // Check if phone already exists
    const existingUser = users.find(u => u.phone === phone);
    if (existingUser) {
        alert(`This phone number is already registered.\nAccount Number: ${existingUser.accountNumber}`);
        return switchStep('generate-step', 'login-step');
    }

    // Generate 10-digit number starting with 309
    const accNo = "309" + Math.floor(1000000 + Math.random() * 9000000);
    
    const newUser = {
        phone: phone,
        accountNumber: accNo,
        balance: 0,
        fixedBalance: 0,
        investments: [],
        shares: [],
        history: []
    };

    users.push(newUser);
    saveData();

    document.getElementById('generated-no').innerText = accNo;
    switchStep('generate-step', 'display-step');
}

function unlockWallet() {
    const accInput = document.getElementById('access-acc').value.trim();
    const user = users.find(u => u.accountNumber === accInput);

    if (user) {
        currentUser = user;
        renderDashboard();
        switchStep('auth-container', 'dashboard');
    } else {
        alert("Account number not found!");
    }
}

// --- CORE DASHBOARD FUNCTIONS ---
function renderDashboard() {
    document.getElementById('user-acc-display').innerText = currentUser.accountNumber;
    updateBalances();
    renderFixedTable();
    renderHistory();
}

function updateBalances() {
    const isBalVisible = document.getElementById('eye-bal').classList.contains('fa-eye');
    const isFixVisible = document.getElementById('eye-fix').classList.contains('fa-eye');

    document.getElementById('avail-bal').innerText = isBalVisible ? `₦${currentUser.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "₦ ****";
    document.getElementById('fixed-bal-text').innerText = isFixVisible ? `₦${currentUser.fixedBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "₦ ****";
}

function toggleVisibility(type) {
    const icon = document.getElementById(`eye-${type}`);
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
    updateBalances();
}

// --- ADMIN FUNDING ---
function adminFund() {
    const pin = document.getElementById('admin-pin').value;
    const amount = parseFloat(document.getElementById('fund-amt').value);

    if (pin !== ADMIN_PIN) return alert("Unauthorized: Invalid Admin PIN");
    if (isNaN(amount) || amount <= 0) return alert("Enter a valid amount");

    currentUser.balance += amount;
    addTransaction("Credit (Admin)", amount, "Success", "Approved Funding", "Internal");
    
    closeModal('admin-modal');
    alert("Account Funded Successfully!");
    saveData();
    renderDashboard();
}

// --- TRANSFER & RECEIPT ---
function processTransfer() {
    const name = document.getElementById('trans-name').value;
    const bank = document.getElementById('trans-bank').value;
    const acc = document.getElementById('trans-acc').value;
    const amt = parseFloat(document.getElementById('trans-amount').value);

    if (!name || !bank || !acc || isNaN(amt)) return alert("Please fill all fields");
    if (amt > currentUser.balance) return alert("Insufficient Balance");

    currentUser.balance -= amt;
    
    const tx = addTransaction("Transfer", amt, "Success", `To ${name}`, bank, acc);
    saveData();
    renderDashboard();
    showReceipt(tx);
}

function generateTxID() {
    let id = "";
    for(let i=0; i<24; i++) id += Math.floor(Math.random() * 10);
    return id;
}

function addTransaction(type, amount, status, note, bank = "GrowPay", acc = "N/A") {
    const tx = {
        txId: generateTxID(),
        date: new Date().toLocaleString(),
        type, amount, status, note, bank, acc,
        sender: currentUser.accountNumber
    };
    currentUser.history.unshift(tx);
    return tx;
}

function showReceipt(tx) {
    const content = document.getElementById('receipt-content');
    content.innerHTML = `
        <div id="capture-area" class="opay-style-receipt">
            <div class="receipt-top">
                <div class="opay-logo-circle">GPAY</div>
                <h3 class="status-text">Transaction Successful</h3>
                <h1 class="amount-main">₦${tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</h1>
                <p class="tx-date">${tx.date}</p>
            </div>
            
            <div class="receipt-details">
                <div class="r-item"><span>Recipient Name</span><strong>${tx.note.replace('To ', '')}</strong></div>
                <div class="r-item"><span>Recipient Bank</span><strong>${tx.bank}</strong></div>
                <div class="r-item"><span>Account Number</span><strong>${tx.acc}</strong></div>
                <div class="r-item"><span>Sender Name</span><strong>User_${currentUser.phone.slice(-4)}</strong></div>
                <div class="r-item"><span>Transaction No.</span><strong class="tx-no">${tx.txId}</strong></div>
                <div class="r-item"><span>Transaction Type</span><strong>${tx.type}</strong></div>
            </div>
            
            <div class="receipt-footer">
                <img src="https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg" width="60">
                <p>Generated by GrowPay Pro</p>
            </div>
        </div>
        <div class="download-container">
            <button onclick="downloadAsImage()" class="main-btn">Download Receipt</button>
            <button onclick="closeModal('receipt-modal')" class="cancel-btn">Close</button>
        </div>
    `;
    openModal('receipt-modal');
}

async function downloadAsImage() {
    const area = document.getElementById('capture-area');
    const canvas = await html2canvas(area, { scale: 3 });
    const link = document.createElement('a');
    link.download = `GrowPay_Receipt_${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
}

// --- FIXED DEPOSIT & MARKET ---
function processFixedDeposit() {
    const amt = parseFloat(document.getElementById('fix-amount').value);
    const days = parseInt(document.getElementById('fix-duration').value);

    if (amt > currentUser.balance) return alert("Insufficient Balance");
    
    const interest = amt * 0.08;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);

    const investment = {
        id: Date.now(),
        amount: amt,
        interest: interest,
        expiry: expiry.toLocaleDateString(),
        rawExpiry: expiry.getTime(),
        days: days
    };

    currentUser.balance -= amt;
    currentUser.balance += interest; // Upfront interest
    currentUser.fixedBalance += amt;
    currentUser.investments.push(investment);
    
    addTransaction("Fixed Deposit", amt, "Locked", `8% Upfront Interest Received`, "GrowPay Vault");
    saveData();
    renderDashboard();
    alert("Deposit Locked! Interest paid to available balance.");
}

function withdrawFixed(id) {
    const idx = currentUser.investments.findIndex(i => i.id === id);
    const inv = currentUser.investments[idx];
    const isMatured = new Date().getTime() > inv.rawExpiry;

    if (!isMatured) {
        if (!confirm("Early Withdrawal: The 8% upfront interest will be deducted from your capital. Proceed?")) return;
        currentUser.balance += (inv.amount - inv.interest);
    } else {
        currentUser.balance += inv.amount;
    }

    currentUser.fixedBalance -= inv.amount;
    currentUser.investments.splice(idx, 1);
    saveData();
    renderDashboard();
}

function startMarketSimulation() {
    setInterval(() => {
        const change = (Math.random() * 4 - 2);
        marketPrice = Math.abs(marketPrice + change);
        marketChange = change.toFixed(2);
        
        const display = document.getElementById('market-display');
        if (display) {
            display.innerHTML = `
                <div class="market-ticker">
                    <span>GPPRO Stock: <strong>₦${marketPrice.toFixed(2)}</strong></span>
                    <span class="${marketChange >= 0 ? 'up' : 'down'}">
                        ${marketChange >= 0 ? '▲' : '▼'} ${Math.abs(marketChange)}%
                    </span>
                    <p><small>Market Volatility: High | Available: 500,000 Units</small></p>
                </div>
            `;
        }
    }, 3000);
}

// --- UTILS ---
function switchStep(oldId, newId) {
    document.getElementById(oldId).classList.add('hidden');
    document.getElementById(newId).classList.remove('hidden');
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function renderFixedTable() {
    const body = document.getElementById('fixed-table-body');
    body.innerHTML = currentUser.investments.map(inv => `
        <tr>
            <td>₦${inv.amount}</td>
            <td>8%</td>
            <td>${inv.expiry}</td>
            <td><button onclick="withdrawFixed(${inv.id})">End</button></td>
        </tr>
    `).join('');
}

function renderHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = currentUser.history.map((tx, idx) => `
        <div class="history-card" onclick="rePrint(${idx})">
            <div class="h-icon"><i class="fas fa-exchange-alt"></i></div>
            <div class="h-info">
                <strong>${tx.type}</strong>
                <small>${tx.date}</small>
            </div>
            <div class="h-amt ${tx.type.includes('Credit') ? 'green' : 'red'}">
                ${tx.type.includes('Credit') ? '+' : '-'}₦${tx.amount.toLocaleString()}
            </div>
        </div>
    `).join('');
}

function rePrint(idx) { showReceipt(currentUser.history[idx]); }

function showSection(id) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

function saveData() { localStorage.setItem('growpay_pro_users', JSON.stringify(users)); }
function logout() { location.reload(); }
