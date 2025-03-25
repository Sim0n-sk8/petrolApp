// app.js
// Supabase configuration - REPLACE WITH YOUR ACTUAL VALUES
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_KEY = 'your-anon-key';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// App state
let currentUser = null;
let isAdmin = false;

// Initialize auth state listener
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    await fetchUserProfile(session.user.id);
    showApp();
  } else {
    currentUser = null;
    isAdmin = false;
    showLogin();
  }
});

// Auth functions
async function login() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  
  if (error) {
    showError('login-error', error.message);
  }
}

async function signup() {
  const email = document.getElementById('signup-email').value;
  const username = document.getElementById('signup-username').value;
  const password = document.getElementById('signup-password').value;
  
  if (password.length < 6) {
    showError('signup-error', 'Password must be at least 6 characters');
    return;
  }

  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
  if (authError) {
    showError('signup-error', authError.message);
    return;
  }

  const { error: profileError } = await supabase
    .from('app_users')
    .insert([{ 
      auth_id: authData.user.id, 
      username,
      is_admin: username.toLowerCase() === 'admin'
    }]);

  if (profileError) {
    showError('signup-error', profileError.message);
    return;
  }

  showSuccess('signup-error', 'Account created! Please login.');
  setTimeout(showLogin, 2000);
}

async function logout() {
  await supabase.auth.signOut();
}

async function fetchUserProfile(authId) {
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .eq('auth_id', authId)
    .single();

  if (data) {
    currentUser = data;
    isAdmin = data.is_admin;
    document.getElementById('current-username').textContent = data.username;
    document.getElementById('admin-badge').classList.toggle('hidden', !isAdmin);
    document.getElementById('admin-clear-all').classList.toggle('hidden', !isAdmin);
  }
}

// Trip functions
async function calculatePetrolCost() {
  const distance = parseFloat(document.getElementById('distance').value);
  const petrolPrice = parseFloat(document.getElementById('petrolPrice').value);
  const resultElement = document.getElementById('result');

  if (isNaN(distance) || isNaN(petrolPrice) || distance <= 0 || petrolPrice <= 0) {
    showResult('Please enter valid distance and price', true);
    return;
  }

  try {
    const { error } = await supabase
      .from('trips')
      .insert([{
        user_id: currentUser.id,
        distance,
        petrol_price: petrolPrice,
        total_cost: (distance / 11.47) * petrolPrice
      }]);

    if (error) throw error;

    showResult(`Amount Owed: R${((distance / 11.47) * petrolPrice).toFixed(2)}`, false);
    document.getElementById('distance').value = '';
    document.getElementById('petrolPrice').value = '';
    loadTrips();
  } catch (error) {
    showResult('Error saving trip. Please try again.', true);
    console.error('Error saving trip:', error);
  }
}

async function loadTrips() {
  const tripsElement = document.getElementById('trips');
  const totalElement = document.getElementById('total');
  const loadingElement = document.getElementById('loading');

  loadingElement.classList.remove('hidden');
  tripsElement.innerHTML = '';

  try {
    let query = supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('user_id', currentUser.id);
    }

    const { data: trips, error } = await query;

    if (error) throw error;

    if (!trips || trips.length === 0) {
      tripsElement.innerHTML = '<div class="history-item">No trips recorded yet</div>';
      totalElement.textContent = `Total Spent: R0`;
      return;
    }

    trips.forEach(trip => {
      const tripElement = document.createElement('div');
      tripElement.classList.add('history-item');
      tripElement.innerHTML = `
        <div>${new Date(trip.created_at).toLocaleDateString()}<br>
        ${trip.distance} km @ R${trip.petrol_price}/L</div>
        <div>R${trip.total_cost.toFixed(2)}</div>
      `;
      tripsElement.appendChild(tripElement);
    });

    totalElement.textContent = `Total Spent: R${trips.reduce((sum, trip) => sum + trip.total_cost, 0).toFixed(2)}`;
  } catch (error) {
    tripsElement.innerHTML = '<div class="history-item">Error loading trips</div>';
    console.error('Error loading trips:', error);
  } finally {
    loadingElement.classList.add('hidden');
  }
}

async function clearHistory() {
  if (!confirm('Are you sure you want to delete all your trip history?')) return;

  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('user_id', currentUser.id);

  if (error) {
    alert('Error clearing history. Please try again.');
    console.error('Error clearing history:', error);
  } else {
    loadTrips();
  }
}

async function clearAllHistory() {
  if (!isAdmin) return;
  if (!confirm('Are you sure you want to delete ALL trip history?')) return;

  const { error } = await supabase
    .from('trips')
    .delete()
    .neq('id', '');

  if (error) {
    alert('Error clearing all history. Please try again.');
    console.error('Error clearing all history:', error);
  } else {
    loadTrips();
  }
}

// UI functions
function showLogin() {
  document.getElementById('auth-container').classList.remove('hidden');
  document.getElementById('app-container').classList.add('hidden');
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('signup-form').classList.add('hidden');
  clearErrors();
}

function showSignup() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('signup-form').classList.remove('hidden');
  clearErrors();
}

function showApp() {
  document.getElementById('auth-container').classList.add('hidden');
  document.getElementById('app-container').classList.remove('hidden');
  loadTrips();
}

function showError(elementId, message) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.classList.remove('hidden');
}

function showSuccess(elementId, message) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.style.color = '#4CAF50';
  element.classList.remove('hidden');
}

function showResult(message, isError) {
  const element = document.getElementById('result');
  element.textContent = message;
  element.style.color = isError ? '#d32f2f' : '#4a6cf7';
}

function clearErrors() {
  document.querySelectorAll('.error-message').forEach(el => {
    el.textContent = '';
    el.classList.add('hidden');
    el.style.color = '#d32f2f';
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  showLogin();
});
