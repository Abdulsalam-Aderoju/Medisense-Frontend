// --- 1. Tab Navigation Logic ---
(function () {
    function selectTab(name) {
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        document.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.remove('text-primary', 'border-b-2', 'border-primary');
            b.classList.add('text-gray-500');
        });
        const el = document.getElementById(name);
        if (el) el.classList.remove('hidden');
        const btn = document.querySelector('.tab-btn[data-tab="' + name + '"]');
        if (btn) {
            btn.classList.add('text-primary', 'border-b-2', 'border-primary');
            btn.classList.remove('text-gray-500');
        }
    }
    // Expose to window so other functions can use it
    window.selectTab = selectTab;

    document.addEventListener('click', (e) => {
        const tb = e.target.closest('.tab-btn');
        if (tb && tb.dataset.tab) {
            e.preventDefault();
            selectTab(tb.dataset.tab);
        }
    });
    // Default tab
    document.addEventListener('DOMContentLoaded', () => selectTab('patient-management'));
})();

// --- 2. Main Logic (Sidebar, Patients, Triage) ---
document.addEventListener('DOMContentLoaded', () => {
    // A. Sidebar Toggles
    const openSidebarButton = document.getElementById('open-sidebar');
    const closeSidebarButton = document.getElementById('close-sidebar');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');

    function openSidebar() {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
    }

    function closeSidebar() {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    }

    openSidebarButton?.addEventListener('click', openSidebar);
    closeSidebarButton?.addEventListener('click', closeSidebar);
    overlay?.addEventListener('click', closeSidebar);

    // Close sidebar when clicking outside on mobile
    document.getElementById('app')?.addEventListener('click', (e) => {
        if (window.innerWidth < 768 && !sidebar.contains(e.target) && !openSidebarButton.contains(e.target)) {
            closeSidebar();
        }
    });

    // B. Patient & Triage API Calls
    async function registerPatient(payload) {
        const res = await fetch(`${API_BASE_URL}/patients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error('Registration failed: ' + res.status + ' ' + txt);
        }
        return res.json();
    }

    async function callTriage(patientId) {
        const res = await fetch(`${API_BASE_URL}/patients/triage/${patientId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error('Triage failed: ' + res.status + ' ' + txt);
        }
        return res.json();
    }

    // C. Helpers
    function parseList(text) {
        if (!text) return [];
        return text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    }

    function clearForm() {
        const ids = ['patient-name', 'patient-age', 'patient-sex', 'patient-visit', 'patient-symptoms', 'patient-vitals', 'patient-medical-history'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (el.tagName === 'SELECT') el.selectedIndex = 0;
            else el.value = '';
        });
        const triage = document.getElementById('triage-result');
        if (triage) triage.classList.add('hidden');
    }

    function showSuccessOverlay(patientId) {
        const overlay = document.getElementById('success-overlay');
        if (!overlay) return;
        const idEl = overlay.querySelector('#success-overlay-id');
        if (idEl) idEl.textContent = patientId ?? 'unknown';
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
        
        clearTimeout(window._successOverlayTimeout);
        window._successOverlayTimeout = setTimeout(() => {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        }, 3000);
    }

    // D. Event Handlers
    async function onStartTriageClick(e) {
        console.log('onStartTriageClick fired');
        e?.preventDefault();
        try {
            const name = (document.getElementById('patient-name') || {}).value?.trim() || 'Anonymous';
            const age = parseInt((document.getElementById('patient-age') || {}).value, 10) || 0;
            const sex = (document.getElementById('patient-sex') || {}).value || 'Male';
            const visit_type = (document.getElementById('patient-visit') || {}).value || 'Routine';
            const symptoms = parseList((document.getElementById('patient-symptoms') || {}).value || '');
            const vitals = (document.getElementById('patient-vitals') || {}).value || '';
            const medical_history = parseList((document.getElementById('patient-medical-history') || {}).value || '');

            if (!name) throw new Error('Name required');
            if (age < 0) throw new Error('Age cannot be negative');

            const payload = { name, age, sex, symptoms, visit_type, vitals, medical_history };
            
            const patient = await registerPatient(payload);
            showSuccessOverlay(patient.id);
            clearForm();
        } catch (err) {
            console.error(err);
            alert(err.message || 'Error');
        }
    }

    document.getElementById('start-triage')?.addEventListener('click', onStartTriageClick);

    // E. AI Triage Chat Interface
    function appendChatMessage(who, text) {
        const container = document.getElementById('triage-chat');
        if (!container) return;
        const wrap = document.createElement('div');
        wrap.className = who === 'user' ? 'flex justify-end' : 'flex justify-start';
        const bubble = document.createElement('div');
        bubble.className = who === 'user'
            ? 'max-w-[75%] bg-primary text-white px-3 py-2 rounded-lg rounded-br-none whitespace-pre-wrap'
            : 'max-w-[75%] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 rounded-lg rounded-bl-none whitespace-pre-wrap';
        bubble.textContent = text;
        wrap.appendChild(bubble);
        container.appendChild(wrap);
        container.scrollTop = container.scrollHeight;
    }

    function clearChat() {
        const container = document.getElementById('triage-chat');
        if (container) container.innerHTML = '';
    }

    document.getElementById('triage-send')?.addEventListener('click', async () => {
        const input = document.getElementById('triage-input');
        if (!input) return;
        const raw = input.value.trim();
        if (!raw) return alert('Enter patient ID');
        const patientId = isNaN(Number(raw)) ? raw : Number(raw);

        appendChatMessage('user', `Triage request for patient ID: ${patientId}`);

        const sendBtn = document.getElementById('triage-send');
        const loading = document.getElementById('triage-loading');
        sendBtn.disabled = true;
        if (loading) loading.classList.remove('hidden');

        try {
            const res = await callTriage(patientId);
            const actions = (res.recommended_actions || []).join(', ');
            const assistantText = `Urgency: ${res.urgency_level}\nActions: ${actions}\nReasoning: ${res.reasoning}`;
            appendChatMessage('assistant', assistantText);
        } catch (err) {
            console.error(err);
            appendChatMessage('assistant', 'Error: ' + (err.message || 'Request failed'));
        } finally {
            sendBtn.disabled = false;
            if (loading) loading.classList.add('hidden');
        }
    });

    document.getElementById('triage-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('triage-send')?.click();
        }
    });

    document.getElementById('triage-clear')?.addEventListener('click', () => clearChat());

    document.getElementById('open-register')?.addEventListener('click', () => {
        window.selectTab && window.selectTab('patient-management');
        const reg = document.getElementById('patient-management');
        if (reg) reg.scrollIntoView({ behavior: 'smooth' });
    });

    if (typeof workloadApp !== 'undefined') {
        workloadApp.fetchForecast();
    }
});


