// Firebase bağlantı ayarları. Bu dosya yalnız yapılandırma ve bağlantı başlangıcını içerir.
const firebaseConfig = {
  apiKey: "AIzaSyBIey2A-LIZxq3pI2L1HAPUKM1Y46gERwg",
  authDomain: "icao-cap-takip.firebaseapp.com",
  databaseURL: "https://icao-cap-takip-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "icao-cap-takip",
  storageBucket: "icao-cap-takip.firebasestorage.app",
  messagingSenderId: "501420214187",
  appId: "1:501420214187:web:068e444ebd20c060a274ee"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const storage = (firebase.storage ? firebase.storage() : null);
