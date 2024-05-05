const { ipcRenderer } = require('electron');
const { DateTime } = require('../../DateTime')

const app = new Vue({
  data: {
    page: 'stock-list',
    items: [],
    customers: {},
    customersFetched: true,
    checkoutItems: [],
    newStockItems: [],
    viewedReceipt: {},
    borrowers: {},
    search: '',
    selectedItemId: '',
    showCheckoutModal: false,
    showAddStockModal: false,
    showEditStockModal: false,
    showReceiptModal: false,
    showAllReceipt: false,
    choosePayment: false,
    cashPayment: true,
    selectedBorrower: '',
  },
  computed: {
    borrowersOptions () {
      return Object.keys(this.borrowers)
    },
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
      const date = new DateTime();
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
    selectPaymentType () {
      if (this.checkoutItems.length > 0) {
        this.cashPayment = true
        this.choosePayment = true
        this.selectedBorrower = ''
      }
    },
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
      const date = new DateTime(timestamp);
      return date.format('HH:mm:ss')
    },
    getFormattedDate (timestamp) {
      const date = new DateTime(timestamp);
      return date.format('DD_MM_YYYY_dddd')
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
    getTotalForTheDay (formattedDate) {
      const customersForTheDay = this.getReceiptsForSpecificDay(formattedDate);
      let total = 0;
      customersForTheDay.forEach(receipt => total += receipt.total);
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
      this.customersFetched = false;
      ipcRenderer.send('customer:fetchAll');
    },
    fetchAllBorrowers () {
      ipcRenderer.send('borrowers:list');
    },
    editItem (id) {
      this.selectedItemId = id;
      this.showEditStockModal = true;
    },
    getTotal (item) {
      return +item.stock * +item.price;
    },
    getProfit (item, count) {
      if (!item.buyPrice || item.buyPrice === 0) {
        // Set by default 10% profit
        const profitForEachItem = parseFloat((+item.price * 0.1).toFixed(2))
        return profitForEachItem * count
      } else {
        const profitForEachItem = parseFloat((+item.price - +item.buyPrice).toFixed(2))
        return profitForEachItem * count
      }
    },
    getAbsoluteTotal () {
      let sum = 0;
      this.checkoutItems.forEach(item => {
        sum += +this.getTotal(item);
      });
      return sum;
    },
    getProfitTotal () {
      let sumProfit = 0;
      this.checkoutItems.forEach(item => {
        sumProfit += this.getProfit(item, item.stock);
      });
      return sumProfit;
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
                  stockItem.sold += item.stock;
                  const profit = this.getProfit(stockItem, item.stock)
                  stockItem.profit = parseFloat((stockItem.profit + profit).toFixed(2))
                }
              });
            }
          });
          ipcRenderer.send('customer:new', {
            items: this.checkoutItems,
            total: this.getAbsoluteTotal(),
            profit: this.getProfitTotal(),
            borrowerName: !this.cashPayment ? this.selectedBorrower : null
          });
          ipcRenderer.send('item:update', this.items);
          this.fetchAll();
          this.fetchAllCustomers();
          this.fetchAllBorrowers();
          await new Promise((resolve) => {
            setInterval(() => {
              if (this.customersFetched) {
                resolve();
              }
            }, 100);
          });
          this.viewedReceipt = this.getLastReceipt;
          this.showReceiptModal = true;
          this.choosePayment = false;
          this.checkoutItems = []
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
        buyPrice: 0
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
          if (!item.id || !item.name || !item.stock || !item.price || item.id == '' || item.name == '') {
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
      this.customersFetched = true;
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
    ipcRenderer.on('customer:receipt', (e, success, filePath) => {
      if (!success) {
        alert('Error on generating receipt') 
      }
      ipcRenderer.send('folder:open', filePath)
    });
    ipcRenderer.on('borrowers:list', (_, borrowers) => {
      this.borrowers = borrowers
    });
  },
  beforeMount () {
    this.fetchAll();
    this.fetchAllCustomers();
    this.fetchAllBorrowers();
  },
  mounted () {
  }
}).$mount('#app');
