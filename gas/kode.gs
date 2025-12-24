// ==========================================
// CONFIGURATION - GANTI DENGAN DATA ANDA
// ==========================================

const CONFIG = {
  SPREADSHEET_ID: "1r4Is_mDtqF6kSpHyV4GB6ImNO2bhsjipWWHUKJy8ka8", // ID Spreadsheet dari test connection
  SHEET_NAME: "DataPengambilan",
  DRIVE_FOLDER_ID: "1DE3p81Rt-nn1XPPXqXB50n72TZIR-VW3", // Ganti dengan Folder ID dari Google Drive
  ITEMS_PER_PAGE: 20,
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_EXTENSIONS: ["jpg", "jpeg", "png"],
};

// ==========================================
// MAIN ROUTING
// ==========================================

function doGet(e) {
  // Fix: Handle undefined parameter
  const params = e && e.parameter ? e.parameter : {};
  const page = params.page || "dashboard";

  try {
    // Only serve Dashboard page (form & edit are now modals)
    if (page === "dashboard") {
      return HtmlService.createTemplateFromFile("Dashboard")
        .evaluate()
        .setTitle("Sistem Pencatatan Barang")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    return HtmlService.createHtmlOutput("<h1>Page not found</h1>");
  } catch (error) {
    Logger.log("doGet Error: " + error);
    return HtmlService.createHtmlOutput("<h1>Error:  " + error + "</h1>");
  }
}

// ==========================================
// HELPER:  Include HTML files
// ==========================================

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ==========================================
// DATA OPERATIONS
// ==========================================

/**
 * Get all data from sheet with pagination and filters
 */
function getSheetData(page, filters) {
  page = page || 1;
  filters = filters || {};

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet) {
      throw new Error('Sheet "' + CONFIG.SHEET_NAME + '" tidak ditemukan!');
    }

    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
      return {
        data: [],
        total: 0,
        page: 1,
        totalPages: 0,
        stats: { total: 0, uploaded: 0, notUploaded: 0 },
      };
    }

    // Get all data (skip header) - Updated to 12 columns
    const range = sheet.getRange(2, 1, lastRow - 1, 12);
    const values = range.getValues();

    // Convert to objects with new structure
    let data = values
      .map((row, index) => {
        try {
          // Parse tanggal - ensure only date part, not time
          let tanggalFormatted = "";
          if (row[1]) {
            const dateObj = new Date(row[1]);
            // Remove time component by creating new date with only date parts
            const dateOnly = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
            tanggalFormatted = Utilities.formatDate(dateOnly, Session.getScriptTimeZone(), "dd/MM/yyyy");
          }

          return {
            rowIndex: index + 2, // Actual row in sheet
            no: row[0] || "",
            tanggal: tanggalFormatted,
            jam: row[2]
              ? row[2] instanceof Date
                ? Utilities.formatDate(new Date(row[2]), Session.getScriptTimeZone(), "HH:mm")
                : String(row[2])
              : "",
            sales: row[3] || "",
            namaCustomer: row[4] || "",
            infoKontak: row[5] || "",
            namaBarang: row[6] || "",
            berat: row[7] || "",
            kadar: row[8] || "",
            harga: row[9] || "",
            fotoId: row[10] || "",
            lihatFoto: row[11] || "",
          };
        } catch (e) {
          return null;
        }
      })
      .filter((item) => item !== null) // Remove any null entries
      .reverse(); // Newest first

    // Apply filters
    if (filters.sales && filters.sales !== "Semua") {
      data = data.filter((item) => item.sales === filters.sales);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      data = data.filter(
        (item) =>
          (item.sales && item.sales.toLowerCase().includes(searchLower)) ||
          (item.namaBarang && item.namaBarang.toLowerCase().includes(searchLower)) ||
          (item.namaCustomer && item.namaCustomer.toLowerCase().includes(searchLower)) ||
          (item.no && item.no.toString().includes(searchLower))
      );
    }

    // Filter by upload status
    if (filters.hasPhoto === "yes") {
      data = data.filter((item) => item.lihatFoto && item.lihatFoto.trim() !== "");
    } else if (filters.hasPhoto === "no") {
      data = data.filter((item) => !item.lihatFoto || item.lihatFoto.trim() === "");
    }

    // Calculate stats (from original data before pagination)
    const allData = values.map((row) => ({ lihatFoto: row[11] })); // Column L = index 11
    const stats = {
      total: allData.length,
      uploaded: allData.filter((item) => item.lihatFoto && item.lihatFoto.trim() !== "").length,
      notUploaded: allData.filter((item) => !item.lihatFoto || item.lihatFoto.trim() === "").length,
    };

    // Pagination
    const totalPages = Math.ceil(data.length / CONFIG.ITEMS_PER_PAGE);
    const startIndex = (page - 1) * CONFIG.ITEMS_PER_PAGE;
    const paginatedData = data.slice(startIndex, startIndex + CONFIG.ITEMS_PER_PAGE);

    const result = {
      data: paginatedData,
      total: data.length,
      page: page,
      totalPages: totalPages,
      stats: stats,
    };

    return result;
  } catch (error) {
    Logger.log("Error in getSheetData: " + error.toString());

    return {
      data: [],
      total: 0,
      page: page || 1,
      totalPages: 0,
      stats: { total: 0, uploaded: 0, notUploaded: 0 },
      error: true,
      errorMessage: error.message || error.toString(),
    };
  }
}

