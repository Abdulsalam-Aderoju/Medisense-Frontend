let isLogin = true;

const form = document.getElementById('auth-form');
const formTitle = document.getElementById('form-title');
const submitButton = document.getElementById('submit-button');
const toggleButton = document.getElementById('toggle-button');
const toggleText = document.getElementById('toggle-text');

// Groups
const fullNameGroup = document.getElementById('full-name-group');
const roleGroup = document.getElementById('role-group');
const operatorGroup = document.getElementById('operator-group');
const lgaGroup = document.getElementById('lga-group');
const errorMessage = document.getElementById('error-message');
const phcGroup = document.getElementById('phc-group');

// Inputs
const fullNameInput = document.getElementById('full_name');
const roleInput = document.getElementById('role');
const lgaInput = document.getElementById('lga_id');
const phcInput = document.getElementById('phc_id');
const operatorInput = document.getElementById('operator_name');

document.addEventListener('DOMContentLoaded', () => {
    // Reset all dynamic requirements on load
    fullNameInput.required = false;
    roleInput.required = false;
    lgaInput.required = false;
    operatorInput.required = true; // Default is login
});

roleInput.addEventListener('change', () => {
    if (roleInput.value === 'phc') {
        phcGroup.classList.remove('hidden');
        phcInput.required = true;
    } else {
        phcGroup.classList.add('hidden');
        phcInput.required = false;
        phcInput.value = ""; // Clear it if they switch roles
    }
});

toggleButton.addEventListener('click', () => {
    isLogin = !isLogin;
    errorMessage.classList.add('hidden');
    form.reset();

    // Update Text
    formTitle.textContent = isLogin ? 'Sign In' : 'Create Account';
    submitButton.textContent = isLogin ? 'Sign In' : 'Sign Up';
    toggleText.textContent = isLogin ? "Don't have an account?" : "Already have an account?";
    toggleButton.textContent = isLogin ? 'Sign Up' : 'Sign In';

    if (isLogin) {
        // --- LOGIN MODE ---
        operatorGroup.classList.remove('hidden');

        // Hide: All Signup Fields
        fullNameGroup.classList.add('hidden');
        roleGroup.classList.add('hidden');
        lgaGroup.classList.add('hidden');
        phcGroup.classList.add('hidden');

        // Update Requirements
        operatorInput.required = true;
        fullNameInput.required = false;
        roleInput.required = false;
        lgaInput.required = false;
        phcInput.required = false;
    } else {
        // --- SIGNUP MODE ---
        operatorGroup.classList.add('hidden');

        // Show: Standard Signup Fields
        fullNameGroup.classList.remove('hidden');
        roleGroup.classList.remove('hidden');
        lgaGroup.classList.remove('hidden');

        // Check Role Immediately
        if (roleInput.value === 'phc') {
            phcGroup.classList.remove('hidden');
            phcInput.required = true;
        } else {
            phcGroup.classList.add('hidden');
            phcInput.required = false;
        }

        // Update Requirements
        operatorInput.required = false;
        fullNameInput.required = true;
        roleInput.required = true;
        lgaInput.required = true;
    }
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.classList.add('hidden');
    const formData = new FormData(form);

    if (isLogin) {
        // Login Logic
        const loginData = {
            email: formData.get('email'),
            password: formData.get('password'),
            operator_name: formData.get('operator_name')
        };

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                body: JSON.stringify(loginData),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Login failed');

            localStorage.setItem('accessToken', data.access_token);
            localStorage.setItem('userRole', data.role);

            // Redirects based on role
            if (data.role === 'phc') {
                window.location.href = './frontline.html';
            } else if (data.role === 'lga') {
                window.location.href = './admin.html';
            } else {
                window.location.href = './index.html';
            }
        } catch (error) {
            errorMessage.textContent = error.message;
            errorMessage .classList.remove('hidden');
        }

    } else {
        // Signup Logic
        const signupData = {
            name: formData.get('full_name'),
            email: formData.get('email'),
            password: formData.get('password'),
            role: formData.get('role'),
            lga_id: formData.get('lga_id'),
            phc_id: formData.get('phc_id')
        };

        try {
            const response = await fetch(`${API_BASE_URL}/auth/signup`, {
                method: 'POST',
                body: JSON.stringify(signupData),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Signup failed');

            toggleButton.click();
            errorMessage.textContent = 'Account created successfully! Please sign in.';
            errorMessage.classList.remove('hidden');
            errorMessage.style.color = '#22c55e';
        } catch (error) {
            errorMessage.textContent = error.message;
            errorMessage.classList.remove('hidden');
            errorMessage.style.color = '#ef4444';
        }
    }
});

// Translation Logic
(function() {
    const translations = {
        en: { sign_in: "Sign In", sign_in_btn: "Sign In", sign_up_btn: "Sign Up", dont_have_account: "Don't have an account?", create_account: "Create Account" },
        yo: { sign_in: "Wọlé", sign_in_btn: "Wọlé", sign_up_btn: "Forúkọṣilẹ", dont_have_account: "Ṣe o kò ní àkọọlẹ?", create_account: "Ṣe Àkọọlẹ" },
        sw: { sign_in: "Ingia", sign_in_btn: "Ingia", sign_up_btn: "Jisajili", dont_have_account: "Huna akaunti?", create_account: "Unda Akaunti" },
        ha: { sign_in: "Shiga", sign_in_btn: "Shiga", sign_up_btn: "Yi Rajista", dont_have_account: "Babu asusu?", create_account: "Ƙirƙiri asusu" },
        fr: { sign_in: "Connexion", sign_in_btn: "Connexion", sign_up_btn: "Inscription", dont_have_account: "Pas de compte?", create_account: "Créer un compte" }
    };

    function apply(lang) {
        const d = translations[lang] || translations.en;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const k = el.dataset.i18n;
            if (!k) return;
            el.textContent = d[k] ?? translations.en[k] ?? el.textContent;
        });
        localStorage.setItem('site_lang', lang);
    }
    const sel = document.getElementById('lang-select');
    const saved = localStorage.getItem('site_lang') || 'en';
    if (sel) {
        sel.value = saved;
        sel.addEventListener('change', (e) => apply(e.target.value));
    }
    document.addEventListener('DOMContentLoaded', () => apply(saved));
})();