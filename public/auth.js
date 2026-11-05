(() => {
  const $ = (s) => document.querySelector(s);
  let mode = 'login';
  const tabs = [...document.querySelectorAll('[data-mode]')];
  function updateMode(next) {
    mode = next;
    const register = mode === 'register';
    $('#name-field').hidden = !register;
    $('#name').required = register;
    $('#password').autocomplete = register ? 'new-password' : 'current-password';
    $('#form-title').innerHTML = register ? 'Start your <em>story.</em>' : 'Welcome <em>back.</em>';
    $('#form-subtitle').textContent = register ? 'Create your account and start collecting places to go.' : 'Sign in to continue planning your next adventure.';
    $('#submit-button').innerHTML = (register ? 'Create account' : 'Login') + ' <span>↗</span>';
    tabs.forEach(t => { t.classList.toggle('active', t.dataset.mode === mode); t.setAttribute('aria-selected', String(t.dataset.mode === mode)); });
    $('#auth-error').textContent = '';
  }
  tabs.forEach(t => t.addEventListener('click', () => updateMode(t.dataset.mode)));
  async function request(url, body) {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to continue. Please try again.');
    return data;
  }
  (async () => {
    try {
      const response = await fetch('/api/me');
      const data = await response.json();
      if (data.user) location.replace('/destinations.html');
    } catch (_) { /* Show the sign-in form if the status check is unavailable. */ }
  })();
  $('#auth-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = $('#auth-error');
    const submit = $('#submit-button');
    error.textContent = '';
    const email = $('#email').value.trim();
    const password = $('#password').value;
    if (!email || !password) { error.textContent = 'Please enter your email and password.'; return; }
    if (mode === 'register' && !$('#name').value.trim()) { error.textContent = 'Please enter your full name.'; return; }
    if (mode === 'register' && password.length < 8) { error.textContent = 'Use a password with at least 8 characters.'; return; }
    submit.disabled = true;
    submit.textContent = mode === 'register' ? 'Creating account…' : 'Signing in…';
    try {
      const body = { email, password };
      if (mode === 'register') body.name = $('#name').value.trim();
      await request(mode === 'register' ? '/api/register' : '/api/login', body);
      location.replace('/destinations.html');
    } catch (err) {
      error.textContent = err.message;
      submit.disabled = false;
      submit.innerHTML = (mode === 'register' ? 'Create account' : 'Login') + ' <span>↗</span>';
    }
  });
})();