/**
 * Get unique sales names for filter dropdown
 */
function getUniqueSales() {
  Logger.log("=== getUniqueSales START ===");
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    const lastRow = sheet.getLastRow();

    Logger.log("Last row in sheet: " + lastRow);

    if (lastRow <= 1) {
      Logger.log("No data, returning empty array");
      return [];
    }

    // Column D = Sales (index 4)
    const salesColumn = sheet.getRange(2, 4, lastRow - 1, 1).getValues();
    const uniqueSales = [...new Set(salesColumn.map((row) => row[0]).filter((val) => val))];

    Logger.log("Found " + uniqueSales.length + " unique sales");
    Logger.log("=== getUniqueSales END SUCCESS ===");
    return uniqueSales.sort();
  } catch (error) {
    Logger.log("=== getUniqueSales ERROR ===");
    Logger.log("getUniqueSales Error: " + error);
    Logger.log("Error message: " + (error.message || error.toString()));
    return []; // Always return array, never null
  }
}

/**
 * Add new record to sheet
 */
function addNewRecord(formData) {
  try {
    // Validate input
    if (!formData) {
      return {
        success: false,
        message: "Error: formData is required. Use testAddRecord() for testing.",
      };
    }

    if (
      !formData.tanggal ||
      !formData.sales ||
      !formData.namaBarang ||
      !formData.berat ||
      !formData.kadar ||
      !formData.harga
    ) {
      return {
        success: false,
        message: "Error: Missing required fields (tanggal, sales, namaBarang, berat, kadar, harga)",
      };
    }

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    // Generate new No (auto-increment)
    const lastRow = sheet.getLastRow();
    const newNo = lastRow <= 1 ? 1 : sheet.getRange(lastRow, 1).getValue() + 1;

    // Parse date - ensure only date part without time
    const tanggalObj = new Date(formData.tanggal);
    const tanggalOnly = new Date(tanggalObj.getFullYear(), tanggalObj.getMonth(), tanggalObj.getDate());
    const jam = formData.jam || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "HH:mm");

    // Prepare row data (12 columns)
    const rowData = [
      newNo, // A:  No
      tanggalOnly, // B:  Tanggal (date only, no time)
      jam, // C: Jam
      formData.sales, // D: Sales
      formData.namaCustomer || "", // E: Nama Customer
      formData.infoKontak || "", // F: Info Kontak
      formData.namaBarang, // G: Nama Barang
      formData.berat, // H: Berat
      formData.kadar, // I: Kadar
      formData.harga, // J: Harga
      "", // K: Foto ID (empty)
      "", // L: Lihat Foto (empty)
    ];

    // Append to sheet
    sheet.appendRow(rowData);

    return {
      success: true,
      message: "Data berhasil ditambahkan! ",
      no: newNo,
    };
  } catch (error) {
    Logger.log("addNewRecord Error: " + error);
    return {
      success: false,
      message: "Error:  " + error.toString(),
    };
  }
}

/**
 * Get single record by row index
 */
