# Serverless sistem za oglase (Firebase FaaS)

Brezstrežniška spletna tržnica za objavljanje in iskanje rabljenih predmetov, zgrajena s **Firebase Cloud Functions*.

---

## Ideja sistema

 Sistem za oglase je platforma, kjer registrirani uporabniki objavljajo, urejajo in brišejo oglase za rabljene predmete, kupci pa jim lahko napišejo sporočila. Sistem deluje v celoti brezstrežniško – ni nobenega trajno delujočega strežnika. Vsaka operacija (HTTP zahteva, sprememba v bazi, nalaganje datoteke, časovnik) sproži točno določeno Cloud Function, ki se zažene, opravi delo in se ustavi.

---

## Tehnologije

- **Firebase Cloud Functions v2** (FaaS)
- **Cloud Firestore** (podatkovna baza)
- **Firebase Authentication** (avtentikacija)
- **Firebase Storage** (shramba slik)
- **Cloud Pub/Sub** (sporočilna vrsta)
- **Cloud Scheduler** (časovni sprožilci)
- **Firebase Emulator Suite** (lokalni razvoj)

---

## Glavne funkcionalnosti

### 1. Avtentikacija in upravljanje uporabnikov
*Zagotavlja varno registracijo, prijavo in upravljanje profilov.*

| Funkcija | Event tip | Opis |
|---|---|---|
| `noviUporabnik` | **Auth** – `beforeUserCreated` | Ob registraciji ustvari profil v Firestore |
| `pridobiProfil` | **HTTP** GET `/pridobiProfil` | Vrne profil prijavljenega uporabnika (zahteva JWT) |
| `posodobiProfil` | **HTTP** PUT `/posodobiProfil` | Posodobi ime, telefon, lokacijo (zahteva JWT) |

### 2. Upravljanje oglasov
*Celoten CRUD za oglase – kreiranje, branje, urejanje, brisanje.*

| Funkcija | Event tip | Opis |
|---|---|---|
| `objavaOglasa` | **HTTP** POST `/objavaOglasa` | Ustvari nov oglas (zahteva JWT) |
| `pridobiOglase` | **HTTP** GET `/pridobiOglase` | Vrne vse aktivne oglase |
| `pridobiOglas` | **HTTP** GET `/pridobiOglas` | Vrne en oglas po ID-ju |
| `posodobiOglas` | **HTTP** PUT `/posodobiOglas` | Posodobi oglas – samo lastnik (zahteva JWT) |
| `izbrisiOglas` | **HTTP** DELETE `/izbrisiOglas` | Izbriše oglas – samo lastnik (zahteva JWT) |
| `statistikaObNovemOglasu` | **Firestore** `onDocumentCreated` | Ob novem oglasu poveča števec kategorije |

### 3. Sporočanje med uporabniki
*Kupci pišejo prodajalcem; sistem obvešča in shranjuje sporočila.*

| Funkcija | Event tip | Opis |
|---|---|---|
| `posljiSporocilo` | **HTTP** POST `/posljiSporocilo` | Pošlje sporočilo prodajalcu (zahteva JWT) |
| `pridobiSporocila` | **HTTP** GET `/pridobiSporocila` | Vrne vsa sporočila za oglas (zahteva JWT) |
| `obvestiloObSporocilu` | **Firestore** `onDocumentCreated` | Ob novem sporočilu ustvari obvestilo za prodajalca |
| `obdelajSporociloPubSub` | **Pub/Sub** | Procesira sporočila iz teme `nova-sporocila` |

### 4. Upravljanje slik
*Nalaganje, obdelava in čiščenje slik oglasov.*

| Funkcija | Event tip | Opis |
|---|---|---|
| `obdelavaSlikeOglasa` | **Storage** `onObjectFinalized` | Ob nalaganju slike shrani URL v oglas |
| `obrisaniOglasCistiSlike` | **Firestore** `onDocumentDeleted` | Ko se oglas izbriše, pobriše vse njegove slike |

### 5. Avtomatizacija & Analitika
*Periodično vzdrževanje in poročanje.*

| Funkcija | Event tip | Opis |
|---|---|---|
| `deaktivirajStareOglase` | **Scheduled** (vsak dan ob 00:00) | Deaktivira oglase starejše od 30 dni |
| `tedenjiPovzetek` | **Scheduled** (vsak ponedeljek ob 08:00) | Zabeleži tedensko statistiko v Firestore |

---

## Pokrite vrste dogodkov (Events)

| # | Vrsta dogodka | Primer funkcije |
|---|---|---|
| 1 | **HTTP zahteve** | `objavaOglasa`, `posljiSporocilo` |
| 2 | **Podatkovne spremembe** (Firestore) | `obvestiloObSporocilu`, `statistikaObNovemOglasu`, `obrisaniOglasCistiSlike` |
| 3 | **Shramba in datoteke** (Storage) | `obdelavaSlikeOglasa` |
| 4 | **Časovni dogodki** (Scheduled/Cron) | `deaktivirajStareOglase`, `tedenjiPovzetek` |
| 5 | **Sporočila** (Pub/Sub) | `obdelajSporociloPubSub` |
| 6 | **Uporabniški dogodki** (Auth) | `noviUporabnik` |

---

## Avtentikacija

HTTP funkcije (POST, PUT, DELETE) zahtevajo veljaven **Firebase JWT Bearer token** v glavi `Authorization`.

```
Authorization: Bearer <firebase_id_token>
```

Vsaka zaščitena funkcija pokliče pomožno funkcijo `verifyToken(req)`, ki:
1. Prebere `Authorization` glavo
2. Preveri token z `admin.auth().verifyIdToken(token)`
3. Vrne `decodedToken` z `uid` in `email` ali vrže napako `401`

---

## Struktura projekta

```
ITA_faas/
├── functions/
│   ├── index.js          # Vse Cloud Functions
│   └── package.json
├── firebase.json          # Konfiguracija Firebase in emulatorjev
├── .firebaserc            # Firebase projekt (ita-faas-3fd3b)
└── README.md
```

---

## Lokalni razvoj & Zagon

### Predpogoji
- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- Prijava: `firebase login`

### Zagon emulatorjev

```bash
cd functions
npm install

# Zagon vseh emulatorjev (functions, firestore, auth, storage, pubsub)
firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data
```

Emulator UI: http://localhost:4000  
Functions: http://localhost:5001

### Testiranje s Postmanom

Uvozi zbirko zahtev in nastavi spremenljivko `BASE_URL` na:
```
http://127.0.0.1:5001/ita-faas-3fd3b/us-central1
```