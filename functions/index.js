const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { beforeUserCreated } = require("firebase-functions/v2/identity");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// ─────────────────────────────────────────────
// 1. HTTP TRIGGER – Ustvari oglas
// POST /objavaOglasa
// Body: { naslov, opis, cena, userId }
// ─────────────────────────────────────────────
exports.objavaOglasa = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Samo POST metoda je dovoljena." });
  }

  const { naslov, opis, cena, userId } = req.body;

  if (!naslov || !opis || !cena || !userId) {
    return res.status(400).json({ error: "Manjkajo obvezna polja." });
  }

  try {
    const oglas = {
      naslov,
      opis,
      cena: Number(cena),
      userId,
      ustvarjen: admin.firestore.FieldValue.serverTimestamp(),
      aktiven: true,
    };

    const ref = await db.collection("oglasi").add(oglas);
    return res.status(201).json({ message: "Oglas uspešno objavljen.", id: ref.id });
  } catch (err) {
    return res.status(500).json({ error: "Napaka pri shranjevanju oglasa.", details: err.message });
  }
});

// ─────────────────────────────────────────────
// 2. HTTP TRIGGER – Pridobi vse aktivne oglase
// GET /pridobiOglase
// ─────────────────────────────────────────────
exports.pridobiOglase = onRequest(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Samo GET metoda je dovoljena." });
  }

  try {
    const snapshot = await db.collection("oglasi")
      .where("aktiven", "==", true)
      .orderBy("ustvarjen", "desc")
      .get();

    const oglasi = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.status(200).json(oglasi);
  } catch (err) {
    return res.status(500).json({ error: "Napaka pri pridobivanju oglasov.", details: err.message });
  }
});

// ─────────────────────────────────────────────
// 3. FIRESTORE TRIGGER – Ob novem sporočilu obvesti prodajalca
// Sproži se, ko se doda dokument v kolekcijo "sporocila"
// ─────────────────────────────────────────────
exports.obvestiloObSporocilu = onDocumentCreated("sporocila/{sporoциloId}", async (event) => {
  const sporocilo = event.data.data();
  const { oglasId, posiljatelj, vsebina } = sporocilo;

  try {
    // Pridobi oglas, da dobimo userId prodajalca
    const oglasDoc = await db.collection("oglasi").doc(oglasId).get();
    if (!oglasDoc.exists) return;

    const prodajalecId = oglasDoc.data().userId;

    // Shrani obvestilo za prodajalca
    await db.collection("obvestila").add({
      userId: prodajalecId,
      tip: "novo_sporocilo",
      vsebina: `Novo sporočilo od ${posiljatelj}: "${vsebina}"`,
      oglasId,
      prebrano: false,
      ustvarjeno: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Obvestilo poslano prodajalcu ${prodajalecId}`);
  } catch (err) {
    console.error("Napaka pri pošiljanju obvestila:", err);
  }
});

// ─────────────────────────────────────────────
// 4. STORAGE TRIGGER – Ob nalaganju slike oglasa
// Sproži se, ko se naloži datoteka v Storage
// ─────────────────────────────────────────────
exports.obdelavaSlikeOglasa = onObjectFinalized(async (event) => {
  const filePath = event.data.name;         // npr. "oglasi/abc123/slika.jpg"
  const contentType = event.data.contentType;

  // Obdelaj samo slike v mapi "oglasi/"
  if (!filePath.startsWith("oglasi/") || !contentType.startsWith("image/")) {
    console.log("Ni slika oglasa, preskočim.");
    return;
  }

  // Izvlečemo oglasId iz poti (npr. "oglasi/abc123/slika.jpg" -> "abc123")
  const parts = filePath.split("/");
  const oglasId = parts[1];

  try {
    const fileUrl = `https://storage.googleapis.com/${event.data.bucket}/${filePath}`;

    // Shrani URL slike v Firestore dokument oglasa
    await db.collection("oglasi").doc(oglasId).update({
      slikaUrl: fileUrl,
      slikaNaložena: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Slika za oglas ${oglasId} uspešno shranjena: ${fileUrl}`);
  } catch (err) {
    console.error("Napaka pri obdelavi slike:", err);
  }
});

// ─────────────────────────────────────────────
// 5. SCHEDULED TRIGGER – Vsak dan ob polnoči deaktiviraj stare oglase (30+ dni)
// ─────────────────────────────────────────────
exports.deaktivirajStareOglase = onSchedule("0 0 * * *", async () => {
  const mejaDate = new Date();
  mejaDate.setDate(mejaDate.getDate() - 30);
  const mejaTstamp = admin.firestore.Timestamp.fromDate(mejaDate);

  try {
    const snapshot = await db.collection("oglasi")
      .where("aktiven", "==", true)
      .where("ustvarjen", "<", mejaTstamp)
      .get();

    if (snapshot.empty) {
      console.log("Ni starih oglasov za deaktivacijo.");
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { aktiven: false });
    });

    await batch.commit();
    console.log(`Deaktiviranih ${snapshot.size} starih oglasov.`);
  } catch (err) {
    console.error("Napaka pri deaktivaciji oglasov:", err);
  }
});

// ─────────────────────────────────────────────
// 6. AUTH TRIGGER – Ob registraciji novega uporabnika
// Sproži se, ko se ustvari nov Firebase Auth uporabnik
// ─────────────────────────────────────────────
exports.noviUporabnik = beforeUserCreated(async (event) => {
  const user = event.data;

  try {
    // Shrani profil novega uporabnika v Firestore
    await db.collection("uporabniki").doc(user.uid).set({
      email: user.email,
      ime: user.displayName || "Neznan uporabnik",
      ustvarjen: admin.firestore.FieldValue.serverTimestamp(),
      aktiven: true,
    });

    console.log(`Nov uporabnik registriran: ${user.email}`);
  } catch (err) {
    console.error("Napaka pri registraciji uporabnika:", err);
  }
});