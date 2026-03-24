(function () {
  // Only show the splash once per session
  if (sessionStorage.getItem('splashShown')) {
    var splash = document.getElementById('splash-screen');
    if (splash) splash.style.display = 'none';
    return;
  }

  var splash = document.getElementById('splash-screen');
  var video = document.getElementById('splash-video');

  if (!splash || !video) return;

  // Prevent scrolling while splash is visible
  document.body.style.overflow = 'hidden';

  function dismiss() {
    splash.classList.add('splash-fade-out');
    sessionStorage.setItem('splashShown', '1');
    setTimeout(function () {
      splash.style.display = 'none';
      document.body.style.overflow = '';
    }, 600);
  }

  // Dismiss when video ends
  video.addEventListener('ended', dismiss);

  // Safety fallback — dismiss after 6s if video stalls or won't play
  var fallback = setTimeout(dismiss, 6000);

  // If video plays successfully, clear the fallback timer
  video.addEventListener('playing', function () {
    clearTimeout(fallback);
    // Set new fallback based on video duration once known
    video.addEventListener('durationchange', function () {
      if (video.duration && video.duration < 10) {
        fallback = setTimeout(dismiss, (video.duration * 1000) + 500);
      }
    });
  });

  // If video fails entirely, dismiss immediately
  video.addEventListener('error', dismiss);
})();
