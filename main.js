const electron = require('electron');
const url = require('url');
const path = require('path');
const Store = require('./store');
const { Menu } = require('electron');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const fs = require('fs');
const { DateTime } = require('./DateTime')

const { app, BrowserWindow, ipcMain, shell } = electron;

process.env.NODE_ENV = 'development';

let mainWindow;
let checkoutWindow;
let stockWindow;

const store = new Store({
  configName: 'database',
  defaults: {
    items: []
  }
});

function getFormattedTime (timestamp) {
  const date = new DateTime(timestamp);
  return date.format('HH:MM:ss')
}

function getFormattedDate (timestamp) {
  const date = new DateTime(timestamp);
  return date.format('DD MMMM YYYY')
}

function getCurrentDate () {
  const date = new DateTime()
  return date.format('DD-MM-YYYY')
}

async function ejsToPdfBuffer (browser, option, templateData) {
  const ejsTemplate = option.templateName
  const landscape = option.landscape ?? false
  const data = await new Promise((resolve, reject) => {
    ejs.renderFile(`./ejs-template/${ejsTemplate}.ejs`, templateData, (err, _data) => {
      if (err)
        reject(err)
      resolve(_data)
    })
  })

  const page = await browser.newPage()

  await page.setContent(data, {
    waitUntil: 'domcontentloaded'
  })

  const pdfBuffer = await page.pdf({
    format: 'a4',
    landscape,
    margin: {
      top: '19mm',
      right: '19mm',
      bottom: '19mm',
      left: '19mm'
    }
  })

  await page.close()

  return pdfBuffer
}


async function generatePdf (templateName, data) {
  const date = getCurrentDate()

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--headless',
      '--disable-gpu'
    ]
  })

  let pdfBuffers

  try {
    // use promise all to make other options pages can run in parallel
    pdfBuffers = await ejsToPdfBuffer(browser, { templateName }, { ...data, date })
  } catch (err) {
    throw err
  } finally {
    await browser.close()
  }

  const filePath = path.join('/root/Downloads', `${data.title}-${date}.pdf`)

  fs.writeFileSync(filePath, pdfBuffers)

  return filePath
}

async function generateStockListPdf (title, list) {
  return await generatePdf('senarai-stock', { list, title })
}

const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true
    }
  });
  
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '/pages/mainWindow/index.html'),
    protocol: 'file:',
    slashes: true
  }));

  mainWindow.maximize();

  mainWindow.on('close', () => {
    app.quit();
  });

  mainWindow.on('focus', () => {
    Menu.setApplicationMenu(Menu.buildFromTemplate(mainWindowMenu));
  });
}

const createCheckoutWindow = () => {
  checkoutWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true
    }
  });

  checkoutWindow.loadURL(url.format({
    pathname: path.join(__dirname, '/pages/checkoutWindow/index.html'),
    protocol: 'file:',
    slashes: true
  }));

  checkoutWindow.maximize()

  checkoutWindow.on('close', () => {
    checkoutWindow = null;
  });

  checkoutWindow.on('focus', () => {
    Menu.setApplicationMenu(Menu.buildFromTemplate(checkoutWindowMenu));
  });
};



// const createStockWindow = () => {
//   stockWindow = new BrowserWindow({});
//   stockWindow.loadURL(url.format({
//     pathname: path.join(__dirname, '/pages/stockWindow/index.html'),
//     protocol: 'file:',
//     slashes: true
//   }));

//   stockWindow.on('close', () => {
//     stockWindow = null;
//   });

//   stockWindow.on('focus', () => {
//     Menu.setApplicationMenu(Menu.buildFromTemplate(stockWindowMenu));
//   });
// };

app.on('ready', () => {

  if (!store.get('items')) {
    store.set('items', []);
  }

  if (!store.get('customers')) {
    store.set('customers', {});
  }

  const todayDate = dateConverter(new DateTime());
  const allCustomers = store.get('customers');
  const todaysCustomer = allCustomers[todayDate];

  if (!todaysCustomer) {
    const newTodaysCustomer = [];
    const updatedAllCustomers = {
      ...allCustomers
    };
    updatedAllCustomers[todayDate] = [];

    store.set('customers', updatedAllCustomers);
  }

  createMainWindow()
  createCheckoutWindow()
});

ipcMain.on('item:generateStockListPdf', async (e, title, items) => {
  try {
    const filePath = await generateStockListPdf(title, items)
    mainWindow.webContents.send('item:generateStockListPdf', true, filePath);
    checkoutWindow?.webContents.send('item:generateStockListPdf', true, filePath);
  } catch (error) {
    mainWindow.webContents.send('item:generateStockListPdf', false);
    checkoutWindow?.webContents.send('item:generateStockListPdf', false);
  }
});

