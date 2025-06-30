// Dashboard JavaScript functionality

// Global variables
let currentSection = 'dashboard';
let coachCurrentStep = 1;
let userCurrentStep = 1;
let deleteItemEmail = '';
let deleteItemType = '';
let deleteItemName = '';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    loadDashboard();
    loadCoaches();
    loadUsers();
    loadStorage();
    loadDefaultPasswords();
    loadLogs();
    loadReport();
});

// Navigation functions
function showSection(section) {
    // Hide all sections
    document.querySelectorAll('[id$="-section"]').forEach(el => {
        el.style.display = 'none';
    });
    
    // Show selected section
    document.getElementById(section + '-section').style.display = 'block';
    
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(el => {
        el.classList.remove('active');
    });
    event.target.classList.add('active');
    
    currentSection = section;
}

// Dashboard functions
async function loadDashboard() {
    try {
        const [coachesRes, usersRes, storageRes, reportRes] = await Promise.all([
            fetch('/api/coaches'),
            fetch('/api/users'),
            fetch('/api/storage'),
            fetch('/api/report')
        ]);
        
        const coaches = await coachesRes.json();
        const users = await usersRes.json();
        const storage = await storageRes.json();
        const report = await reportRes.json();
        
        // Update stats
        document.getElementById('coaches-count').textContent = coaches.coaches.filter(c => c.status === 'active').length;
        document.getElementById('users-count').textContent = users.users.filter(u => u.status === 'active').length;
        document.getElementById('storage-count').textContent = storage.buckets.length;
        document.getElementById('revenue-today').textContent = `$${report.report.total_revenue.toFixed(2)}`;
        
        // Update recent activity
        updateRecentActivity(report.report.recent_transactions);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function updateRecentActivity(transactions) {
    const container = document.getElementById('recent-activity');
    
    if (transactions.length === 0) {
        container.innerHTML = '<p class="text-muted">No recent activity</p>';
        return;
    }
    
    const html = transactions.map(t => `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <div>
                <strong>${t.description || 'Transaction'}</strong>
                <br><small class="text-muted">${t.time || t.date}</small>
            </div>
            <span class="badge bg-success">$${t.amount.toFixed(2)}</span>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// Coach functions
async function loadCoaches() {
    try {
        const response = await fetch('/api/coaches');
        const data = await response.json();
        
        const container = document.getElementById('coaches-list');
        
        if (data.coaches.length === 0) {
            container.innerHTML = '<p class="text-muted">No coaches found</p>';
            return;
        }
        
        const html = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Specialization</th>
                            <th>Rate</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.coaches.map(coach => `
                            <tr>
                                <td>${coach.name}</td>
                                <td>${coach.email}</td>
                                <td>${coach.specialization}</td>
                                <td>$${coach.hourly_rate}</td>
                                <td>
                                    <span class="badge bg-${coach.status === 'active' ? 'success' : 'danger'}">
                                        ${coach.status}
                                    </span>
                                </td>
                                <td>
                                    ${coach.status === 'active' ? 
                                        `<button class="btn btn-sm btn-warning" onclick="blockCoach('${coach.email}')">
                                            <i class="fas fa-ban"></i> Block
                                        </button>` :
                                        `<button class="btn btn-sm btn-success" onclick="unblockCoach('${coach.email}')">
                                            <i class="fas fa-check"></i> Unblock
                                        </button>`
                                    }
                                    <button class="btn btn-sm btn-info ms-1" onclick="showChangePasswordModal('${coach.email}', 'coach', '${coach.name}')">
                                        <i class="fas fa-key"></i> Password
                                    </button>
                                    <button class="btn btn-sm btn-danger ms-1" onclick="showDeleteConfirmModal('${coach.email}', 'coach', '${coach.name}')">
                                        <i class="fas fa-trash"></i> Delete
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading coaches:', error);
        document.getElementById('coaches-list').innerHTML = '<p class="text-danger">Error loading coaches</p>';
    }
}

function showCreateCoachModal() {
    const modal = new bootstrap.Modal(document.getElementById('createCoachModal'));
    
    // Reset modal state
    coachCurrentStep = 1;
    showCoachStep(1);
    
    // Reset forms
    document.getElementById('coachBasicForm').reset();
    document.getElementById('coachProfileForm').reset();
    
    // Reset password fields
    document.getElementById('coachDefaultPassword').checked = true;
    document.getElementById('coachCustomPasswordField').style.display = 'none';
    
    modal.show();
}

async function createCoach() {
    const email = document.querySelector('#coachBasicForm input[name="email"]').value;
    const name = document.querySelector('#coachBasicForm input[name="name"]').value;
    const specialization = document.querySelector('#coachProfileForm select[name="specialization"]').value;
    const hourlyRate = document.querySelector('#coachProfileForm input[name="hourly_rate"]').value;
    
    // Get password
    let password = '';
    if (document.getElementById('coachDefaultPassword').checked) {
        password = document.getElementById('coachDefaultPasswordText').textContent;
    } else {
        password = document.querySelector('#coachCustomPasswordField input[name="customPassword"]').value;
        if (!password || password.length < 6) {
            showAlert('warning', 'Custom password must be at least 6 characters');
            return;
        }
    }
    
    const data = {
        email: email,
        name: name,
        specialization: specialization,
        hourly_rate: hourlyRate,
        password: password
    };
    
    try {
        const response = await fetch('/api/coaches', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            bootstrap.Modal.getInstance(document.getElementById('createCoachModal')).hide();
            loadCoaches();
            loadDashboard();
            showAlert('success', result.message);
        } else {
            showAlert('danger', result.message);
        }
        
    } catch (error) {
        console.error('Error creating coach:', error);
        showAlert('danger', 'Error creating coach');
    }
}

async function blockCoach(email) {
    try {
        const response = await fetch('/api/coaches/block', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const result = await response.json();
        
        if (result.success) {
            loadCoaches();
            showAlert('success', result.message);
        } else {
            showAlert('danger', result.message);
        }
        
    } catch (error) {
        console.error('Error blocking coach:', error);
        showAlert('danger', 'Error blocking coach');
    }
}

async function unblockCoach(email) {
    try {
        const response = await fetch('/api/coaches/unblock', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const result = await response.json();
        
        if (result.success) {
            loadCoaches();
            showAlert('success', result.message);
        } else {
            showAlert('danger', result.message);
        }
        
    } catch (error) {
        console.error('Error unblocking coach:', error);
        showAlert('danger', 'Error unblocking coach');
    }
}

// User functions
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const data = await response.json();
        
        const container = document.getElementById('users-list');
        
        if (data.users.length === 0) {
            container.innerHTML = '<p class="text-muted">No users found</p>';
            return;
        }
        
        const html = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.users.map(user => `
                            <tr>
                                <td>${user.name}</td>
                                <td>${user.email}</td>
                                <td>
                                    <span class="badge bg-info">${user.role}</span>
                                </td>
                                <td>
                                    <span class="badge bg-${user.status === 'active' ? 'success' : 'danger'}">
                                        ${user.status}
                                    </span>
                                </td>
                                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                                <td>
                                    <button class="btn btn-sm btn-info" onclick="showChangePasswordModal('${user.email}', 'user', '${user.name}')">
                                        <i class="fas fa-key"></i> Password
                                    </button>
                                    <button class="btn btn-sm btn-danger ms-1" onclick="showDeleteConfirmModal('${user.email}', 'user', '${user.name}')">
                                        <i class="fas fa-trash"></i> Delete
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('users-list').innerHTML = '<p class="text-danger">Error loading users</p>';
    }
}

function showCreateUserModal() {
    const modal = new bootstrap.Modal(document.getElementById('createUserModal'));
    
    // Reset modal state
    userCurrentStep = 1;
    showUserStep(1);
    
    // Reset forms
    document.getElementById('userBasicForm').reset();
    
    // Reset password fields
    document.getElementById('userDefaultPassword').checked = true;
    document.getElementById('userCustomPasswordField').style.display = 'none';
    
    modal.show();
}

async function createUser() {
    const email = document.querySelector('#userBasicForm input[name="email"]').value;
    const name = document.querySelector('#userBasicForm input[name="name"]').value;
    const role = document.querySelector('#userBasicForm select[name="role"]').value;
    
    // Get password
    let password = '';
    if (document.getElementById('userDefaultPassword').checked) {
        password = document.getElementById('userDefaultPasswordText').textContent;
    } else {
        password = document.querySelector('#userCustomPasswordField input[name="customPassword"]').value;
        if (!password || password.length < 6) {
            showAlert('warning', 'Custom password must be at least 6 characters');
            return;
        }
    }
    
    const data = {
        email: email,
        name: name,
        role: role,
        password: password
    };
    
    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            bootstrap.Modal.getInstance(document.getElementById('createUserModal')).hide();
            loadUsers();
            loadDashboard();
            showAlert('success', result.message);
        } else {
            showAlert('danger', result.message);
        }
        
    } catch (error) {
        console.error('Error creating user:', error);
        showAlert('danger', 'Error creating user');
    }
}

// Storage functions
async function loadStorage() {
    try {
        const response = await fetch('/api/storage');
        const data = await response.json();
        
        const container = document.getElementById('storage-list');
        
        if (data.buckets.length === 0) {
            container.innerHTML = '<p class="text-muted">No storage buckets found</p>';
            return;
        }
        
        const html = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Purpose</th>
                            <th>Size</th>
                            <th>Used</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.buckets.map(bucket => `
                            <tr>
                                <td>${bucket.name}</td>
                                <td>${bucket.purpose}</td>
                                <td>${bucket.size_gb}GB</td>
                                <td>${bucket.used_gb}GB</td>
                                <td>
                                    <span class="badge bg-${bucket.status === 'active' ? 'success' : 'danger'}">
                                        ${bucket.status}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading storage:', error);
        document.getElementById('storage-list').innerHTML = '<p class="text-danger">Error loading storage</p>';
    }
}

function showCreateStorageModal() {
    const modal = new bootstrap.Modal(document.getElementById('createStorageModal'));
    modal.show();
}

async function createStorage() {
    const form = document.getElementById('createStorageForm');
    const formData = new FormData(form);
    
    const data = {
        name: formData.get('name'),
        purpose: formData.get('purpose'),
        size_gb: formData.get('size_gb')
    };
    
    try {
        const response = await fetch('/api/storage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            bootstrap.Modal.getInstance(document.getElementById('createStorageModal')).hide();
            form.reset();
            loadStorage();
            loadDashboard();
            showAlert('success', result.message);
        } else {
            showAlert('danger', result.message);
        }
        
    } catch (error) {
        console.error('Error creating storage bucket:', error);
        showAlert('danger', 'Error creating storage bucket');
    }
}

// Logs functions
async function loadLogs() {
    try {
        const days = document.getElementById('logs-days').value;
        const response = await fetch(`/api/logs?days=${days}`);
        const data = await response.json();
        
        const container = document.getElementById('logs-content');
        
        if (data.logs.length === 0) {
            container.innerHTML = '<p class="text-muted">No logs found</p>';
            return;
        }
        
        const html = data.logs.map(log => `
            <div class="mb-3">
                <h6>${log.date}</h6>
                <pre class="bg-light p-3 rounded" style="max-height: 200px; overflow-y: auto;">${log.content}</pre>
            </div>
        `).join('');
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading logs:', error);
        document.getElementById('logs-content').innerHTML = '<p class="text-danger">Error loading logs</p>';
    }
}

// Report functions
async function loadReport() {
    try {
        const date = document.getElementById('report-date').value || new Date().toISOString().split('T')[0];
        const response = await fetch(`/api/report?date=${date}`);
        const data = await response.json();
        
        const container = document.getElementById('report-content');
        const report = data.report;
        
        const html = `
            <div class="row">
                <div class="col-md-6">
                    <h6>Summary</h6>
                    <ul class="list-unstyled">
                        <li><strong>Active Coaches:</strong> ${report.active_coaches}</li>
                        <li><strong>Active Users:</strong> ${report.active_users}</li>
                        <li><strong>Total Sessions:</strong> ${report.total_sessions}</li>
                        <li><strong>Total Revenue:</strong> $${report.total_revenue.toFixed(2)}</li>
                    </ul>
                </div>
                <div class="col-md-6">
                    <h6>Recent Transactions</h6>
                    ${report.recent_transactions.length > 0 ? 
                        report.recent_transactions.map(t => `
                            <div class="d-flex justify-content-between mb-1">
                                <small>${t.description || 'Transaction'}</small>
                                <small class="text-success">$${t.amount.toFixed(2)}</small>
                            </div>
                        `).join('') :
                        '<p class="text-muted">No transactions</p>'
                    }
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading report:', error);
        document.getElementById('report-content').innerHTML = '<p class="text-danger">Error loading report</p>';
    }
}

// Utility functions
function showAlert(type, message) {
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Add to page
    document.body.appendChild(alertDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Event listeners
document.getElementById('logs-days').addEventListener('change', loadLogs);
document.getElementById('report-date').addEventListener('change', loadReport);

// Default Password Management Functions
async function loadDefaultPasswords() {
    try {
        const response = await fetch('/api/default-passwords');
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('coach-password').value = data.passwords.coach;
            document.getElementById('student-password').value = data.passwords.student;
            
            // Update modal default passwords
            document.getElementById('coachDefaultPasswordText').textContent = data.passwords.coach;
            document.getElementById('userDefaultPasswordText').textContent = data.passwords.student;
        }
    } catch (error) {
        console.error('Error loading default passwords:', error);
    }
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

async function updateDefaultPassword(userType) {
    const newPasswordInput = document.getElementById(`new-${userType}-password`);
    const newPassword = newPasswordInput.value.trim();
    
    if (!newPassword) {
        showAlert('warning', 'Please enter a new password');
        return;
    }
    
    if (newPassword.length < 6) {
        showAlert('warning', 'Password must be at least 6 characters long');
        return;
    }
    
    try {
        const response = await fetch('/api/default-passwords', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_type: userType,
                password: newPassword
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Update the display
            document.getElementById(`${userType}-password`).value = newPassword;
            newPasswordInput.value = '';
            showAlert('success', result.message);
        } else {
            showAlert('danger', result.message);
        }
        
    } catch (error) {
        console.error('Error updating default password:', error);
        showAlert('danger', 'Error updating default password');
    }
}

// Coach Modal Step Functions
function coachNextStep() {
    if (coachCurrentStep === 1) {
        // Validate basic info
        const email = document.querySelector('#coachBasicForm input[name="email"]').value;
        const name = document.querySelector('#coachBasicForm input[name="name"]').value;
        
        if (!email || !name) {
            showAlert('warning', 'Please fill in all required fields');
            return;
        }
        
        // Move to step 2
        showCoachStep(2);
    } else if (coachCurrentStep === 2) {
        // Move to step 3
        showCoachStep(3);
    } else if (coachCurrentStep === 3) {
        // Validate profile info
        const specialization = document.querySelector('#coachProfileForm select[name="specialization"]').value;
        const hourlyRate = document.querySelector('#coachProfileForm input[name="hourly_rate"]').value;
        
        if (!specialization || !hourlyRate) {
            showAlert('warning', 'Please fill in all required fields');
            return;
        }
        
        // Move to step 4 (review)
        updateCoachReview();
        showCoachStep(4);
    }
}

function coachPrevStep() {
    if (coachCurrentStep > 1) {
        showCoachStep(coachCurrentStep - 1);
    }
}

function showCoachStep(step) {
    // Hide all step contents
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`coach-step-content-${i}`).style.display = 'none';
        document.getElementById(`coach-step-${i}`).classList.remove('active', 'completed');
    }
    
    // Show current step content
    document.getElementById(`coach-step-content-${step}`).style.display = 'block';
    
    // Update step indicators
    for (let i = 1; i <= step; i++) {
        if (i < step) {
            document.getElementById(`coach-step-${i}`).classList.add('completed');
        } else {
            document.getElementById(`coach-step-${i}`).classList.add('active');
        }
    }
    
    // Update buttons
    const prevBtn = document.getElementById('coachPrevBtn');
    const nextBtn = document.getElementById('coachNextBtn');
    const createBtn = document.getElementById('coachCreateBtn');
    
    prevBtn.style.display = step > 1 ? 'inline-block' : 'none';
    nextBtn.style.display = step < 4 ? 'inline-block' : 'none';
    createBtn.style.display = step === 4 ? 'inline-block' : 'none';
    
    coachCurrentStep = step;
}

function updateCoachReview() {
    const email = document.querySelector('#coachBasicForm input[name="email"]').value;
    const name = document.querySelector('#coachBasicForm input[name="name"]').value;
    const specialization = document.querySelector('#coachProfileForm select[name="specialization"]').value;
    const hourlyRate = document.querySelector('#coachProfileForm input[name="hourly_rate"]').value;
    const bio = document.querySelector('#coachProfileForm textarea[name="bio"]').value;
    
    // Get password
    let password = '';
    if (document.getElementById('coachDefaultPassword').checked) {
        password = document.getElementById('coachDefaultPasswordText').textContent;
    } else {
        password = document.querySelector('#coachCustomPasswordField input[name="customPassword"]').value;
    }
    
    document.getElementById('coach-review-email').textContent = email;
    document.getElementById('coach-review-name').textContent = name;
    document.getElementById('coach-review-password').textContent = password;
    document.getElementById('coach-review-specialization').textContent = specialization;
    document.getElementById('coach-review-rate').textContent = `$${hourlyRate}`;
    document.getElementById('coach-review-bio').textContent = bio || 'No bio provided';
}

// User Modal Step Functions
function userNextStep() {
    if (userCurrentStep === 1) {
        // Validate basic info
        const email = document.querySelector('#userBasicForm input[name="email"]').value;
        const name = document.querySelector('#userBasicForm input[name="name"]').value;
        const role = document.querySelector('#userBasicForm select[name="role"]').value;
        
        if (!email || !name || !role) {
            showAlert('warning', 'Please fill in all required fields');
            return;
        }
        
        // Move to step 2
        showUserStep(2);
    } else if (userCurrentStep === 2) {
        // Move to step 3 (review)
        updateUserReview();
        showUserStep(3);
    }
}

function userPrevStep() {
    if (userCurrentStep > 1) {
        showUserStep(userCurrentStep - 1);
    }
}

function showUserStep(step) {
    // Hide all step contents
    for (let i = 1; i <= 3; i++) {
        document.getElementById(`user-step-content-${i}`).style.display = 'none';
        document.getElementById(`user-step-${i}`).classList.remove('active', 'completed');
    }
    
    // Show current step content
    document.getElementById(`user-step-content-${step}`).style.display = 'block';
    
    // Update step indicators
    for (let i = 1; i <= step; i++) {
        if (i < step) {
            document.getElementById(`user-step-${i}`).classList.add('completed');
        } else {
            document.getElementById(`user-step-${i}`).classList.add('active');
        }
    }
    
    // Update buttons
    const prevBtn = document.getElementById('userPrevBtn');
    const nextBtn = document.getElementById('userNextBtn');
    const createBtn = document.getElementById('userCreateBtn');
    
    prevBtn.style.display = step > 1 ? 'inline-block' : 'none';
    nextBtn.style.display = step < 3 ? 'inline-block' : 'none';
    createBtn.style.display = step === 3 ? 'inline-block' : 'none';
    
    userCurrentStep = step;
}

function updateUserReview() {
    const email = document.querySelector('#userBasicForm input[name="email"]').value;
    const name = document.querySelector('#userBasicForm input[name="name"]').value;
    const role = document.querySelector('#userBasicForm select[name="role"]').value;
    
    // Get password
    let password = '';
    if (document.getElementById('userDefaultPassword').checked) {
        password = document.getElementById('userDefaultPasswordText').textContent;
    } else {
        password = document.querySelector('#userCustomPasswordField input[name="customPassword"]').value;
    }
    
    document.getElementById('user-review-email').textContent = email;
    document.getElementById('user-review-name').textContent = name;
    document.getElementById('user-review-role').textContent = role;
    document.getElementById('user-review-password').textContent = password;
}

// Delete and Password Change Functions
function showDeleteConfirmModal(email, type, name) {
    deleteItemEmail = email;
    deleteItemType = type;
    deleteItemName = name;
    
    document.getElementById('deleteItemName').textContent = `${name} (${email})`;
    const modal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    modal.show();
}

async function confirmDelete() {
    try {
        const endpoint = deleteItemType === 'coach' ? '/api/coaches/delete' : '/api/users/delete';
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: deleteItemEmail })
        });
        
        const result = await response.json();
        
        if (result.success) {
            bootstrap.Modal.getInstance(document.getElementById('deleteConfirmModal')).hide();
            
            if (deleteItemType === 'coach') {
                loadCoaches();
            } else {
                loadUsers();
            }
            loadDashboard();
            showAlert('success', result.message);
        } else {
            showAlert('danger', result.message);
        }
        
    } catch (error) {
        console.error('Error deleting item:', error);
        showAlert('danger', 'Error deleting item');
    }
}

function showChangePasswordModal(email, type, name) {
    document.getElementById('changePasswordEmail').value = email;
    document.getElementById('changePasswordType').value = type;
    document.getElementById('changePasswordForm').reset();
    
    const modal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
    modal.show();
}

async function updatePassword() {
    const email = document.getElementById('changePasswordEmail').value;
    const type = document.getElementById('changePasswordType').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!newPassword || newPassword.length < 6) {
        showAlert('warning', 'Password must be at least 6 characters long');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showAlert('warning', 'Passwords do not match');
        return;
    }
    
    try {
        const endpoint = type === 'coach' ? '/api/coaches/update-password' : '/api/users/update-password';
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                email: email,
                password: newPassword
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            bootstrap.Modal.getInstance(document.getElementById('changePasswordModal')).hide();
            showAlert('success', result.message);
        } else {
            showAlert('danger', result.message);
        }
        
    } catch (error) {
        console.error('Error updating password:', error);
        showAlert('danger', 'Error updating password');
    }
}

// Event listeners for password type changes
document.addEventListener('DOMContentLoaded', function() {
    // Coach password type change
    document.getElementById('coachDefaultPassword').addEventListener('change', function() {
        document.getElementById('coachCustomPasswordField').style.display = 'none';
    });
    
    document.getElementById('coachCustomPassword').addEventListener('change', function() {
        document.getElementById('coachCustomPasswordField').style.display = 'block';
    });
    
    // User password type change
    document.getElementById('userDefaultPassword').addEventListener('change', function() {
        document.getElementById('userCustomPasswordField').style.display = 'none';
    });
    
    document.getElementById('userCustomPassword').addEventListener('change', function() {
        document.getElementById('userCustomPasswordField').style.display = 'block';
    });
}); 