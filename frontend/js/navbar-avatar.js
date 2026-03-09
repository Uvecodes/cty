// navbar-avatar.js — loads the user's profile photo from Firestore and sets #profileAvatar.
// If no photo is set, the element's default src (placeholder) is left unchanged.

(function () {
  function loadNavbarAvatar() {
    if (typeof firebase === 'undefined' || !firebase.auth) return;
    firebase.auth().onAuthStateChanged(async function (user) {
      if (!user) return;
      try {
        const doc = await firebase.firestore().collection('users').doc(user.uid).get();
        if (doc.exists && doc.data().avatarUrl) {
          const img = document.getElementById('profileAvatar');
          if (img) img.src = doc.data().avatarUrl;
        }
      } catch (_e) {}
    });
  }

  if (window.firebaseReady) {
    window.firebaseReady.then(loadNavbarAvatar);
  } else {
    window.addEventListener('firebase-ready', loadNavbarAvatar, { once: true });
  }
})();
