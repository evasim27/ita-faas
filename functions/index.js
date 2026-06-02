const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { beforeUserCreated } = require("firebase-functions/v2/identity");
const admin = require("firebase-admin");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

admin.initializeApp({
  storageBucket: "ita-faas-3fd3b.appspot.com",
});
const db = getFirestore();
const BUCKET = "ita-faas-3fd3b.appspot.com";

// ─────────────────────────────────────────────
// POMOŽNA FUNKCIJA – Preveri JWT token
// ─────────────────────────────────────────────
async function verifyToken(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    throw Object.assign(new Error("Manjka Authorization header."), { code: 401 });
  }
  const token = authHeader.split("Bearer ")[1];
  return admin.auth().verifyIdToken(token);
}

// ═════════════════════════════════════════════
// FUNKCIONALNOST 1: AVTENTIKACIJA & PROFILI
// Event tipi: Auth (beforeUserCreated), HTTP
// ═════════════════════════════════════════════

// 1a. AUTH TRIGGER – Ob registraciji ustvari profil
exports.noviUporabnik = beforeUserCreated(async (event) => {
  const user = event.data;
  try {
    await db.collection("uporabniki").doc(user.uid).set({
      email: user.email || "",
      ime: user.displayName || "Neznan uporabnik",
      telefon: "",
      lokacija: "",
      ustvarjen: FieldValue.serverTimestamp(),
      aktiven: true,
    });
    console.log(`Nov uporabnik registriran: ${user.email}`);
  } catch (err) {
    // Logiramo napako, a ne blokiramo registracije
    console.error("Napaka pri ustvarjanju profila:", err.message);
  }
});

// 1b. CALLABLE – Pridobi profil prijavljenega uporabnika (ustvari ga če ne obstaja)
exports.pridobiProfil = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Uporabnik ni prijavljen.");

  const docRef = db.collection("uporabniki").doc(request.auth.uid);
  let doc = await docRef.get();

  if (!doc.exists) {
    await docRef.set({
      email: request.auth.token.email || "",
      ime: request.auth.token.name || "Neznan uporabnik",
      telefon: "",
      lokacija: "",
      ustvarjen: FieldValue.serverTimestamp(),
      aktiven: true,
    });
    doc = await docRef.get();
  }

  return { uid: request.auth.uid, ...doc.data() };
});

// 1c. CALLABLE – Posodobi profil (ime, priimek, telefon, lokacija)
exports.posodobiProfil = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Uporabnik ni prijavljen.");

  const { ime, priimek, telefon, lokacija } = request.data;
  const posodobitve = {};
  if (ime !== undefined) posodobitve.ime = ime;
  if (priimek !== undefined) posodobitve.priimek = priimek;
  if (telefon !== undefined) posodobitve.telefon = telefon;
  if (lokacija !== undefined) posodobitve.lokacija = lokacija;

  if (Object.keys(posodobitve).length === 0) {
    throw new HttpsError("invalid-argument", "Ni polj za posodobitev.");
  }

  // set z merge:true deluje tudi če dokument še ne obstaja
  await db.collection("uporabniki").doc(request.auth.uid).set(posodobitve, { merge: true });
  return { message: "Profil posodobljen." };
});

// ═════════════════════════════════════════════
// FUNKCIONALNOST 2: UPRAVLJANJE OGLASOV
// Event tipi: HTTP, Firestore (onDocumentCreated)
// ═════════════════════════════════════════════

// 2a. CALLABLE – Ustvari oglas
exports.objavaOglasa = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Uporabnik ni prijavljen.");

  const { naslov, opis, cena, kategorija } = request.data;
  if (!naslov || !opis || !cena || !kategorija) {
    throw new HttpsError("invalid-argument", "Polja naslov, opis, cena in kategorija so obvezna.");
  }

  const ref = await db.collection("oglasi").add({
    naslov,
    opis,
    cena: Number(cena),
    kategorija,
    userId: request.auth.uid,
    ustvarjen: FieldValue.serverTimestamp(),
    aktiven: true,
    slikaUrl: null,
  });
  return { message: "Oglas objavljen.", id: ref.id };
});

// 2b. HTTP GET – Pridobi vse aktivne oglase
exports.pridobiOglase = onRequest(async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Samo GET." });

  try {
    const snapshot = await db.collection("oglasi")
      .where("aktiven", "==", true)
      .orderBy("ustvarjen", "desc")
      .get();
    const oglasi = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.status(200).json(oglasi);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 2c. HTTP GET – Pridobi en oglas po ID-ju
exports.pridobiOglas = onRequest(async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Samo GET." });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Parameter id je obvezen." });

  try {
    const doc = await db.collection("oglasi").doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: "Oglas ne obstaja." });
    return res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 2d. CALLABLE – Posodobi oglas (samo lastnik)