function getRecordByRow(rowIndex) {
  try {
    // Validate input
    if (!rowIndex || typeof rowIndex !== "number") {
      return {
        success: false,
        message: "Error: rowIndex is required and must be a number. Use testGetRecordByRow() for testing.",
      };
    }

    if (rowIndex < 2) {
      return {
        success: false,
        message: "Error: rowIndex must be >= 2 (row 1 is header)",
      };
    }

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    const lastRow = sheet.getLastRow();

    if (rowIndex > lastRow) {
      return {
        success: false,
        message: "Error: rowIndex " + rowIndex + " exceeds last row " + lastRow,
      };
    }

    const row = sheet.getRange(rowIndex, 1, 1, 12).getValues()[0];

    // Parse tanggal - ensure only date part
    let tanggalFormatted = "";
    if (row[1]) {
      const dateObj = new Date(row[1]);
      const dateOnly = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
      tanggalFormatted = Utilities.formatDate(dateOnly, Session.getScriptTimeZone(), "dd/MM/yyyy");
    }

    return {
      success: true,
      data: {
        rowIndex: rowIndex,
        no: row[0],
        tanggal: tanggalFormatted,
        jam: row[2]
          ? row[2] instanceof Date
            ? Utilities.formatDate(new Date(row[2]), Session.getScriptTimeZone(), "HH:mm")
            : row[2]
          : "",
        sales: row[3],
        namaCustomer: row[4] || "",
        infoKontak: row[5] || "",
        namaBarang: row[6] || "",
        berat: row[7] || "",
        kadar: row[8] || "",
        harga: row[9] || "",
        fotoId: row[10] || "",
        lihatFoto: row[11] || "",
      },
    };
  } catch (error) {
    Logger.log("getRecordByRow Error: " + error);
    return {
      success: false,
      message: "Error: " + error.toString(),
    };
  }
}

/**
 * Update record with uploaded photo
 */
function updateWithUpload(rowIndex, fileData, fileName, mimeType) {
  try {
    // Validate input
    if (!rowIndex || !fileData || !fileName || !mimeType) {
      return {
        success: false,
        message: "Error: Missing required parameters (rowIndex, fileData, fileName, mimeType)",
      };
    }

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    // Get current record
    const record = sheet.getRange(rowIndex, 1, 1, 12).getValues()[0];
    const no = record[0];
    const sales = record[3];

    // Upload file to Google Drive
    const uploadResult = uploadToGoogleDrive(fileData, fileName, mimeType, no, sales);

    if (!uploadResult.success) {
      return uploadResult;
    }

    // Update sheet
    sheet.getRange(rowIndex, 11).setValue(uploadResult.fileId); // K: Foto ID
    sheet.getRange(rowIndex, 12).setValue(uploadResult.url); // L: Lihat Foto

    return {
      success: true,
      message: "Foto berhasil diupload! ",
      url: uploadResult.url,
    };
  } catch (error) {
    Logger.log("updateWithUpload Error:  " + error);
    return {
      success: false,
      message: "Error: " + error.toString(),
    };
  }
}

/**
 * Upload file to Google Drive
 */
function uploadToGoogleDrive(base64Data, fileName, mimeType, no, salesName) {
  try {
    // Validate input
    if (!base64Data || !fileName || !mimeType) {
      return {
        success: false,
        message: "Error: Missing required parameters (base64Data, fileName, mimeType)",
      };
    }

    // Get or create folder
    const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);

    // Create monthly subfolder
    const now = new Date();
    const monthYear = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM");
    const monthFolders = folder.getFoldersByName(monthYear);
    const monthFolder = monthFolders.hasNext() ? monthFolders.next() : folder.createFolder(monthYear);

    // Clean sales name for filename
    const cleanSales = salesName ? salesName.replace(/[^a-zA-Z0-9]/g, "") : "NoSales";
    const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
    const extension = fileName.split(".").pop();
    const newFileName = `${String(no).padStart(3, "0")}_${cleanSales}_${timestamp}.${extension}`;

    // Decode base64
    const contentIndex = base64Data.indexOf("base64,");
    const base64Content = contentIndex !== -1 ? base64Data.substring(contentIndex + 7) : base64Data;

    const blob = Utilities.newBlob(Utilities.base64Decode(base64Content), mimeType, newFileName);

    // Upload file
    const file = monthFolder.createFile(blob);

    // Set sharing (anyone with link can view)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      success: true,
      url: file.getUrl(),
      fileId: file.getId(),
    };
  } catch (error) {
    Logger.log("uploadToGoogleDrive Error: " + error);
    return {
      success: false,
      message: "Upload error: " + error.toString(),
    };
  }
}

/**
 * Delete photo from Drive and clear sheet reference
 */
