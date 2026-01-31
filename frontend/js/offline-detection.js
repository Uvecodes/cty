// console.log() redec;laration to avoid errors in some environments
console.log = function() {};
console.warn = function() {};
console.error = function() {};
console.info = function() {};



// Offline Detection Utility
class OfflineDetector {
  static isOnline() {
    return navigator.onLine;
  }

  static addOnlineListener(callback) {
    window.addEventListener('online', callback);
  }

  static addOfflineListener(callback) {
    window.addEventListener('offline', callback);
  }

  static removeOnlineListener(callback) {
    window.removeEventListener('online', callback);
  }

  static removeOfflineListener(callback) {
    window.removeEventListener('offline', callback);
  }
}
