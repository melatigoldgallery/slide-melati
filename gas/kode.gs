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
    switch (page) {
      case "dashboard":
        return HtmlService.createTemplateFromFile("Dashboard")
          .evaluate()
          .setTitle("Sistem Pencatatan Barang")
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

      case "form":
        return HtmlService.createTemplateFromFile("FormTambah")
          .evaluate()
          .setTitle("Tambah Data Baru")
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

      default:
        return HtmlService.createHtmlOutput("<h1>Page not found</h1>");
    }
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
  Logger.log("=== getSheetData START ===");
  try {
    // Set defaults
    page = page || 1;
    filters = filters || {};

    Logger.log("getSheetData called - Page: " + page);
    Logger.log("Filters: " + JSON.stringify(filters));
    Logger.log("SPREADSHEET_ID: " + CONFIG.SPREADSHEET_ID);
    Logger.log("SHEET_NAME: " + CONFIG.SHEET_NAME);

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    Logger.log("Spreadsheet opened successfully: " + ss.getName());

    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet) {
      Logger.log("Sheet not found: " + CONFIG.SHEET_NAME);
      Logger.log(
        "Available sheets: " +
          ss
            .getSheets()
            .map((s) => s.getName())
            .join(", ")
      );
      throw new Error('Sheet "' + CONFIG.SHEET_NAME + '" tidak ditemukan!');
    }

    Logger.log("Sheet found: " + sheet.getName());

    const lastRow = sheet.getLastRow();
    Logger.log("Last row: " + lastRow);

    if (lastRow <= 1) {
      Logger.log("No data - returning empty result");
      return {
        data: [],
        total: 0,
        page: 1,
        totalPages: 0,
        stats: { total: 0, uploaded: 0, notUploaded: 0 },
      };
    }

    // Get all data (skip header) - Updated to 10 columns
    const range = sheet.getRange(2, 1, lastRow - 1, 10);
    const values = range.getValues();
    Logger.log("Got " + values.length + " rows of data");

    // Convert to objects with new structure
    let data = values
      .map((row, index) => ({
        rowIndex: index + 2, // Actual row in sheet
        no: row[0],
        tanggal: row[1] ? Utilities.formatDate(new Date(row[1]), Session.getScriptTimeZone(), "dd/MM/yyyy") : "",
        jam: row[2]
          ? row[2] instanceof Date
            ? Utilities.formatDate(new Date(row[2]), Session.getScriptTimeZone(), "HH:mm")
            : row[2]
          : "",
        sales: row[3],
        namaBarang: row[4],
        berat: row[5],
        kadar: row[6],
        harga: row[7],
        fotoId: row[8],
        lihatFoto: row[9],
      }))
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
    const allData = values.map((row) => ({ lihatFoto: row[9] }));
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

    Logger.log("Returning result with " + paginatedData.length + " items");
    Logger.log("Result object: " + JSON.stringify(result));
    Logger.log("=== getSheetData END SUCCESS ===");
    return result;
  } catch (error) {
    Logger.log("=== getSheetData ERROR ===");
    Logger.log("getSheetData Error: " + error);
    Logger.log("Error stack: " + error.stack);
    Logger.log("Error name: " + error.name);
    Logger.log("Error message: " + error.message);

    // Return consistent format instead of throwing
    const errorResult = {
      data: [],
      total: 0,
      page: 1,
      totalPages: 0,
      stats: { total: 0, uploaded: 0, notUploaded: 0 },
      error: true,
      errorMessage: error.toString(),
    };

    Logger.log("Returning error result: " + JSON.stringify(errorResult));
    Logger.log("=== getSheetData END ERROR ===");
    return errorResult;
  }
}

/**
 * Get unique sales names for filter dropdown
 */
function getUniqueSales() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) return [];

    // Column D = Sales (index 4)
    const salesColumn = sheet.getRange(2, 4, lastRow - 1, 1).getValues();
    const uniqueSales = [...new Set(salesColumn.map((row) => row[0]).filter((val) => val))];

    return uniqueSales.sort();
  } catch (error) {
    Logger.log("getUniqueSales Error: " + error);
    return [];
  }
}