// --- 3. Inventory Logic ---
const inventoryApp = (function() {
    
    const BASE_URL = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : API_BASE_URL;
    
    function getHeaders() {
        const token = localStorage.getItem('accessToken'); 
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        };
    }

    const dom = {
        viewStock: document.getElementById('view-stock'),
        viewHistory: document.getElementById('view-history'),
        toolbarStock: document.getElementById('toolbar-stock'),
        toolbarHistory: document.getElementById('toolbar-history'),
        tabStock: document.getElementById('inv-tab-stock'),
        tabHistory: document.getElementById('inv-tab-history'),
        tbodyStock: document.getElementById('tbody-stock'),
        tbodyHistory: document.getElementById('tbody-history'),
        modal: document.getElementById('modal-restock'),
        modalTitle: document.getElementById('modal-restock-title'),
        inpId: document.getElementById('req-id'),
        inpItem: document.getElementById('req-item-name'),
        inpQty: document.getElementById('req-qty'),
        statLow: document.getElementById('stat-low'),
        statPending: document.getElementById('stat-pending'),
        statApproved: document.getElementById('stat-approved')
    };

    function switchView(viewName) {
        if (viewName === 'stock') {
            dom.viewStock.classList.remove('hidden');
            dom.toolbarStock.classList.remove('hidden');
            dom.tabStock.classList.add('shadow', 'bg-white', 'dark:bg-gray-600', 'text-primary');
            dom.tabStock.classList.remove('text-gray-600');
            dom.viewHistory.classList.add('hidden');
            dom.toolbarHistory.classList.add('hidden');
            dom.tabHistory.classList.remove('shadow', 'bg-white', 'dark:bg-gray-600', 'text-primary');
            dom.tabHistory.classList.add('text-gray-600');
            loadStock(); 
        } else {
            dom.viewHistory.classList.remove('hidden');
            dom.toolbarHistory.classList.remove('hidden');
            dom.tabHistory.classList.add('shadow', 'bg-white', 'dark:bg-gray-600', 'text-primary');
            dom.tabHistory.classList.remove('text-gray-600');
            dom.viewStock.classList.add('hidden');
            dom.toolbarStock.classList.add('hidden');
            dom.tabStock.classList.remove('shadow', 'bg-white', 'dark:bg-gray-600', 'text-primary');
            dom.tabStock.classList.add('text-gray-600');
            loadHistory(); 
        }
    }

    async function loadStock() {
        const threshold = document.getElementById('threshold-days').value || 5;
        dom.tbodyStock.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">Loading inventory...</td></tr>';
        try {
            const res = await fetch(`${BASE_URL}/inventory/low-stock?threshold_days=${threshold}`, { headers: getHeaders() });
            if (res.status === 401) return handleAuthError();
            if (!res.ok) throw new Error("Failed to load stock");
            const items = await res.json();
            renderStockTable(items);
            if(dom.statLow) dom.statLow.innerText = items.filter(i => i.days_remaining <= 5).length;
        } catch (err) {
            console.error(err);
            dom.tbodyStock.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Error: ${err.message}</td></tr>`;
        }
    }

    function renderStockTable(items) {
        dom.tbodyStock.innerHTML = '';
        if (items.length === 0) {
            dom.tbodyStock.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">No items found below threshold.</td></tr>';
            return;
        }
        items.forEach(item => {
            const isCritical = item.days_remaining <= 3;
            const badgeClass = isCritical ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';
            const tr = document.createElement('tr');
            tr.className = 'border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors';
            tr.innerHTML = `
                <td class="px-4 py-3 font-medium">${item.item_name}</td>
                <td class="px-4 py-3 text-center">${item.current_stock} <span class="text-xs text-gray-400">${item.unit}</span></td>
                <td class="px-4 py-3 text-center">${item.daily_consumption_rate}</td>
                <td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded-full text-xs font-bold ${badgeClass}">${item.days_remaining.toFixed(1)} Days</span></td>
                <td class="px-4 py-3 text-right"><button onclick="inventoryApp.openModal(null, '${item.item_name}')" class="text-primary hover:underline text-sm font-medium">Request</button></td>
            `;
            dom.tbodyStock.appendChild(tr);
        });
    }

    async function loadHistory() {
        const status = document.getElementById('filter-status').value;
        dom.tbodyHistory.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-500">Loading requests...</td></tr>';
        try {
            const res = await fetch(`${BASE_URL}/inventory/restock-requests?status_filter=${status}`, { headers: getHeaders() });
            if (res.status === 401) return handleAuthError();
            if (!res.ok) throw new Error("Failed to load requests");
            const reqs = await res.json();
            renderHistoryTable(reqs);
            if(dom.statPending) dom.statPending.innerText = reqs.filter(r => r.status === 'pending').length;
            if(dom.statApproved) dom.statApproved.innerText = reqs.filter(r => r.status === 'approved').length;
        } catch (err) {
            console.error(err);
            dom.tbodyHistory.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">Error: ${err.message}</td></tr>`;
        }
    }

    function renderHistoryTable(reqs) {
        dom.tbodyHistory.innerHTML = '';
        if (reqs.length === 0) {
            dom.tbodyHistory.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-500">No requests found.</td></tr>';
            return;
        }
        reqs.forEach(req => {
            const dateStr = new Date(req.request_date).toLocaleDateString();
            let statusColor = 'bg-gray-100 text-gray-600';
            if (req.status === 'pending') statusColor = 'bg-yellow-100 text-yellow-800';
            if (req.status === 'approved') statusColor = 'bg-green-100 text-green-800';
            if (req.status === 'declined') statusColor = 'bg-red-100 text-red-800';
            if (req.status === 'cancelled') statusColor = 'bg-gray-200 text-gray-400 line-through';
            if (req.status === 'delivered') statusColor = 'bg-blue-100 text-blue-800';

            let actions = '<span class="text-xs text-gray-300">-</span>';
            if (req.status === 'pending') {
                actions = `
                    <div class="flex justify-end gap-3">
                        <button onclick="inventoryApp.openModal(${req.id}, '${req.item_name}', ${req.quantity_needed})" class="text-blue-600 hover:text-blue-800 text-xs font-bold">EDIT</button>
                        <button onclick="inventoryApp.cancelRequest(${req.id})" class="text-red-500 hover:text-red-700 text-xs font-bold">CANCEL</button>
                    </div>
                `;
            } else if (req.status === 'approved') {
                actions = `
                    <div class="flex justify-end">
                        <button onclick="inventoryApp.receiveStock(${req.id})" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-bold shadow">RECEIVE</button>
                    </div>
                `;
            }
            const row = document.createElement('tr');
            row.className = 'border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors';
            row.innerHTML = `
                <td class="px-4 py-3 text-xs text-gray-500">${dateStr}</td>
                <td class="px-4 py-3 font-medium">${req.item_name}</td>
                <td class="px-4 py-3 text-center">${req.quantity_needed}</td>
                <td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded text-xs uppercase font-bold ${statusColor}">${req.status}</span></td>
                <td class="px-4 py-3 text-xs italic text-gray-500">${req.comments || ''}</td>
                <td class="px-4 py-3 text-right">${actions}</td>
            `;
            dom.tbodyHistory.appendChild(row);
        });
    }

    function openModal(id, itemName, qty) {
        dom.modal.classList.remove('hidden');
        dom.inpId.value = id || '';
        dom.inpItem.value = itemName || '';
        dom.inpQty.value = qty || '';
        dom.modalTitle.innerText = id ? "Edit Restock Request" : "Request Restock";
        dom.inpQty.focus();
    }

    async function submitRequest() {
        const id = dom.inpId.value;
        const payload = { item_name: dom.inpItem.value, quantity_needed: parseInt(dom.inpQty.value) };
        if (!payload.quantity_needed || payload.quantity_needed < 1) {
            alert("Please enter a valid quantity.");
            return;
        }
        try {
            let url = `${BASE_URL}/inventory/restock-requests`, method = 'POST';
            if (id) { url = `${BASE_URL}/inventory/restock-requests/${id}/edit`; method = 'PUT'; }
            const res = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(payload) });
            if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Operation failed"); }
            dom.modal.classList.add('hidden');
            alert("Request submitted successfully.");
            switchView('history');
        } catch (err) { alert("Error: " + err.message); }
    }

    async function cancelRequest(id) {
        if (!confirm("Are you sure you want to cancel this pending request?")) return;
        try {
            const res = await fetch(`${BASE_URL}/inventory/restock-requests/${id}/cancel`, { method: 'PUT', headers: getHeaders() });
            if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Cancellation failed"); }
            loadHistory(); 
        } catch (err) { alert("Error: " + err.message); }
    }

    async function receiveStock(id) {
        if (!confirm("Confirm you have physically received these items? This will increase your inventory count.")) return;
        try {
            const res = await fetch(`${BASE_URL}/inventory/restock-requests/${id}/receive`, { method: 'POST', headers: getHeaders() });
            if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Failed to receive stock"); }
            alert("Stock received! Inventory updated.");
            loadHistory();
        } catch (err) { alert("Error: " + err.message); }
    }

    async function triggerAutoRestock() {
        const threshold = document.getElementById('threshold-days').value || 5;
        if (!confirm(`Auto-generate requests for ALL items with <= ${threshold} days of stock?`)) return;
        try {
            const res = await fetch(`${BASE_URL}/inventory/auto-restock-check?threshold_days=${threshold}`, { method: 'POST', headers: getHeaders() });
            if (!res.ok) throw new Error("Auto-restock failed");
            const data = await res.json();
            alert(`Success! Created ${data.created_requests} new requests.`);
            switchView('history');
        } catch (err) { alert("Error: " + err.message); }
    }

    function handleAuthError() {
        alert("Session expired. Please login again.");
        window.location.href = 'login.html';
    }

    return { switchView, loadStock, loadHistory, openModal, submitRequest, cancelRequest, receiveStock, triggerAutoRestock };
})();

