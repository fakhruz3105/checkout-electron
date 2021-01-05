const electron = require('electron');
const url = require('url');
const path = require('path');
const Store = require('./store');
const { Menu } = require('electron');

const { app, BrowserWindow, ipcMain } = electron;

process.env.NODE_ENV = 'production';

let mainWindow;
let checkoutWindow;
let stockWindow;

const store = new Store({
  configName: 'database',
  defaults: {
    items: []
  }
});

app.on('ready', () => {

  if (!store.get('items')) {
    store.set('items', []);
  }

  if (!store.get('customers')) {
    store.set('customers', {});
  }

  const todayDate = dateConverter(new Date());
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
});

const createCheckoutWindow = () => {
  checkoutWindow = new BrowserWindow({});
  checkoutWindow.loadURL(url.format({
    pathname: path.join(__dirname, '/pages/checkoutWindow/index.html'),
    protocol: 'file:',
    slashes: true
  }));

  checkoutWindow.on('close', () => {
    checkoutWindow = null;
  });

  checkoutWindow.on('focus', () => {
    Menu.setApplicationMenu(Menu.buildFromTemplate(checkoutWindowMenu));
  });
};

const createStockWindow = () => {
  stockWindow = new BrowserWindow({});
  stockWindow.loadURL(url.format({
    pathname: path.join(__dirname, '/pages/stockWindow/index.html'),
    protocol: 'file:',
    slashes: true
  }));

  stockWindow.on('close', () => {
    stockWindow = null;
  });

  stockWindow.on('focus', () => {
    Menu.setApplicationMenu(Menu.buildFromTemplate(stockWindowMenu));
  });
};

ipcMain.on('item:fetchAll', () => {
  mainWindow.webContents.send('item:fetchAll', store.get('items'));
});

ipcMain.on('item:addAll', (e, items) => {
  const unlisted =[];
  items.forEach(item => {
    let isItemNotListed = true;
    const listItems = store.get('items');
    listItems.forEach(stock => {
      if (stock.id == item.id) {
        stock.stock += item.stock;
        stock.price = item.price;
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
  const dayName = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jummat', 'Sabtu'];
  const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const date = new Date(timestamp);
  const day = dayName[date.getDay()];
  const month = monthName[date.getMonth()];
  const dayDate = ('0' + date.getDate().toString()).slice(-2);
  const year = date.getFullYear();
  return `${dayDate}_${month}_${year}_${day}`;
}

const receiptIdGenerator = () => {
  const date = new Date();
  const day = ('0' + date.getDate().toString()).slice(-2);
  const month = (('0' + date.getMonth() + 1).toString()).slice(-2);
  const year = date.getFullYear();
  return day + month + year;
}

ipcMain.on('customer:new', (e, newCustomer) => {
  const timestamp = new Date();
  const day = dateConverter(timestamp);
  const customers = store.get('customers');

  if (!customers[day]) {
    customers[day] = [
      {
        id: `${receiptIdGenerator()}-1`,
        datetime: timestamp,
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