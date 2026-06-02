const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { beforeUserCreated } = require("firebase-functions/v2/identity");
const admin = require("firebase-admin");

admin.initializeApp({
  storageBucket: "ita-faas-3fd3b.appspot.com",
});
const db = admin.firestore();
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
  await db.collection("uporabniki").doc(user.uid).set({
    email: user.email,
    ime: user.displayName || "Neznan uporabnik",
    telefon: "",
    lokacija: "",
    ustvarjen: admin.firestore.FieldValue.serverTimestamp(),
    aktiven: true,
  });
  console.log(`Nov uporabnik registriran: ${user.email}`);
});

// 1b. HTTP GET – Pridobi profil prijavljenega uporabnika
exports.pridobiProfil = onRequest(async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Samo GET." });

  let decoded;
  try { decoded = await verifyToken(req); }
  catch (e) { return res.status(401).json({ error: e.message }); }

  try {
    const doc = await db.collection("uporabniki").doc(decoded.uid).get();
    if (!doc.exists) return res.status(404).json({ error: "Profil ne obstaja." });
    return res.status(200).json({ uid: decoded.uid, ...doc.data() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 1c. HTTP PUT – Posodobi profil (ime, telefon, lokacija)
exports.posodobiProfil = onRequest(async (req, res) => {
  if (req.method !== "PUT") return res.status(405).json({ error: "Samo PUT." });

  let decoded;
  try { decoded = await verifyToken(req); }
  catch (e) { return res.status(401).json({ error: e.message }); }

  const { ime, telefon, lokacija } = req.body;
  const posodobitve = {};
  if (ime) posodobitve.ime = ime;
  if (telefon) posodobitve.telefon = telefon;
  if (lokacija) posodobitve.lokacija = lokacija;

  if (Object.keys(posodobitve).length === 0) {
    return res.status(400).json({ error: "Ni polj za posodobitev." });
  }

  try {
    await db.collection("uporabniki").doc(decoded.uid).update(posodobitve);
    return res.status(200).json({ message: "Profil posodobljen." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ═════════════════════════════════════════════
// FUNKCIONALNOST 2: UPRAVLJANJE OGLASOV
// Event tipi: HTTP, Firestore (onDocumentCreated)
// ═════════════════════════════════════════════

// 2a. HTTP POST – Ustvari oglas (zahteva JWT)
exports.objavaOglasa = onRequest(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Samo POST." });

  let decoded;
  try { decoded = await verifyToken(req); }
  catch (e) { return res.status(401).json({ error: e.message }); }

  const { naslov, opis, cena, kategorija } = req.body;
  if (!naslov || !opis || !cena || !kategorija) {
    return res.status(400).json({ error: "Polja naslov, opis, cena in kategorija so obvezna." });
  }

  try {
    const ref = await db.collection("oglasi").add({
      naslov,
      opis,
      cena: Number(cena),
      kategorija,
      userId: decoded.uid,
      ustvarjen: admin.firestore.FieldValue.serverTimestamp(),
      aktiven: true,
      slikaUrl: null,
    });
    return res.status(201).json({ message: "Oglas objavljen.", id: ref.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
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

// 2d. HTTP PUT – Posodobi oglas (samo lastnik)
exports.posodobiOglas = onRequest(async (req, res) => {
  if (req.method !== "PUT") return res.status(405).json({ error: "Samo PUT." });

  let decoded;
  try { decoded = await verifyToken(req); }
  catch (e) { return res.status(401).json({ error: e.message }); }

  const { id, naslov, opis, cena } = req.body;
  if (!id) return res.status(400).json({ error: "Parameter id je obvezen." });

  try {
    const doc = await db.collection("oglasi").doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: "Oglas ne obstaja." });
    if (doc.data().userId !== decoded.uid) {
      return res.status(403).json({ error: "Nimate pravice urejati tega oglasa." });
    }

    const posodobitve = {};
    if (naslov) posodobitve.naslov = naslov;
    if (opis) posodobitve.opis = opis;
    if (cena) posodobitve.cena = Number(cena);

    await db.collection("oglasi").doc(id).update(posodobitve);
    return res.status(200).json({ message: "Oglas posodobljen." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 2e. HTTP DELETE – Izbriši oglas (samo lastnik)
exports.izbrisiOglas = onRequest(async (req, res) => {
  if (req.method !== "DELETE") return res.status(405).json({ error: "Samo DELETE." });

  let decoded;
  try { decoded = await verifyToken(req); }
  catch (e) { return res.status(401).json({ error: e.message }); }

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Parameter id je obvezen." });

  try {
    const doc = await db.collection("oglasi").doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: "Oglas ne obstaja." });
    if (doc.data().userId !== decoded.uid) {
      return res.status(403).json({ error: "Nimate pravice brisati tega oglasa." });
    }

    await db.collection("oglasi").doc(id).delete();
    return res.status(200).json({ message: "Oglas izbrisan." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 2f. FIRESTORE TRIGGER – Ob novem oglasu posodobi statistiko kategorije
exports.statistikaObNovemOglasu = onDocumentCreated("oglasi/{oglasId}", async (event) => {
  const oglas = event.data.data();
  const kategorija = oglas.kategorija || "ostalo";

  try {
    const statRef = db.collection("statistika").doc(kategorija);
    await statRef.set(
      { steviloOglasov: admin.firestore.FieldValue.increment(1) },
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

// 3a. HTTP POST – Pošlji sporočilo prodajalcu (zahteva JWT)
exports.posljiSporocilo = onRequest(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Samo POST." });

  let decoded;
  try { decoded = await verifyToken(req); }
  catch (e) { return res.status(401).json({ error: e.message }); }

  const { oglasId, vsebina } = req.body;
  if (!oglasId || !vsebina) {
    return res.status(400).json({ error: "Polja oglasId in vsebina sta obvezni." });
  }

  try {
    const oglasDoc = await db.collection("oglasi").doc(oglasId).get();
    if (!oglasDoc.exists) return res.status(404).json({ error: "Oglas ne obstaja." });
    if (oglasDoc.data().userId === decoded.uid) {
      return res.status(400).json({ error: "Ne morete pisati sami sebi." });
    }

    const ref = await db.collection("sporocila").add({
      oglasId,
      posiljatelj: decoded.uid,
      posiljateljEmail: decoded.email,
      vsebina,
      poslano: admin.firestore.FieldValue.serverTimestamp(),
    });
    return res.status(201).json({ message: "Sporočilo poslano.", id: ref.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 3b. HTTP GET – Pridobi sporočila za oglas (samo lastnik)
exports.pridobiSporocila = onRequest(async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Samo GET." });

  let decoded;
  try { decoded = await verifyToken(req); }
  catch (e) { return res.status(401).json({ error: e.message }); }

  const { oglasId } = req.query;
  if (!oglasId) return res.status(400).json({ error: "Parameter oglasId je obvezen." });

  try {
    const oglasDoc = await db.collection("oglasi").doc(oglasId).get();
    if (!oglasDoc.exists) return res.status(404).json({ error: "Oglas ne obstaja." });
    if (oglasDoc.data().userId !== decoded.uid) {
      return res.status(403).json({ error: "Dostop zavrnjen." });
    }

    const snapshot = await db.collection("sporocila")
      .where("oglasId", "==", oglasId)
      .orderBy("poslano", "asc")
      .get();

    const sporocila = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.status(200).json(sporocila);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
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
      ustvarjeno: admin.firestore.FieldValue.serverTimestamp(),
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
      prejeto: admin.firestore.FieldValue.serverTimestamp(),
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
      slikaNalozena: admin.firestore.FieldValue.serverTimestamp(),
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
  const mejaTstamp = admin.firestore.Timestamp.fromDate(meja);

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
      datum: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Tedenski povzetek shranjen: ${snapshot.size} aktivnih oglasov.`);
  } catch (err) {
    console.error("Napaka pri tedenskem povzetku:", err);
  }
});
