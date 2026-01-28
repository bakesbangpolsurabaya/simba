import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  collection,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  addDoc,
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
const auth = getAuth(app);

// --- 1. PROTEKSI HALAMAN & ROLE ---
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const rawRole = userSnap.data().role;
      const role = rawRole.toLowerCase().replace(/\s+/g, "_");

      console.log("Role asli di DB:", rawRole);
      console.log("Role setelah diproses:", role);

      document.getElementById("panel-superadmin").style.display = "none";
      document.getElementById("panel-bidang").style.display = "none";

      if (role === "superadmin") {
        document.getElementById("panel-superadmin").style.display = "block";
        document.getElementById("status-role").innerText = "Role: SUPER ADMIN";
      } else if (role === "admin_bidang") {
        document.getElementById("panel-bidang").style.display = "block";
        document.getElementById("status-role").innerText = "Role: ADMIN BIDANG";
      } else {
        document.getElementById("status-role").innerText =
          "Role Tidak Dikenali: " + rawRole;
      }
    } else {
      console.error("UID tidak ditemukan di koleksi users:", user.uid);
      alert("User belum terdaftar di Firestore!");
    }
  }
});

// --- 2. FITUR SUPER ADMIN: UPDATE STOK ---
window.updateStok = async () => {
  const nama = document.getElementById("itemName").value.toLowerCase();
  const qty = parseInt(document.getElementById("itemQty").value);
  if (!nama || isNaN(qty)) return;

  try {
    // A. Update/Tambah Stok Utama di koleksi 'barang'
    const barangRef = doc(db, "barang", nama);
    await setDoc(
      barangRef,
      {
        nama_barang: nama,
        stock: increment(qty),
        update: serverTimestamp(),
      },
      { merge: true },
    );

    // B. Catat Riwayat ke koleksi 'transaksi' (Sesuai image_ea78d3.png)
    await addDoc(collection(db, "transaksi"), {
      nama_barang: nama,
      qty: qty,
      jenis_transaksi: true, // Anda bisa gunakan string atau boolean true
      created_at: serverTimestamp(),
    });

    alert("Stok diperbarui dan riwayat transaksi dicatat!");
    document.getElementById("itemName").value = "";
    document.getElementById("itemQty").value = "";

  } catch (error) {
    console.error("Error transaksi:", error);
    alert("Gagal: " + error.message);
  }
};

// --- 3. FITUR BIDANG: REQUEST BARANG ---
window.kirimRequest = async () => {

    const user = auth.currentUser;
    if (!user) return alert("Sesi berakhir, silakan login kembali.");

    try {
      // 2. Ambil data bidang langsung dari koleksi 'users' berdasarkan UID
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const dataUser = userSnap.data();
        const namaBidang = dataUser.nama_bidang; // Pastikan field 'nama_bidang' ada di Firestore

        // 3. Ambil nilai dari input form
        const namaBarang = document.getElementById("reqName").value.toLowerCase();
        const qty = parseInt(document.getElementById("reqQty").value);

        // Validasi input
        if (!namaBarang || isNaN(qty) || qty <= 0) {
          return alert("Mohon isi nama barang dan jumlah dengan benar.");
        }

        // 4. Kirim data ke koleksi 'permintaan'
        await addDoc(collection(db, "permintaan"), {
          nama_barang: namaBarang,
          jumlah: qty,
          bidang: namaBidang, // Menggunakan data otomatis dari profil user
          status: "pending",
          timestamp: serverTimestamp(),
        });

        alert(`Permintaan dari ${namaBidang} berhasil dikirim!`);
        document.getElementById("reqName").value = "";
        document.getElementById("reqQty").value = "";
      } else {
        alert("Data profil bidang tidak ditemukan di database.");
      }
    } catch (error) {
      console.error("Gagal mengirim request:", error);
      alert("Terjadi kesalahan sistem.");
    }
};

// --- 4. FITUR SUPER ADMIN: APPROVE, EDIT, REJECT ---
onSnapshot(collection(db, "permintaan"), (snapshot) => {
  const table = document.getElementById("list-permintaan");
  table.innerHTML = "";

  // 1. Cek jika snapshot kosong
  if (snapshot.empty) {
    table.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 20px; color: #888;">
                    Tidak ada permintaan barang saat ini.
                </td>
            </tr>`;
    return; // Berhenti di sini, jangan lanjut ke forEach
  }

  // 2. Jika ada data, baru jalankan loop forEach
  snapshot.forEach((d) => {
    const r = d.data();
    table.innerHTML += `
            <tr>
                <td style="text-transform: capitalize;">${r.nama_barang}</td>
                <td>${r.bidang}</td>
                <td><input type="number" id="edit-${d.id}" value="${r.jumlah}" style="width:60px"></td>
                <td>
                    <button onclick="approve('${d.id}', '${r.nama_barang}')" style="background:green; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">ACC</button>
                    <button onclick="reject('${d.id}')" style="background:red; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Tolak</button>
                </td>
            </tr>`;
  });
});

window.approve = async (id, namaBarang) => {
  // 1. Ambil nilai Qty dari input (hasil edit Super Admin di tabel)
  const newQty = parseInt(document.getElementById(`edit-${id}`).value);

  try {
    // 2. Ambil data asli dari koleksi 'permintaan' untuk mendapatkan nama bidang
    const reqRef = doc(db, "permintaan", id);
    const reqSnap = await getDoc(reqRef);

    if (!reqSnap.exists()) return alert("Data permintaan tidak ditemukan!");
    const dataPermintaan = reqSnap.data();

    // 3. Cek stok di koleksi 'barang'
    const barangRef = doc(db, "barang", namaBarang);
    const barangSnap = await getDoc(barangRef);

    if (barangSnap.exists() && barangSnap.data().stock >= newQty) {
      // A. UPDATE STOK: Kurangi stok utama
      await updateDoc(barangRef, {
        stock: increment(-newQty),
        update: serverTimestamp(),
      });

      // B. SIMPAN KE TRANSAKSI: Catat riwayat keluar
      await addDoc(collection(db, "transaksi"), {
        nama_barang: namaBarang, // Diambil dari parameter
        qty: newQty, // Diambil dari input edit
        jenis_transaksi: false, // Penanda barang keluar
        bidang: dataPermintaan.bidang, // Diambil otomatis dari data user request
        created_at: serverTimestamp(), // Waktu server
      });

      // C. HAPUS REQUEST: Bersihkan antrian permintaan
      await deleteDoc(reqRef);

      alert(
        "Berhasil di-ACC! Stok berkurang dan riwayat transaksi telah dicatat.",
      );
    } else {
      alert("Gagal: Stok gudang tidak mencukupi!");
    }
  } catch (error) {
    console.error("Error saat approve:", error);
    alert("Terjadi kesalahan koneksi.");
  }
};

window.reject = async (id) => {
  await deleteDoc(doc(db, "permintaan", id));
};

// --- 5. RENDER STOK REALTIME ---
onSnapshot(collection(db, "barang"), (snapshot) => {
  const table = document.getElementById("list-stok");
  table.innerHTML = "";
  snapshot.forEach((d) => {
    const b = d.data();
    table.innerHTML += 
    `<tr>
        <td>${b.nama_barang}</td>
        <td>${b.stock}</td>
        <td>${b.update?.toDate().toLocaleString() || "..."}</td>
    </tr>`;
  });
});

window.logout = () => signOut(auth);
