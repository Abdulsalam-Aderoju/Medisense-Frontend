window.adminApp = (function() {
    
    const BASE_URL = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : API_BASE_URL;

    function getHeaders() {
        const token = localStorage.getItem('accessToken');
        if (!token) { window.location.href = "login.html"; return null; }
        return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
    }

    // --- RESTOCK REQUESTS (Existing Logic) ---
    async function fetchRequests() {
        const status = document.getElementById('filter-status').value;
        const tbody = document.getElementById('restock-tbody');
        tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-gray-400">Loading...</td></tr>';

        try {
            const res = await fetch(`${BASE_URL}/inventory/restock-requests?status_filter=${status}`, { headers: getHeaders() });
            const data = await res.json();
            
            document.getElementById('count-pending').innerText = data.filter(d => d.status === 'pending').length;
            
            tbody.innerHTML = '';
            if(!data.length) tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-gray-400">No requests found.</td></tr>';

            data.forEach(r => {
                let badge = r.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : (r.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-gray-100');
                let actions = r.status === 'pending' ? `
                    <button onclick="adminApp.decision(${r.id}, 'approved')" class="text-green-600 hover:bg-green-50 px-2 py-1 rounded text-xs font-bold border border-green-200 mr-2">Approve</button>
                    <button onclick="adminApp.decision(${r.id}, 'declined')" class="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-xs font-bold border border-red-200">Decline</button>
                ` : `<span class="text-gray-400 text-xs">-</span>`;

                tbody.innerHTML += `
                    <tr class="hover:bg-gray-50 border-b">
                        <td class="px-6 py-4 text-gray-500">${new Date(r.request_date).toLocaleDateString()}</td>
                        <td class="px-6 py-4 font-medium">${r.phc_name}</td>
                        <td class="px-6 py-4">${r.item_name}</td>
                        <td class="px-6 py-4 text-center font-mono">${r.quantity_needed}</td>
                        <td class="px-6 py-4 text-center text-xs">${r.priority_level || '-'}</td>
                        <td class="px-6 py-4 text-center"><span class="px-2 py-1 rounded-full text-xs font-bold ${badge}">${r.status}</span></td>
                        <td class="px-6 py-4 text-right">${actions}</td>
                    </tr>
                `;
            });
        } catch(e) { console.error(e); }
    }

    async function decision(id, status) {
        const comment = prompt("Add a comment (optional):", status === 'approved' ? "Approved" : "Out of stock");
        if(comment === null) return;
        await fetch(`${BASE_URL}/inventory/restock-requests/${id}`, {
            method: 'PUT', headers: getHeaders(),
            body: JSON.stringify({ status, comments: comment })
        });
        fetchRequests();
    }

    // --- ISSUES & COMPLAINTS (New) ---
    async function fetchIssues() {
        const div = document.getElementById('issues-list');
        div.innerHTML = '<div class="p-4 text-center text-gray-400">Loading issues...</div>';
        
        try {
            const res = await fetch(`${BASE_URL}/reports/issues`, { headers: getHeaders() });
            const data = await res.json();
            
            document.getElementById('count-issues').innerText = data.filter(d => d.status !== 'Resolved').length;
            
            div.innerHTML = '';
            if(!data.length) div.innerHTML = '<div class="p-4 text-center text-gray-400">No issues reported.</div>';

            data.forEach(i => {
                const isHigh = i.priority === 'High';
                // Status Tracking Logic
                let actionBtn = '';
                if(i.status === 'Open') actionBtn = `<button onclick="adminApp.setIssueStatus(${i.id}, 'In Progress')" class="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-200">Start Work</button>`;
                else if(i.status === 'In Progress') actionBtn = `<button onclick="adminApp.setIssueStatus(${i.id}, 'Resolved')" class="text-xs bg-green-50 text-green-600 px-2 py-1 rounded border border-green-200">Mark Resolved</button>`;
                else actionBtn = `<span class="text-xs text-green-600 font-bold flex items-center"><span class="material-icons text-sm mr-1">check_circle</span> Resolved</span>`;

                div.innerHTML += `
                    <div class="p-4 border-b hover:bg-gray-50 group">
                        <div class="flex justify-between items-start mb-1">
                            <div class="text-sm font-bold text-gray-800">${i.category}</div>
                            <div class="flex items-center gap-2">
                                ${isHigh ? '<span class="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded uppercase">High Priority</span>' : ''}
                                <span class="text-xs text-gray-500">${new Date(i.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div class="text-xs text-gray-600 mb-3">${i.description}</div>
                        <div class="flex justify-between items-center">
                            <div class="text-xs font-medium text-gray-500">Status: <span class="${i.status === 'Open' ? 'text-red-500' : 'text-blue-600'}">${i.status}</span></div>
                            <div>${actionBtn}</div>
                        </div>
                    </div>
                `;
            });
        } catch(e) { console.error(e); }
    }

    async function setIssueStatus(id, status) {
        if(!confirm(`Update status to "${status}"?`)) return;
        await fetch(`${BASE_URL}/reports/issues/${id}?status=${status}`, { method: 'PUT', headers: getHeaders() });
        fetchIssues();
    }

    // --- MONTHLY REPORTS (New) ---
    async function fetchReports() {
        const div = document.getElementById('reports-list');
        try {
            const res = await fetch(`${BASE_URL}/reports/`, { headers: getHeaders() });
            const data = await res.json();
            
            document.getElementById('count-reports').innerText = data.length;
            
            div.innerHTML = '';
            if(!data.length) div.innerHTML = '<div class="p-4 text-center text-gray-400">No reports submitted.</div>';

            data.forEach(r => {
                div.innerHTML += `
                    <div class="p-4 border-b hover:bg-gray-50 flex justify-between items-center">
                        <div>
                            <div class="font-bold text-gray-800">${r.month} Report</div>
                            <div class="text-xs text-gray-500">Submitted: ${new Date(r.created_at).toLocaleDateString()}</div>
                        </div>
                        <button onclick="adminApp.viewReport('${r.month}', '${encodeURIComponent(r.content)}')" class="text-blue-600 hover:underline text-sm font-medium">Read Report</button>
                    </div>
                `;
            });
        } catch(e) { console.error(e); }
    }

    function viewReport(title, contentEncoded) {
        document.getElementById('modal-title').innerText = `${title} Report`;
        document.getElementById('modal-content').innerText = decodeURIComponent(contentEncoded);
        document.getElementById('modal-report').classList.remove('hidden');
    }

    // Filters event listener
    document.getElementById('filter-status').addEventListener('change', fetchRequests);

    return { fetchRequests, decision, fetchIssues, setIssueStatus, fetchReports, viewReport };
})();