/**
 * Add new record to sheet
 */
function addNewRecord(formData) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    // Generate new No (auto-increment)
    const lastRow = sheet.getLastRow();
    const newNo = lastRow <= 1 ? 1 : sheet.getRange(lastRow, 1).getValue() + 1;

    // Parse date and time
    const tanggal = new Date(formData.tanggal);
    const jam = formData.jam || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "HH:mm");

    // Prepare row data (10 columns)
    const rowData = [
      newNo, // A:  No
      tanggal, // B:  Tanggal
      jam, // C: Jam
      formData.sales, // D: Sales
      formData.namaBarang, // E: Nama Barang
      formData.berat, // F: Berat
      formData.kadar, // G: Kadar
      formData.harga, // H: Harga
      "", // I: Foto ID (empty)
      "", // J: Lihat Foto (empty)
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
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    const row = sheet.getRange(rowIndex, 1, 1, 10).getValues()[0];

    return {
      success: true,
      data: {
        rowIndex: rowIndex,
        no: row[0],
        tanggal: row[1] ? Utilities.formatDate(new Date(row[1]), Session.getScriptTimeZone(), "dd/MM/yyyy") : "",
        jam: row[2]
          ? row[2] instanceof Date
            ? Utilities.formatDate(new Date(row[2]), Session.getScriptTimeZone(), "HH:mm")
            : row[2]
          : "",
        sales: row[3],
        namaBarang: row[4],
        berat: row[5],
        kadar: row[6],
        harga: row[7],
        fotoId: row[8],
        lihatFoto: row[9],
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
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    // Get current record
    const record = sheet.getRange(rowIndex, 1, 1, 10).getValues()[0];
    const no = record[0];
    const sales = record[3];

    // Upload file to Google Drive
    const uploadResult = uploadToGoogleDrive(fileData, fileName, mimeType, no, sales);

    if (!uploadResult.success) {
      return uploadResult;
    }

    // Update sheet
    sheet.getRange(rowIndex, 9).setValue(uploadResult.fileId); // I: Foto ID
    sheet.getRange(rowIndex, 10).setValue(uploadResult.url); // J: Lihat Foto

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
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    // Get foto ID
    const fotoId = sheet.getRange(rowIndex, 9).getValue();

    if (fotoId) {
      try {
        const file = DriveApp.getFileById(fotoId);
        file.setTrashed(true);
      } catch (e) {
        Logger.log("File not found or already deleted: " + e);
      }
    }

    // Clear sheet columns
    sheet.getRange(rowIndex, 9).setValue(""); // I: Foto ID
    sheet.getRange(rowIndex, 10).setValue(""); // J: Lihat Foto

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
 * Get form URL untuk popup
 */
function getFormUrl() {
  var url = ScriptApp.getService().getUrl();
  return url + "?page=form";
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

/**
 * Test function - untuk test authorization
 */
function testFunction() {
  Logger.log("Test successful!");
  return "OK";
}

function testAddRecord() {
  var testData = {
    tanggal: "2025-12-20",
    jam: "14:30",
    sales: "Test Sales",
    namaBarang: "Test Barang",
    berat: "10 gram",
    kadar: "24K",
    harga: 1000000,
  };

  var result = addNewRecord(testData);
  Logger.log(result);
  return result;
}

/**
 * Test getSheetData function directly
 */
function testGetSheetData() {
  Logger.log("Starting testGetSheetData...");

  var result = getSheetData(1, {});

  Logger.log("Test Result:");
  Logger.log("- Error: " + (result.error || false));
  Logger.log("- Data length: " + result.data.length);
  Logger.log("- Total: " + result.total);
  Logger.log("- Stats: " + JSON.stringify(result.stats));

  if (result.error) {
    Logger.log("ERROR MESSAGE: " + result.errorMessage);
  }

  return result;
}
