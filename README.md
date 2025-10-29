# **GAS-Tools: Advanced Google Apps Script Utility Library**

gas-tools is a comprehensive "Swiss Army knife" library for Google Apps Script. It's designed to supercharge your GAS projects by providing powerful, high-level functions for common and complex tasks that are not natively simple in the GAS environment.

This library simplifies everything from creating a robust database on top of Google Sheets to generating images from spreadsheet ranges, running asynchronous operations, and even cloning entire web pages for analysis.

## **🚀 Core Features**

This library is packed with helper functions. Here are some of the most powerful features:

* **🗄️ Spreadsheet-based Database:** A surprisingly robust database system built on top of Google Sheets (CreateDatabase, AddToDatabase, ReadFromDatabase, CountFromDatabase). It cleverly bypasses individual sheet size limits by automatically creating new spreadsheets as "shards" for time-based data, using a central sheet as an index.

* **🌐 Web Page Scraper:** A sophisticated UrlInfo function that fetches a live web page, parses its entire DOM, rewrites all relative URLs to absolute ones, and serves a "summarized" version. It's powerful enough to handle scripts, styles, and complex nested HTML.

* **🖼️ Advanced Media Generation:**

  * ExportRangeAsPng: Exports any spreadsheet range as a PNG image.

  * ExportCurrentCellPhoto: Exports the contents of the active cell (even if it's an in-cell image) as a PNG.

  * PdfToPng: A powerful utility that converts PDF blobs into an array of PNG image blobs, one for each page.

  * Qr: Generates a QR code from any text and saves it to your Drive.

* **⚡ Async & Concurrency:**

  * GetAsync / PostAsync: Simple wrappers for UrlFetchApp that return a Promise for use in modern asynchronous code.

  * ExecAsync: Safely executes any function asynchronously, returning null on error instead of halting execution.

  * Threads: A client-side "threading" utility (for use in HtmlService) that leverages Web Workers to run multiple asynchronous functions in parallel, with built-in support for dependencies and delays.

* **📡 Robust HTTP & API Utilities:**

  * FinalUrl: Follows all HTTP redirects (301, 302) to find the final destination URL of any link.

  * ShortUrl: A built-in client for the Bitly API.

  * PhotoTemp: A client for the api.apilayer.com image upload API.

  * OptimizePhotoUrl: Resizes and compresses an image from a URL using an external service.

* **📦 Caching & Locking:**

  * WriteToCache / ReadFromCache: Simple, reliable wrappers for CacheService to easily cache and retrieve data.

  * Lock / Unlock / Locker: Utility functions for LockService to prevent race conditions and ensure safe concurrent execution.

* **🛠️ ...and many more helpers:** Includes utilities for Drive file/folder management (SaveFile, EmptyFolder, ShareFile), custom Stringify (handles functions), Uuid generation, Flatten arrays, and much more.

## **🔧 Installation & Setup**

1. **Create a New GAS Project:** Go to [script.google.com](https://script.google.com) and create a new project.

2. **Add the Code:** Copy the entire contents of Code.gs from this repository and paste it into the Code.gs file in your new GAS project.

3. **Update the Manifest:**

   * In the GAS editor, click **Project Settings** (the ⚙️ icon).

   * Check the box for **"Show 'appsscript.json' manifest file in editor"**.

   * Go back to the **Editor** (the `<>` icon) and click on the appsscript.json file.

   * **Delete all** of its default content and **paste** the content from the appsscript.json file in this repository.

   * This step is **CRITICAL** as it enables the required Advanced Google Services (Drive, Slides), external libraries (ImgApp), and OAuth scopes.

4. **Authorize:**

   * Run any function from the editor (e.g., GetEmail).

   * Google will prompt you to authorize the script.

   * You will see a "Google hasn't verified this app" warning. This is normal for your own scripts.

   * Click **Advanced**, then **"Go to 'Your Project Name' (unsafe)"**.

   * Review and **Allow** all the requested permissions. The script requires broad permissions (like full Drive and Spreadsheet access) to do its job.

## **Example Usage**

Here are a few examples of how to use the library's key features.

### **🗄️ Using the Spreadsheet Database**

The database is perfect for logging, tracking, or storing any time-series data.

```JavaScript

function testDatabase() {  
  // 1. Create the database (only needs to run once)  
  // This creates a main "Database MyProject" sheet in a [DB] folder in your Drive.  
  CreateDatabase("MyProject");  
    
  // 2. Add data to it  
  let userData = {  
    name: "Alice",  
    email: "alice@example.com",  
    action: "login",  
    timestamp: new Date()  
  };  
    
  // AddToDatabase(dbName, sheetName, key, value)  
  AddToDatabase("MyProject", "UserLogs", "user_123", userData);  
    
  // 3. Read the most recent value for a key  
  let lastLog = ReadFromDatabase("MyProject", "UserLogs", "user_123");  
  console.log(lastLog); // -> { name: "Alice", ... }  
    
  // 4. Read data from the last 5 minutes  
  let recentLog = ReadFromDatabase("MyProject", "UserLogs", "user_123", 300000); // 5 * 60 * 1000  
  console.log(recentLog);  
}

```

### **🖼️ Exporting a Range as an Image**

Generate an image from a chart or data table and get its Drive file ID.

```JavaScript

function exportChart() {  
  // Options for the PDF export that becomes the PNG  
  let options = {  
    name: "Monthly_Sales_Report", // File name  
    fzr: false,                  // Freeze rows?  
    gridlines: false,  
    pagenum: false,  
    path: "/MyReports/Charts"    // Save to this Drive folder  
  };

  // ExportRangeAsPng(sheetName, startCell, endCell, options)  
  let imageId = ExportRangeAsPng("Dashboard", "A1", "G20", options);  
    
  console.log("Image saved to Drive with ID: " + imageId);  
    
  // You could now email this image  
  // MailApp.sendEmail(...);  
}

```

### **🌐 Analyzing a Web Page (as a Web App)**

Deploy your script as a Web App to use this feature.

```JavaScript

/**  
 * This function must be named doGet(e) to create a web app.  
 * When you visit your web app URL with a parameter,  
 * e.g., .../exec?url=example.com  
 * it will serve a summary of that page.  
 */  
function doGet(e) {  
  let urlToClone = e.parameter.url; // e.g., "example.com"  
    
  if (!urlToClone) {  
    return HtmlService.createHtmlOutput("Please provide a ?url= parameter.");  
  }  
    
  // This fetches the URL, parses all HTML, and rewrites all links/scripts/styles  
  return UrlInfo(urlToClone);  
}

```

### **⚡ Using Async Functions**

Make external API calls without blocking other operations.

```JavaScript

async function fetchSomeData() {  
  let payload = {  
    "key": "my_data",  
    "value": 123  
  };  
    
  let headers = {  
    "Authorization": "Bearer my_secret_token"  
  };  
    
  try {  
    // PostAsync(path, params_obj, headers_obj)  
    let response = await PostAsync("https://api.example.com/data", payload, headers);  
    let responseData = JSON.parse(response.getContentText());  
    console.log(responseData);  
      
  } catch (e) {  
    console.error("API call failed: " + e);  
  }  
}

```

## **⚠️ Dependencies & Authorization**

This library is powerful because it integrates many services. This requires you to enable them and grant broad permissions.

### **Enabled Services (in appsscript.json)**

* **Advanced Google Services:**

  * Slides: Used for some media operations.

  * Drive (v3): Used by PdfToPng to get thumbnail links.

* **External Libraries:**

  * ImgApp: Used for image resizing (OptimizePhotoId).

* **In-Script Fetches:**

  * pdf-lib: Fetched and eval'd from a CDN for PDF manipulation.

### **OAuth Scopes Required**

Your appsscript.json configures this script to request the following permissions:

* https://www.googleapis.com/auth/userinfo.email - (Get your email)

* https://www.googleapis.com/auth/userinfo.profile - (Get your profile info)

* https://www.googleapis.com/auth/script.container.ui - (Show alerts and dialogs)

* https://www.googleapis.com/auth/drive - **(Full Drive Access)** - To create DBs, save files, etc.

* https://www.googleapis.com/auth/script.external_request - **(Full External Access)** - To call any API.

* https://www.googleapis.com/auth/documents - (Access Google Docs)

* https://www.googleapis.com/auth/spreadsheets - **(Full Spreadsheet Access)** - For the Database.

* https://www.googleapis.com/auth/presentations - (Access Google Slides)

* https://www.googleapis.com/auth/script.send_mail - (Send email as you)

## **🤝 Contributing**

Feel free to fork this repository, submit pull requests, or open issues for bugs and feature requests.

## **📄 License**

This project is licensed under the MIT License. See the LICENSE file for details.
