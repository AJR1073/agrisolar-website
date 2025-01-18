// Fetch Firebase config from environment
async function getFirebaseConfig() {
  try {
    const response = await fetch('/__/firebase/init.json');
    return response.json();
  } catch (e) {
    console.error('Error loading Firebase config:', e);
    return null;
  }
}

// Initialize Firebase with config
getFirebaseConfig().then(config => {
  if (config) {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
  }
});