// --- 4. Reports & Issues Logic ---
const reportsApp = (function() {
    const BASE_URL = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : API_BASE_URL;

    function getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        };
    }

    const dom = {
        issueForm: document.getElementById('issue-form'),
        issueList: document.getElementById('issue-history'),
        reportList: document.getElementById('report-list'),
        modal: document.getElementById('modal-report-editor'),
        editContent: document.getElementById('edit-report-content'),
        editId: document.getElementById('edit-report-id'),
        statusBadge: document.getElementById('report-status-badge')
    };

    async function loadIssues() {
        try {
            const res = await fetch(`${BASE_URL}/reports/issues`, { headers: getHeaders() });
            if (!res.ok) return;
            const issues = await res.json();
            dom.issueList.innerHTML = issues.length ? '' : '<div class="text-gray-400 italic">No issues reported.</div>';
            issues.slice(0, 5).forEach(issue => {
                const color = issue.priority === 'High' ? 'text-red-600' : 'text-gray-600';
                dom.issueList.innerHTML += `
                    <div class="border-l-2 border-gray-300 pl-3 py-1">
                        <div class="flex justify-between">
                            <span class="font-medium text-gray-700 dark:text-gray-300">${issue.category}</span>
                            <span class="text-xs ${color} font-bold">${issue.priority}</span>
                        </div>
                        <p class="text-xs text-gray-500 truncate">${issue.description}</p>
                    </div>
                `;
            });
        } catch (e) { console.error(e); }
    }

    async function submitIssue(e) {
        e.preventDefault();
        const payload = {
            category: document.getElementById('issue-cat').value,
            priority: document.getElementById('issue-priority').value,
            description: document.getElementById('issue-desc').value
        };
        try {
            const res = await fetch(`${BASE_URL}/reports/issues`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) });
            if (res.ok) {
                alert("Issue reported successfully.");
                document.getElementById('issue-desc').value = "";
                loadIssues();
            } else { alert("Failed to report issue"); }
        } catch (e) { alert("Error submitting issue"); }
    }

    async function loadReports() {
        dom.reportList.innerHTML = '<div class="text-sm text-gray-400">Loading...</div>';
        try {
            const res = await fetch(`${BASE_URL}/reports/`, { headers: getHeaders() });
            const reports = await res.json();
            dom.reportList.innerHTML = reports.length ? '' : '<div class="p-4 bg-gray-50 rounded text-center text-sm text-gray-500">No reports yet.</div>';
            reports.forEach(r => {
                const isDraft = r.status === 'Draft';
                dom.reportList.innerHTML += `
                    <div class="flex items-center justify-between p-3 border rounded-lg bg-white dark:bg-gray-800">
                        <div>
                            <div class="font-bold text-gray-800 dark:text-gray-200">${r.month} Report</div>
                            <div class="text-xs ${isDraft ? 'text-yellow-600' : 'text-green-600'} font-bold uppercase">${r.status}</div>
                        </div>
                        <button onclick="reportsApp.openEditor(${r.id})" class="text-blue-600 flex items-center gap-1 text-sm font-medium">
                            <span class="material-icons text-base">${isDraft ? 'edit' : 'visibility'}</span> ${isDraft ? 'Edit' : 'View'}
                        </button>
                    </div>
                `;
            });
        } catch (e) { console.error(e); }
    }

    async function generateReport() {
        const date = new Date();
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if(!confirm(`Generate AI Report for ${monthStr}?`)) return;
        try {
            const res = await fetch(`${BASE_URL}/reports/generate`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ month_str: monthStr }) });
            if (res.ok) { const report = await res.json(); openEditor(report.id); loadReports(); }
        } catch (e) { alert("Error generating report"); }
    }

    async function openEditor(id) {
        const res = await fetch(`${BASE_URL}/reports/`, { headers: getHeaders() });
        const reports = await res.json();
        const report = reports.find(r => r.id === id);
        if(!report) return;
        dom.editId.value = report.id;
        dom.editContent.value = report.content;
        const isDraft = report.status === 'Draft';
        dom.editContent.disabled = !isDraft;
        dom.statusBadge.innerText = report.status.toUpperCase();
        const btns = dom.modal.querySelectorAll('button:not(:first-child)');
        btns.forEach(b => b.style.display = isDraft ? 'inline-block' : 'none');
        dom.modal.classList.remove('hidden');
    }

    async function saveDraft() {
        try {
            const res = await fetch(`${BASE_URL}/reports/${dom.editId.value}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ content: dom.editContent.value }) });
            if(res.ok) { alert("Draft saved!"); loadReports(); }
        } catch(e) { alert("Error saving"); }
    }

    async function submitReport() {
        if(!confirm("Submit to LGA?")) return;
        try {
            const res = await fetch(`${BASE_URL}/reports/${dom.editId.value}/submit`, { method: 'POST', headers: getHeaders() });
            if(res.ok) { alert("Report submitted!"); dom.modal.classList.add('hidden'); loadReports(); }
        } catch(e) { alert("Error submitting"); }
    }

    if(dom.issueForm) dom.issueForm.addEventListener('submit', submitIssue);

    return { loadIssues, loadReports, generateReport, openEditor, saveDraft, submitReport };
})();

// Re-init view when tab changes
document.addEventListener('click', (e) => {
    const tb = e.target.closest('.tab-btn');
    if (tb && tb.dataset.tab === 'inventory') setTimeout(() => inventoryApp.switchView('stock'), 100);
    if (tb && tb.dataset.tab === 'reports') { reportsApp.loadIssues(); reportsApp.loadReports(); }
});





// --- 5. Workload & Forecast Logic ---
const workloadApp = (function() {
    
    const BASE_URL = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://127.0.0.1:8000';

    function getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        };
    }

    // --- Fetch Latest Forecast ---
    async function fetchForecast() {
        try {
            const res = await fetch(`${BASE_URL}/workload/forecast`, { headers: getHeaders() });
            if (!res.ok) return;
            const data = await res.json();
            updateForecastUI(data);
        } catch (e) { console.error("Failed to load forecast:", e); }
    }

    // --- Submit Daily Total (Closing Day) ---
    async function submitDailyTotal() {
        const input = document.getElementById('daily-total-input');
        const count = parseInt(input.value);

        if (isNaN(count) || count < 0) {
            alert("Please enter a valid number of patients.");
            return;
        }

        try {
            const res = await fetch(`${BASE_URL}/workload/submit`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ patient_count: count })
            });

            if (res.ok) {
                const data = await res.json();
                alert(data.message);
                updateForecastUI(data); // Refresh cards immediately
                input.value = ''; // Clear input field
            } else {
                const err = await res.json();
                alert("Error: " + (err.detail || "Submission failed"));
            }
        } catch (e) { 
            console.error(e);
            alert("Connection error: Could not save daily total."); 
        }
    }

    // --- Update UI Based on Status ---
    function updateForecastUI(data) {
        const loadText = document.getElementById('stat-tomorrow-load');
        const card = document.getElementById('card-tomorrow-load');
        const msg = document.getElementById('forecast-status-msg');

        if (!loadText || !card || !msg) return;

        // Set value
        loadText.innerText = data.tomorrow_load;

        // Visual Feedback
        if (data.status === "Overwhelmed") {
            // Turn card Red
            card.classList.remove('bg-blue-100', 'dark:bg-blue-900');
            card.classList.add('bg-red-100', 'dark:bg-red-900', 'border-2', 'border-red-500');
            
            // Set Warning Message
            msg.innerText = "⚠️ ALERT: Capacity Exceeded. Staffing request may be automated.";
            msg.className = "p-2 bg-red-100 text-red-800 rounded-lg text-sm text-center font-bold";
        } else {
            // Keep Blue
            card.classList.add('bg-blue-100', 'dark:bg-blue-900');
            card.classList.remove('bg-red-100', 'dark:bg-red-900', 'border-2', 'border-red-500');
            
            // Normal Message
            msg.innerText = "Forecast updated: Operations Optimal.";
            msg.className = "p-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-lg text-sm text-center";
        }
    }

    return { submitDailyTotal, fetchForecast };
})();