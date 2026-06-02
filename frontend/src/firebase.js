import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions'
import { getStorage, connectStorageEmulator, ref, uploadBytes, getDownloadURL } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "fake-api-key",
  authDomain: "ita-faas-3fd3b.firebaseapp.com",
  projectId: "ita-faas-3fd3b",
  storageBucket: "ita-faas-3fd3b.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:000000000000"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const functions = getFunctions(app, 'us-central1')
export const storage = getStorage(app)

// Poveži z lokalnimi emulatorji
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
connectFunctionsEmulator(functions, '127.0.0.1', 5001)
connectStorageEmulator(storage, '127.0.0.1', 9199)

// Base URL za onRequest funkcije
export const BASE_URL = 'http://127.0.0.1:5001/ita-faas-3fd3b/us-central1'

// Pomožna funkcija za onCall klice
export const call = (name) => httpsCallable(functions, name)

// Naloži sliko v Storage in vrne download URL
export async function naloziSliko(oglasId, file) {
  const slikaRef = ref(storage, `oglasi/${oglasId}/${file.name}`)
  await uploadBytes(slikaRef, file)
  return getDownloadURL(slikaRef)
}

// Formatira Firestore timestamp v slovensko obliko datuma
export function formatDate(ts) {
  if (!ts) return ''
  const seconds = ts._seconds ?? ts.seconds
  if (!seconds) return ''
  return new Date(seconds * 1000).toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
