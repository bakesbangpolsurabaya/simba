import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  writeBatch,
  doc,
  collection,
  serverTimestamp,
  increment,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCzSLhMz3g4yDYJEQB8xe3EDv0dxDRg9-k",
  authDomain: "simba-63df0.firebaseapp.com",
  projectId: "simba-63df0",
  storageBucket: "simba-63df0.firebasestorage.app",
  messagingSenderId: "131114722418",
  appId: "1:131114722418:web:6136ef94ba6efde8e2ceeb",
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

window.prosesExcel = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet);

      if (json.length === 0) return alert("File Excel kosong!");

      const batch = writeBatch(db);

      json.forEach((row) => {
        const nama = row.Barang?.toString().toLowerCase().trim();
        const jumlah = parseInt(row.saldo);

        if (nama && !isNaN(jumlah)) {
          const barangRef = doc(db, "barang", nama);
          batch.set(
            barangRef,
            {
              nama_barang: nama,
              stock: increment(jumlah),
              update: serverTimestamp(),
            },
            { merge: true },
          );

          const transRef = doc(collection(db, "transaksi"));
          batch.set(transRef, {
            nama_barang: nama,
            qty: jumlah,
            jenis_transaksi: true,
            created_at: serverTimestamp(),
            keterangan: "Import Excel",
          });
        }
      });

      await batch.commit();
      alert(`Berhasil mengimpor ${json.length} data barang!`);
      event.target.value = ""; 
    } catch (error) {
      console.error("Gagal import:", error);
      alert("Terjadi kesalahan saat membaca file.");
    }
  };
  reader.readAsArrayBuffer(file);
};
