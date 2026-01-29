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
  query,
  where,
  orderBy
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

let unsubscribeTransaksi = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    if (unsubscribeTransaksi) unsubscribeTransaksi();
    window.location.href = "login.html";
  } else {
    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const rawRole = userData.role;
        const role = rawRole.toLowerCase().replace(/\s+/g, "_");
        const namaBidangUser = userData.nama_bidang; 

        document.getElementById("panel-superadmin").style.display = "none";
        document.getElementById("panel-bidang").style.display = "none";
        document.getElementById("btn-import-excel").style.display = "none";

        if (role === "superadmin") {
          document.getElementById("panel-superadmin").style.display = "block";
          document.getElementById("btn-import-excel").style.display = "block";
          document.getElementById("status-role").innerText = "Role: SUPER ADMIN";
          
          setupRiwayatTransaksi(null); 
        } 
        else if (role === "admin_bidang") {
          document.getElementById("panel-bidang").style.display = "flex";
          document.getElementById("status-role").innerText = `Role: ADMIN BIDANG (${namaBidangUser})`;

          setupRiwayatTransaksi(namaBidangUser);
        }
      } else {
        alert("Data user tidak ditemukan di Firestore!");
      }
    } catch (error) {
      console.error("Error Auth Logic:", error);
    }
  }
});

function setupRiwayatTransaksi(filterBidang) {
  if (unsubscribeTransaksi) unsubscribeTransaksi();

  let q;
  if (filterBidang) {
    q = query(
      collection(db, "transaksi"),
      where("jenis_transaksi", "==", false),
      where("bidang", "==", filterBidang)
    );
  } else {
    q = query(collection(db, "transaksi"), orderBy("created_at", "desc"));
  }

  unsubscribeTransaksi = onSnapshot(q, (snapshot) => {
    const table = document.getElementById("list-bidang"); 
    if (!table) return;

    table.innerHTML = "";
    if (snapshot.empty) {
      table.innerHTML = "<tr><td colspan='4' style='text-align:center'>Belum ada transaksi.</td></tr>";
      return;
    }

    snapshot.forEach((d) => {
      const t = d.data();
      table.innerHTML += `
        <tr>
          <td style="text-transform: capitalize;">${t.nama_barang}</td>
          <td>${t.bidang || "-"}</td>
          <td>${t.qty}</td>
          <td>${t.created_at?.toDate().toLocaleDateString("id-ID") || "..." }</td>
        </tr>`;
    });
  });
}

// --- 2. FITUR SUPER ADMIN: UPDATE STOK ---
window.updateStok = async () => {
  const nama = document.getElementById("itemName").value.toLowerCase();
  const qty = parseInt(document.getElementById("itemQty").value);
  if (!nama || isNaN(qty)) return;

  try {
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

    await addDoc(collection(db, "transaksi"), {
      nama_barang: nama,
      qty: qty,
      jenis_transaksi: true, 
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
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const dataUser = userSnap.data();
        const namaBidang = dataUser.nama_bidang; 

        const namaBarang = document.getElementById("reqName").value.toLowerCase();
        const qty = parseInt(document.getElementById("reqQty").value);

        if (!namaBarang || isNaN(qty) || qty <= 0) {
          return alert("Mohon isi nama barang dan jumlah dengan benar.");
        }

        await addDoc(collection(db, "permintaan"), {
          nama_barang: namaBarang,
          jumlah: qty,
          bidang: namaBidang, 
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

  if (snapshot.empty) {
    table.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 20px; color: #888;">
                    Tidak ada permintaan barang saat ini.
                </td>
            </tr>`;
    return; 
  }

  snapshot.forEach((d) => {
    const r = d.data();
    table.innerHTML += `
            <tr>
                <td style="text-transform: capitalize;">${r.nama_barang}</td>
                <td>${r.bidang}</td>
                <td><input type="number" id="edit-${d.id}" value="${r.jumlah}" style="width:60px"></td>
                <td>
                    <button onclick="approve('${d.id}', '${r.nama_barang}')" style="background:green; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Approve</button>
                    <button onclick="reject('${d.id}')" style="background:red; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Tolak</button>
                </td>
            </tr>`;
  });
});

window.approve = async (id, namaBarang) => {
  const newQty = parseInt(document.getElementById(`edit-${id}`).value);

  try {
    const reqRef = doc(db, "permintaan", id);
    const reqSnap = await getDoc(reqRef);

    if (!reqSnap.exists()) return alert("Data permintaan tidak ditemukan!");
    const dataPermintaan = reqSnap.data();

    const barangRef = doc(db, "barang", namaBarang);
    const barangSnap = await getDoc(barangRef);

    if (barangSnap.exists() && barangSnap.data().stock >= newQty) {
      await updateDoc(barangRef, {
        stock: increment(-newQty),
        update: serverTimestamp(),
      });

      await addDoc(collection(db, "transaksi"), {
        nama_barang: namaBarang, 
        qty: newQty, 
        jenis_transaksi: false, 
        bidang: dataPermintaan.bidang,
        created_at: serverTimestamp(), 
      });

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
    const tables = document.querySelectorAll(".list-stok");
    
    tables.forEach(table => table.innerHTML = "");

    snapshot.forEach((d) => {
        const b = d.data();
        const rowHTML = `
            <tr>
                <td>${b.nama_barang}</td>
                <td>${b.stock}</td>
                <td>${b.update?.toDate().toLocaleDateString() || "..."}</td>
            </tr>`;

        tables.forEach(table => {
            table.innerHTML += rowHTML;
        });
    });
});

const q = query(
  collection(db, "transaksi"),
  where("jenis_transaksi", "==", false),
);

onSnapshot(q, (snapshot) => {
  const table = document.getElementById("list-transaksi");
  table.innerHTML = "";

  if (snapshot.empty) {
    table.innerHTML =
      "<tr><td colspan='3'>Tidak ada barang keluar.</td></tr>";
    return;
  }

  snapshot.forEach((d) => {
    const b = d.data();
    table.innerHTML += `
            <tr>
                <td>${b.nama_barang}</td>
                <td>${b.bidang}</td>
                <td>${b.qty}</td>
                <td>${b.created_at?.toDate().toLocaleDateString() || "..."}</td>
            </tr>`;
  });
});



window.logout = () => signOut(auth);
