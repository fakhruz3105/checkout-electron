const { ipcRenderer, ipcMain } = require('electron');

const app = new Vue({
  data: {
    page: 'stock-list',
    items: [],
    customers: {},
    checkoutItems: [],
    newStockItems: [],
    viewedReceipt: {},
    search: '',
    selectedItemId: '',
    showCheckoutModal: false,
    showAddStockModal: false,
    showEditStockModal: false,
    showReceiptModal: false,
    showAllReceipt: false
  },
  computed: {
    outOfStockItems () {
      return this.filteredItems.filter(item => item.stock < 10)
    },
    filteredItems () {
      return this.items.filter(item => JSON.stringify(item).toLowerCase().includes(this.search.toLowerCase()));
    },
    getCheckoutItems () {
      return this.checkoutItems;
    },
    getNewStockItems () {
      return this.newStockItems;
    },
    getSelectedStockItem () {
      return this.items.filter(item => item.id == this.selectedItemId)[0];
    },
    getTodayDate () {
      const date = new Date();
      return this.getFormattedDate(date);
    },
    getTodaysReceipts () {
      return this.customers[this.getTodayDate];
    },
    getLastReceipt () {
      if (this.getTodaysReceipts) {
        return this.getTodaysReceipts[this.getTodaysReceipts.length - 1];
      } else {
        return null;
      }
    },
    getAllDaysShopOpen () {
      return Object.keys(this.customers).reverse();
    }
  },
  methods: {
    closeAnyModal () {
      this.showEditStockModal = false;
      this.showReceiptModal = false;
      this.showCheckoutModal = false;
      this.showAddStockModal = false;
    },
    viewReceipt (receipt) {
      this.viewedReceipt = receipt;
      this.showReceiptModal = true;
    },
    getFormattedTime (timestamp) {
      const date = new Date(timestamp);
      const hours = date.getHours();
      const min = date.getMinutes();
      const sec = ('0' + date.getSeconds()).slice(-2);
      return `${hours}:${min}:${sec}`;
    },
    getFormattedDate (timestamp) {
      const dayName = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jummat', 'Sabtu'];
      const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const date = new Date(timestamp);
      const day = dayName[date.getDay()];
      const month = monthName[date.getMonth()];
      const dayDate = ('0' + date.getDate().toString()).slice(-2);
      const year = date.getFullYear();
      return `${dayDate}_${month}_${year}_${day}`;
    },
    getReceiptsForSpecificDay (formattedDate) {
      return this.customers[formattedDate].filter(customer => customer.id.includes(this.search));
    },
    getReceiptsForSpecificDayInReverse (formattedDate) {
      const receiptsInReverse = [...this.getReceiptsForSpecificDay(formattedDate)];
      return receiptsInReverse.reverse();
    },
    getReceipt (formattedDate) {
      const today = this.getReceiptsForSpecificDay(formattedDate);
      if (today) {
        return today[today.length - 1];
      } else {
        return null;
      }
    },
    getTotalSaleForTheDay (formattedDate) {
      const customersForTheDay = this.getReceiptsForSpecificDay(formattedDate);
      let total = 0;
      customersForTheDay.forEach(receipt => total += receipt.total);
      return total;
    },
    getTotalProfitForTheDay (formattedDate) {
      const customersForTheDay = this.getReceiptsForSpecificDay(formattedDate);
      let total = 0;
      customersForTheDay.forEach(receipt => total += (receipt.profit || 0));
      return total;
    },
    generateOutOfStockListPdf () {
      if (this.outOfStockItems.length > 0) ipcRenderer.send('item:generateStockListPdf', 'Senarai Kehabisan Stock', this.outOfStockItems)
    },
    generateAllStockListPdf () {
      if (this.items.length > 0) ipcRenderer.send('item:generateStockListPdf', 'Senarai Stock', this.items)
    },
    generateReceipt () {
      if (this.viewedReceipt) ipcRenderer.send('customer:receipt', this.viewedReceipt)
    },
    fetchAll () {
      ipcRenderer.send('item:fetchAll');
    },
    fetchAllCustomers () {
      ipcRenderer.send('customer:fetchAll');
    },
    editItem (id) {
      this.selectedItemId = id;
      this.showEditStockModal = true;
    },
    getTotal (item) {
      return +item.stock * +item.price;
    },
    getAbsoluteTotal () {
      let sum = 0;
      this.checkoutItems.forEach(item => {
        sum += +this.getTotal(item);
      });
      return sum;
    },
    addToCheckout () {
      const itemId = this.$refs.itemId.value;
      const amount = +this.$refs.amount.value || 1;
      const itemInCheckoutList = this.checkoutItems.filter(item => item.id == itemId)[0];
      if (itemInCheckoutList) {
        this.checkoutItems.forEach(item => {
          if (item.id == itemId) {
            item.stock += amount;
            this.$refs.itemId.value = '';
            this.$refs.amount.value = null;
            this.$refs.itemId.focus();
          }
        })
      } else {
        const selectedItem = this.items.filter(item => item.id == itemId)[0];
        if (selectedItem) {
          this.checkoutItems.push({
            ...selectedItem,
            stock: amount
          });
          this.$refs.itemId.value = '';
          this.$refs.amount.value = null;
          this.$refs.itemId.focus();
        }
      }
    },
    addUnlistedItemToCheckout () {
      const itemName = this.$refs.itemName.value;
      const price = +this.$refs.price.value;

      if (!!itemName && itemName !== '' && !!price && price !== 0) {
        this.checkoutItems.push({
          id: '-',
          name: itemName,
          stock: 1,
          price
        });
        this.$refs.itemName.value = null;
        this.$refs.price.value = null;
      }
    },
    async openCheckoutModal () {
      this.checkoutItems = [];
      this.showCheckoutModal = true;
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 200);
      });
      this.$refs.itemId.focus();
      ipcRenderer.send('window:checkout')
    },
    closeCheckoutModal () {
      if (this.checkoutItems.length === 0) {
        this.showCheckoutModal = false;
      } else {
        if (confirm('Tutup checkout?')) {
          this.showCheckoutModal = false;
        }
      }
    },
    removeCheckoutItem (index) {
      this.checkoutItems.splice(index, 1);
    },
    async checkout () {
      if (this.checkoutItems.length > 0) {
        if (confirm('Teruskan checkout?')) {
          this.checkoutItems.forEach(item => {
            if (item.id !== '-') {
              this.items.forEach(stockItem => {
                if (item.id == stockItem.id) {
                  stockItem.stock -= item.stock;
                }
              });
            }
          });
          ipcRenderer.send('customer:new', {
            items: this.checkoutItems,
            total: this.getAbsoluteTotal()
          });
          ipcRenderer.send('item:update', this.items);
          this.fetchAll();
          this.fetchAllCustomers();
          await new Promise((resolve) => {
            setTimeout(() => {
              resolve();
            }, 200);
          });
          this.showCheckoutModal = false;
          this.viewedReceipt = this.getLastReceipt;
          this.showReceiptModal = true;
        }
      }
    },
    async openAddStockModal () {
      this.newStockItems = [{
        id: '',
        name: '',
        stock: 0,
        price: 0
      }];
      this.showAddStockModal = true;
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 200);
      });
    },
    closeAddStockModal () {
      if (this.newStockItems.length === 0) {
        this.showAddStockModal = false
      } else {
        if (confirm('Tutup tambah stock?')) {
          this.showAddStockModal = false
        }
      }
    },
    checkIfItemIsInStock (index) {
      const itemId = this.newStockItems[index].id;
      const item = this.items.filter(item => item.id == itemId)[0];
      if (item) {
        this.newStockItems[index].name = item.name;
        this.newStockItems[index].price = item.price;
      }
      this.addToNewStock()
    },
    addToNewStock () {
      this.newStockItems.push({
        id: '',
        name: '',
        stock: 0,
        price: 0,
        sold: 0,
        profit: 0
      });
    },
    removeNewStockItem (index) {
      this.newStockItems.splice(index, 1);
    },
    addStock () {
      if (confirm('Teruskan?')) {
        const listToBeAdded = this.newStockItems.filter(item => {
          return !(!item.id && !item.name && !item.stock && !item.price && item.id == '' && item.name == '')
        })

        for (const item of listToBeAdded) {
          if (!item.id || !item.name || !item.stock || !item.price || item.id === '' || item.name === '') {
            alert('Sila isi semua tempat!');
            return;
          }
        }
        ipcRenderer.send('item:addAll', listToBeAdded);
        this.fetchAll();
        this.showAddStockModal = false;
      }
    },
    closeEditStockModal () {
      this.showEditStockModal = false;
    },
    editStock () {
      if (confirm('Teruskan?')) {
        this.items.forEach(item => {
          if (item.id == this.selectedItemId) {
            const amount = +this.$refs.selectedItemAmount.value;
            const name = this.$refs.selectedItemName.value;
            const price = +this.$refs.selectedItemPrice.value;

            item.stock = !!amount || amount !== '' ? amount : item.stock;
            item.name = !!name || name !== '' ? name : item.name;
            item.price = !!price || price !== '' ? price : item.price;
            item.sold = !item.sold ? 0 : item.sold
            item.profit = !item.profit ? 0 : item.profit
          }
        });
        ipcRenderer.send('item:update', this.items);
        this.fetchAll();
        this.showEditStockModal = false;
      }
    },
    deleteStock () {
      if (confirm('Teruskan?')) { 
        this.items = this.items.filter(item => item.id != this.selectedItemId);
        ipcRenderer.send('item:update', this.items);
        this.fetchAll();
        this.showEditStockModal = false;
      }
    },
    openReceiptModal () {
      this.showReceiptModal = true;
    },
    closeReceiptModal () {
      this.showReceiptModal = false;
    }
  },
  created () {
    ipcRenderer.on('item:fetchAll', (e, items) => {
      this.items = items;
    });
    ipcRenderer.on('customer:fetchAll', (e, customers) => {
      this.customers = customers;
    });
    ipcRenderer.on('item:generateStockListPdf', (e, success, filePath) => {
      if (!success) {
        alert('Error on generating pdf') 
      }
      ipcRenderer.send('folder:open', filePath)
    });
    ipcRenderer.on('customer:receipt', (e, success, filePath) => {
      if (!success) {
        alert('Error on generating receipt') 
      }
      ipcRenderer.send('folder:open', filePath)
    });
  },
  beforeMount () {
    this.fetchAll();
    this.fetchAllCustomers();
  },
  mounted () {
  }
}).$mount('#app');