function deletePhoto(rowIndex) {
  try {
    // Validate input
    if (!rowIndex) {
      return {
        success: false,
        message: "Error: rowIndex is required",
      };
    }

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    // Get foto ID
    const fotoId = sheet.getRange(rowIndex, 11).getValue();

    if (fotoId) {
      try {
        const file = DriveApp.getFileById(fotoId);
        file.setTrashed(true);
      } catch (e) {
        Logger.log("File not found or already deleted: " + e);
      }
    }

    // Clear sheet columns
    sheet.getRange(rowIndex, 11).setValue(""); // K: Foto ID
    sheet.getRange(rowIndex, 12).setValue(""); // L: Lihat Foto

    return {
      success: true,
      message: "Foto berhasil dihapus!",
    };
  } catch (error) {
    Logger.log("deletePhoto Error: " + error);
    return {
      success: false,
      message: "Error: " + error.toString(),
    };
  }
}

/**
 * Delete entire record from sheet
 */
function deleteRecord(rowIndex) {
  try {
    // Validate input
    if (!rowIndex) {
      return {
        success: false,
        message: "Error: rowIndex is required",
      };
    }

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    // Get foto ID before deleting
    const fotoId = sheet.getRange(rowIndex, 11).getValue();

    // Delete foto from Drive if exists
    if (fotoId) {
      try {
        const file = DriveApp.getFileById(fotoId);
        file.setTrashed(true);
      } catch (e) {
        Logger.log("File not found or already deleted: " + e);
      }
    }

    // Delete the row
    sheet.deleteRow(rowIndex);

    return {
      success: true,
      message: "Data berhasil dihapus!",
    };
  } catch (error) {
    Logger.log("deleteRecord Error: " + error);
    return {
      success: false,
      message: "Error: " + error.toString(),
    };
  }
}

/**
 * Update existing record
 */
function updateRecord(rowIndex, formData) {
  try {
    // Validate input
    if (!rowIndex || !formData) {
      return {
        success: false,
        message: "Error: rowIndex and formData are required",
      };
    }

    if (
      !formData.tanggal ||
      !formData.sales ||
      !formData.namaBarang ||
      !formData.berat ||
      !formData.kadar ||
      !formData.harga
    ) {
      return {
        success: false,
        message: "Error: Missing required fields",
      };
    }

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    // Get current row to preserve No, FotoID, and LihatFoto
    const currentRow = sheet.getRange(rowIndex, 1, 1, 12).getValues()[0];
    const no = currentRow[0];
    const fotoId = currentRow[10];
    const lihatFoto = currentRow[11];

    // Parse date - ensure only date part without time
    const tanggalObj = new Date(formData.tanggal);
    const tanggalOnly = new Date(tanggalObj.getFullYear(), tanggalObj.getMonth(), tanggalObj.getDate());
    const jam = formData.jam || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "HH:mm");

    // Update row data (preserve No and Foto columns)
    const rowData = [
      no, // A: No (preserve)
      tanggalOnly, // B: Tanggal (date only, no time)
      jam, // C: Jam
      formData.sales, // D: Sales
      formData.namaCustomer || "", // E: Nama Customer
      formData.infoKontak || "", // F: Info Kontak
      formData.namaBarang, // G: Nama Barang
      formData.berat, // H: Berat
      formData.kadar, // I: Kadar
      formData.harga, // J: Harga
      fotoId, // K: Foto ID (preserve)
      lihatFoto, // L: Lihat Foto (preserve)
    ];

    // Update the row
    sheet.getRange(rowIndex, 1, 1, 12).setValues([rowData]);

    return {
      success: true,
      message: "Data berhasil diupdate!",
      no: no,
    };
  } catch (error) {
    Logger.log("updateRecord Error: " + error);
    return {
      success: false,
      message: "Error: " + error.toString(),
    };
  }
}

/**
 * Initialize and authorize - call this first from editor before deployment
 */
function initializeAuthorization() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);

    Logger.log("✅ Authorization successful!");
    Logger.log("✅ Spreadsheet: " + ss.getName());
    Logger.log("✅ Sheet: " + sheet.getName());
    Logger.log("✅ Drive Folder: " + folder.getName());

    return {
      success: true,
      spreadsheet: ss.getName(),
      sheet: sheet.getName(),
      folder: folder.getName(),
    };
  } catch (error) {
    Logger.log("❌ Authorization failed: " + error);
    return {
      success: false,
      error: error.toString(),
    };
  }
}