exports.posodobiOglas = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Uporabnik ni prijavljen.");

  const { id, naslov, opis, cena } = request.data;
  if (!id) throw new HttpsError("invalid-argument", "Parameter id je obvezen.");

  const doc = await db.collection("oglasi").doc(id).get();
  if (!doc.exists) throw new HttpsError("not-found", "Oglas ne obstaja.");
  if (doc.data().userId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Nimate pravice urejati tega oglasa.");
  }

  const posodobitve = {};
  if (naslov) posodobitve.naslov = naslov;
  if (opis) posodobitve.opis = opis;
  if (cena) posodobitve.cena = Number(cena);

  await db.collection("oglasi").doc(id).update(posodobitve);
  return { message: "Oglas posodobljen." };
});

// 2e. CALLABLE – Izbriši oglas (samo lastnik)
exports.izbrisiOglas = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Uporabnik ni prijavljen.");

  const { id } = request.data;
  if (!id) throw new HttpsError("invalid-argument", "Parameter id je obvezen.");

  const doc = await db.collection("oglasi").doc(id).get();
  if (!doc.exists) throw new HttpsError("not-found", "Oglas ne obstaja.");
  if (doc.data().userId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Nimate pravice brisati tega oglasa.");
  }

  await db.collection("oglasi").doc(id).delete();
  return { message: "Oglas izbrisan." };
});

// 2f. FIRESTORE TRIGGER – Ob novem oglasu posodobi statistiko kategorije
exports.statistikaObNovemOglasu = onDocumentCreated("oglasi/{oglasId}", async (event) => {
  const oglas = event.data.data();
  const kategorija = oglas.kategorija || "ostalo";

  try {
    const statRef = db.collection("statistika").doc(kategorija);
    await statRef.set(
      { steviloOglasov: FieldValue.increment(1) },
      { merge: true }
    );
    console.log(`Statistika posodobljena za kategorijo: ${kategorija}`);
  } catch (err) {
    console.error("Napaka pri statistiki:", err);
  }
});

// ═════════════════════════════════════════════
// FUNKCIONALNOST 3: SPOROČANJE
// Event tipi: HTTP, Firestore (onDocumentCreated), Pub/Sub
// ═════════════════════════════════════════════

// 3a. CALLABLE – Pošlji sporočilo prodajalcu
exports.posljiSporocilo = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Uporabnik ni prijavljen.");

  const { oglasId, vsebina } = request.data;
  if (!oglasId || !vsebina) {
    throw new HttpsError("invalid-argument", "Polja oglasId in vsebina sta obvezni.");
  }

  const oglasDoc = await db.collection("oglasi").doc(oglasId).get();
  if (!oglasDoc.exists) throw new HttpsError("not-found", "Oglas ne obstaja.");
  if (oglasDoc.data().userId === request.auth.uid) {
    throw new HttpsError("invalid-argument", "Ne morete pisati sami sebi.");
  }

  const ref = await db.collection("sporocila").add({
    oglasId,
    posiljatelj: request.auth.uid,
    posiljateljEmail: request.auth.token.email,
    vsebina,
    poslano: FieldValue.serverTimestamp(),
  });
  return { message: "Sporočilo poslano.", id: ref.id };
});

// 3b. CALLABLE – Pridobi sporočila za oglas (samo lastnik)
exports.pridobiSporocila = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Uporabnik ni prijavljen.");

  const { oglasId } = request.data;
  if (!oglasId) throw new HttpsError("invalid-argument", "Parameter oglasId je obvezen.");

  const oglasDoc = await db.collection("oglasi").doc(oglasId).get();
  if (!oglasDoc.exists) throw new HttpsError("not-found", "Oglas ne obstaja.");
  if (oglasDoc.data().userId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Dostop zavrnjen.");
  }

  const snapshot = await db.collection("sporocila")
    .where("oglasId", "==", oglasId)
    .orderBy("poslano", "asc")
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
});

// 3c. FIRESTORE TRIGGER – Ob novem sporočilu ustvari obvestilo za prodajalca
exports.obvestiloObSporocilu = onDocumentCreated("sporocila/{sporociloId}", async (event) => {
  const sporocilo = event.data.data();
  const { oglasId, posiljateljeEmail, vsebina } = sporocilo;

  try {
    const oglasDoc = await db.collection("oglasi").doc(oglasId).get();
    if (!oglasDoc.exists) return;

    await db.collection("obvestila").add({
      userId: oglasDoc.data().userId,
      tip: "novo_sporocilo",
      vsebina: `Novo sporočilo od ${sporocilo.posiljateljEmail}: "${vsebina}"`,
      oglasId,
      prebrano: false,
      ustvarjeno: FieldValue.serverTimestamp(),
    });
    console.log(`Obvestilo ustvarjeno za oglas ${oglasId}`);
  } catch (err) {
    console.error("Napaka pri obvestilu:", err);
  }
});

