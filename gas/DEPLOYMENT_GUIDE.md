# 🚀 Panduan Deploy Web App

## Masalah Saat Ini

✅ **Kode berfungsi** - Test di editor berhasil mengembalikan 4 data  
❌ **Web app gagal** - Response kosong karena menggunakan versi lama

---

## Solusi: Deploy Ulang Web App

### Langkah 1: Buka Deployment Manager

1. Di Google Apps Script Editor, klik **Deploy** (di kanan atas)
2. Pilih **Manage deployments**

### Langkah 2: Update Deployment yang Ada

Anda punya 2 pilihan:

#### Opsi A: Edit Deployment Aktif (RECOMMENDED)

1. Klik ikon **⚙️ (gear/edit)** di sebelah deployment yang aktif
2. Di bagian "Version", pilih **New version**
3. Isi deskripsi: "Fix empty response issue - Dec 20, 2025"
4. Pastikan pengaturan:
   - **Execute as:** `Me (your-email@gmail.com)`
   - **Who has access:** `Anyone`
5. Klik **Deploy**
6. Copy URL yang baru (seharusnya sama, tapi ada /dev di akhir untuk testing)

#### Opsi B: Buat Deployment Baru

1. Klik **New deployment**
2. Pilih type: **Web app**
3. Isi deskripsi: "Production - Dec 20, 2025"
4. Pengaturan:
   - **Execute as:** `Me (your-email@gmail.com)` ← PENTING!
   - **Who has access:** `Anyone` ← Atau "Anyone with Google account" jika mau lebih aman
5. Klik **Deploy**
6. **Authorize** aplikasi (klik "Authorize access")
7. Login dengan akun Google Anda
8. Copy **Web app URL** yang baru

### Langkah 3: Test URL Baru

1. Buka URL web app yang baru di browser
2. Jika diminta login, gunakan akun Google Anda
3. Data seharusnya muncul sekarang!

---

## URL Anda Saat Ini

```
https://script.google.com/macros/s/AKfycbxdG6CUiVKz30R9yAh1Y_7ezbTXcjWYol1TbnoRWro/dev
```

**Catatan:** URL dengan `/dev` adalah development URL. Untuk production, gunakan URL tanpa `/dev`.

---

## Troubleshooting

### Masalah: Masih "Response kosong" setelah deploy ulang

**Solusi:** Clear browser cache atau buka di Incognito/Private mode

### Masalah: "Authorization required"

**Solusi:**

1. Klik link authorization yang muncul
2. Pilih akun Google Anda
3. Klik "Advanced" → "Go to [Project Name] (unsafe)"
4. Klik "Allow"

### Masalah: "Script function not found"

**Solusi:** Pastikan `doGet(e)` function ada di kode.gs (sudah ada ✅)

---

## Checklist Deploy

- [ ] Buka Manage deployments
- [ ] Update ke New version ATAU buat deployment baru
- [ ] Set "Execute as: Me"
- [ ] Set "Who has access: Anyone"
- [ ] Deploy dan authorize
- [ ] Copy URL baru
- [ ] Test di browser (gunakan incognito mode)
- [ ] Verifikasi data muncul

---

## Penjelasan Setting

### Execute as: Me

- Script akan berjalan dengan PERMISSION ANDA
- Ini memungkinkan script mengakses Spreadsheet dan Drive Anda
- **PENTING:** Tanpa ini, user lain tidak bisa akses data Anda

### Who has access: Anyone

- Siapa saja dengan URL bisa mengakses web app
- Alternatif: "Anyone with Google account" (lebih aman, user harus login)

---

## Tips

💡 Setiap kali Anda mengubah kode, Anda harus **deploy ulang** dengan new version  
💡 URL development (`/dev`) selalu menggunakan kode terbaru, tapi kadang butuh refresh  
💡 URL production harus di-update manual setiap deploy

---

**Status Kode Anda:** ✅ BERFUNGSI (test berhasil dengan 4 data)  
**Action Required:** 🔄 Deploy ulang web app dengan pengaturan yang benar