ipcMain.on('folder:open', async (e, path) => {
  // shell.openPath(path)
  console.log('path >>', path)
});

ipcMain.on('item:fetchAll', () => {
  mainWindow.webContents.send('item:fetchAll', store.get('items'));
  checkoutWindow?.webContents.send('item:fetchAll', store.get('items'));
});

function calculateAverageBuyPrice (oldStockCount, oldBuyPrice, newStockCount, newBuyPrice) {
  const oldStockTotalPrice = oldStockCount * oldBuyPrice
  const newStockTotalPrice = newStockCount * newBuyPrice
  return parseFloat(((oldStockTotalPrice + newStockTotalPrice) / (oldStockCount + newStockCount)).toFixed(2))
}

ipcMain.on('item:addAll', (e, items) => {
  const unlisted =[];
  items.forEach(item => {
    let isItemNotListed = true;
    const listItems = store.get('items');
    listItems.forEach(stock => {
      if (stock.id == item.id) {
        stock.stock += item.stock;
        stock.price = item.price;

        if (!stock.buyPrice || stock.buyPrice === 0) {
          stock.buyPrice = item.buyPrice
        } else if (!item.buyPrice || item.buyPrice === 0) {
          stock.buyPrice = stock.buyPrice
        } else {
          stock.buyPrice = calculateAverageBuyPrice(stock.stock, stock.buyPrice, item.stock, item.buyPrice)
        }

        isItemNotListed = false;
      }
    });

    if (isItemNotListed) {
      unlisted.push(item);
    }
  });

  store.set('items', [
    ...store.get('items'),
    ...unlisted
  ]);
});

ipcMain.on('item:update', (e, items) => {
  store.set('items', items);
});

const dateConverter = (timestamp) => {
  const date = new DateTime(timestamp);
  return date.format('DD_MM_YYYY_dddd')
}

const receiptIdGenerator = () => {
  const date = new DateTime();
  return date.format('DDMMYYYY')
}

ipcMain.on('customer:new', (e, newCustomer) => {
  const timestamp = new DateTime();
  const day = dateConverter(timestamp);
  const customers = store.get('customers');

  if (!customers[day]) {
    customers[day] = [
      {
        id: `${receiptIdGenerator()}-1`,
        datetime: timestamp.time,
        ...newCustomer
      }
    ]
  } else {
    customers[day].push(
      {
        id: `${receiptIdGenerator()}-${customers[day].length + 1}`,
        datetime: timestamp,
        ...newCustomer
      }
    )
  }

  store.set('customers', customers);
});

ipcMain.on('customer:fetchAll', () => {
  const customers = store.get('customers');
  mainWindow.webContents.send('customer:fetchAll', customers);
  checkoutWindow?.webContents.send('customer:fetchAll', customers);
});

async function generateReceipt (customer) {
  return await generatePdf('resit', { ...customer, title: customer.id, tarikh: getFormattedDate(customer.datetime), masa: getFormattedTime(customer.datetime) })
}

ipcMain.on('customer:receipt', async (e, customer) => {
  try {
    const path = await generateReceipt(customer)
    mainWindow.webContents.send('customer:receipt', true, path);
    checkoutWindow?.webContents.send('customer:receipt', true, path);
  } catch (error) {
    mainWindow.webContents.send('customer:receipt', false);
    checkoutWindow?.webContents.send('customer:receipt', false);
  }
});

const mainWindowMenu = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Checkout',
        click () {
          createCheckoutWindow();
        }
      },
      {
        label: 'Stock'
      },
      {
        label: 'Quit',
        accelerator: 'Ctrl+Q',
        click () {
          app.quit();
        }
      }
    ]
  },
  {
    label: 'View',
    submenu: [
      {
        role: 'reload'
      }
    ]
  },
  {
    label: 'Dev Tools',
    click (item, focusedWindow) {
      focusedWindow.toggleDevTools();
    }
  }
];

const checkoutWindowMenu = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Clear'
      }
    ]
  },
  {
    label: 'View',
    submenu: [
      {
        role: 'reload'
      }
    ]
  },
  {
    label: 'Dev Tools',
    click (item, focusedWindow) {
      focusedWindow.toggleDevTools();
    }
  }
];

const stockWindowMenu = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Clear'
      }
    ]
  },
  {
    label: 'View',
    submenu: [
      {
        role: 'reload'
      }
    ]
  },
  {
    label: 'Dev Tools',
    click (item, focusedWindow) {
      focusedWindow.toggleDevTools();
    }
  }
];