// 3d. PUB/SUB TRIGGER – Procesira sporočila iz teme "nova-sporocila"
exports.obdelajSporociloPubSub = onMessagePublished("nova-sporocila", async (event) => {
  const data = event.data.message.json;

  try {
    await db.collection("pubsub_log").add({
      vir: "nova-sporocila",
      podatki: data,
      prejeto: FieldValue.serverTimestamp(),
    });
    console.log("Pub/Sub sporočilo zabeleženo:", data);
  } catch (err) {
    console.error("Napaka pri Pub/Sub:", err);
  }
});

// ═════════════════════════════════════════════
// FUNKCIONALNOST 4: UPRAVLJANJE SLIK
// Event tipi: Storage (onObjectFinalized), Firestore (onDocumentDeleted)
// ═════════════════════════════════════════════

// 4a. STORAGE TRIGGER – Ob nalaganju slike shrani URL v oglas
exports.obdelavaSlikeOglasa = onObjectFinalized({ bucket: BUCKET }, async (event) => {
  const filePath = event.data.name;
  const contentType = event.data.contentType;

  if (!filePath.startsWith("oglasi/") || !contentType.startsWith("image/")) {
    console.log("Ni slika oglasa, preskočim.");
    return;
  }

  const parts = filePath.split("/");
  const oglasId = parts[1];

  try {
    const fileUrl = `https://storage.googleapis.com/${event.data.bucket}/${filePath}`;
    await db.collection("oglasi").doc(oglasId).update({
      slikaUrl: fileUrl,
      slikaNalozena: FieldValue.serverTimestamp(),
    });
    console.log(`Slika za oglas ${oglasId} shranjena: ${fileUrl}`);
  } catch (err) {
    console.error("Napaka pri obdelavi slike:", err);
  }
});

// 4b. FIRESTORE TRIGGER – Ko se oglas izbriše, pobriše vse njegove slike
exports.obrisaniOglasCistiSlike = onDocumentDeleted("oglasi/{oglasId}", async (event) => {
  const oglasId = event.params.oglasId;
  const bucket = admin.storage().bucket(BUCKET);

  try {
    const [files] = await bucket.getFiles({ prefix: `oglasi/${oglasId}/` });
    if (files.length === 0) {
      console.log(`Ni slik za oglas ${oglasId}.`);
      return;
    }

    await Promise.all(files.map(file => file.delete()));
    console.log(`Pobrisanih ${files.length} slik za oglas ${oglasId}.`);
  } catch (err) {
    console.error("Napaka pri brisanju slik:", err);
  }
});

// ═════════════════════════════════════════════
// FUNKCIONALNOST 5: AVTOMATIZACIJA & ANALITIKA
// Event tipi: Scheduled (2x cron)
// ═════════════════════════════════════════════

// 5a. SCHEDULED – Vsak dan ob 00:00 deaktiviraj oglase starejše od 30 dni
exports.deaktivirajStareOglase = onSchedule("0 0 * * *", async () => {
  const meja = new Date();
  meja.setDate(meja.getDate() - 30);
  const mejaTstamp = Timestamp.fromDate(meja);

  try {
    const snapshot = await db.collection("oglasi")
      .where("aktiven", "==", true)
      .where("ustvarjen", "<", mejaTstamp)
      .get();

    if (snapshot.empty) {
      console.log("Ni starih oglasov.");
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.update(doc.ref, { aktiven: false }));
    await batch.commit();
    console.log(`Deaktiviranih ${snapshot.size} oglasov.`);
  } catch (err) {
    console.error("Napaka pri deaktivaciji:", err);
  }
});

// 5b. SCHEDULED – Vsak ponedeljek ob 08:00 shrani tedensko statistiko
exports.tedenjiPovzetek = onSchedule("0 8 * * 1", async () => {
  try {
    const snapshot = await db.collection("oglasi")
      .where("aktiven", "==", true)
      .get();

    const sporocilaSnap = await db.collection("sporocila").get();

    await db.collection("statistika").doc("tedenski_povzetek").set({
      aktivniOglasi: snapshot.size,
      skupajSporocil: sporocilaSnap.size,
      datum: FieldValue.serverTimestamp(),
    });

    console.log(`Tedenski povzetek shranjen: ${snapshot.size} aktivnih oglasov.`);
  } catch (err) {
    console.error("Napaka pri tedenskem povzetku:", err);
  }
});
