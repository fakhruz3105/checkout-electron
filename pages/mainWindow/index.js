const { ipcRenderer } = require('electron');
const { DateTime } = require('../../DateTime')

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
    showAllReceipt: false,
    sortingProperty: 'id',
    sortingOrder: true, // true mean ascending false mean descending
    receiptDay: '',
    analyticDayFrom: '',
    analyticDayTo: '',
    finance: [],
    financialStatementFrom: '',
    financialStatementTo: '',
    showFinanceStatementModal: false,
    financialStatement: {
      id: null,
      description: '',
      value: 0,
      metadata: {
        updateable: true
      },
      timestamp: new DateTime().time,
      created: new DateTime().time,
      updated: new DateTime().time
    },
    borrowers: {},
    showAddBorrowerModal: false,
    newBorrower: {
      name: '',
      pastRecord: 0
    },
    showPaymentModal: false,
    newPayment: 0
  },
  computed: {
    listOfBorrowers () {
      return Object.keys(this.borrowers).map(key => {
        const pastRecord = this.borrowers[key].pastRecord
        const currentRecord = this.borrowers[key].receipts.map(receipt => receipt.total).reduce((a, b) => a + b, 0)
        const paid = this.borrowers[key].payments.map(p => p.total).reduce((a, b) => a + b, 0)
        const totalBorrowed = (pastRecord + currentRecord) - paid
        return {
          name: key,
          totalBorrowed
        }
      })
    },
    selectedBorrowerName () {
      if (!this.page.startsWith('borrower-id')) return null
      const [_a, _b, borrowerId] = this.page.split('-')
      return borrowerId
    },
    selectedBorrower () {
      if (!this.selectedBorrowerName) return null
      return this.borrowers[this.selectedBorrowerName]
    },
    selectedBorrowerReceipts () {
      return this.selectedBorrower.receipts.sort((a, b) => b.datetime - a.datetime)
    },
    selectedBorrowerReceiptsTotal () {
      return this.selectedBorrower.receipts.map(r => r.total).reduce((a, b) => a + b, 0)
    },
    selectedBorrowerPayments () {
      return this.selectedBorrower.payments.sort((a, b) => b.time - a.time)
    },
    selectedBorrowerPaymentsTotal () {
      return this.selectedBorrower.payments.map(r => r.total).reduce((a, b) => a + b, 0)
    },
    selectedBorrowerTotalBorrowed () {
      if (!this.selectedBorrower) return 0
      const pastRecord = this.selectedBorrower.pastRecord
      const currentRecord = this.selectedBorrower.receipts.map(receipt => receipt.total).reduce((a, b) => a + b, 0)
      const paid = this.selectedBorrower.payments.map(p => p.total).reduce((a, b) => a + b, 0)
      return (pastRecord + currentRecord) - paid
    },
    outOfStockItems () {
      return this.filteredItems.filter(item => item.stock < 10)
    },
    filteredItems () {
      return this.items
        .filter(item => JSON.stringify(item).toLowerCase().includes(this.search.toLowerCase()))
        .sort((a, b) => {
          if (typeof a[this.sortingProperty] === 'string') {
            if (this.sortingProperty === 'id') {
              return this.sortingOrder ? a[this.sortingProperty].length - b[this.sortingProperty].length || a[this.sortingProperty].localeCompare(b[this.sortingProperty]) : b[this.sortingProperty].length - a[this.sortingProperty].length || b[this.sortingProperty].localeCompare(a[this.sortingProperty])
            }

            return this.sortingOrder ? a[this.sortingProperty].localeCompare(b[this.sortingProperty]) : b[this.sortingProperty].localeCompare(a[this.sortingProperty])
          } else {
            return this.sortingOrder ? a[this.sortingProperty] - b[this.sortingProperty] : b[this.sortingProperty] - a[this.sortingProperty]
          }
        })
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
      const days = Object.keys(this.customers)
      days.reverse()
      return days
    },
    getReceiptsForSpecificDay () {
      return this.customers[this.receiptDay].filter(customer => customer.id.includes(this.search));
    },
    getReceiptsForSpecificDayInReverse () {
      const receiptsInReverse = [...this.getReceiptsForSpecificDay];
      receiptsInReverse.reverse();
      return receiptsInReverse;
    },
    getTotalSaleForTheDay () {
      const customersForTheDay = this.getReceiptsForSpecificDay;
      let total = 0;
      customersForTheDay.forEach(receipt => total += receipt.total);
      return total;
    },
    getTotalProfitForTheDay () {
      const customersForTheDay = this.getReceiptsForSpecificDay;
      let total = 0;
      customersForTheDay.forEach(receipt => total += (receipt.profit || 0));
      return total;
    },
    analyticDayFromOptions () {
      return Object.keys(this.customers)
    },
    analyticDayToOptions () {
      const fromIndex = this.analyticDayFromOptions.indexOf(this.analyticDayFrom)
      if (fromIndex === -1) return []
      else return this.analyticDayFromOptions.slice(fromIndex)
    },
    dataForAnalytics () {
      const fromIndex = this.analyticDayFromOptions.indexOf(this.analyticDayFrom)
      const toIndex = this.analyticDayFromOptions.indexOf(this.analyticDayTo)
      const datesIncluded = this.analyticDayFromOptions.slice(fromIndex, toIndex + 1)

      let data = []
      datesIncluded.forEach(date => {
        data = [...data, ...this.customers[date]]
      })

      return data
    },
    analyticTotalSales () {
      const res = this.dataForAnalytics.map(e => e.total).reduce((a, b) => {
        return parseFloat((a + b).toFixed(2))
      }, 0)
      return res.toFixed(2)
    },
    analyticTotalProfits () {
      const res = this.dataForAnalytics.map(e => e.profit).reduce((a, b) => {
        return parseFloat((a + b).toFixed(2))
      }, 0)
      return res.toFixed(2)
    },
    analyticSoldItemsCount () {
      let items = [] 
      this.dataForAnalytics.forEach(customer => {
        items = [...items, ...customer.items]
      })
      const soldItems = items.filter(item => item.id !== '-')
      const soldItemsCount = {}
      soldItems.forEach(item => {
        let count = soldItemsCount[item.id] || 0
        soldItemsCount[item.id] = count + item.stock
      })
      return soldItemsCount
    },
    analyticMostSoldItems () {
      const mostSoldItems = Object.keys(this.analyticSoldItemsCount).map(id => {
        const item = this.items.find(item => item.id === id)
        return {
          id,
          name: item.name,
          sold: this.analyticSoldItemsCount[id]
        }
      }).sort((a, b) => b.sold - a.sold)
      return mostSoldItems.slice(0, 15)
    },
    analyticMostProfitableItems () {
      const mostSoldItems = Object.keys(this.analyticSoldItemsCount).map(id => {
        const item = this.items.find(item => item.id === id)
        const profitPerItem = item.sold || item.sold === 0 ? (item.price / 1.1) * 0.1 : item.price - item.sold
        const profit = profitPerItem * this.analyticSoldItemsCount[id]
        return {
          id,
          name: item.name,
          profit
        }
      }).sort((a, b) => b.profit - a.profit)
      return mostSoldItems.slice(0, 15)
    },
    financialStatementFromTime () {
      if (!this.financialStatementFrom) {
        return 0
      }
      return new DateTime(this.financialStatementFrom).time
    },
    financialStatementToTime () {
      const selectedDate = new DateTime(this.financialStatementTo).add(1, 'day').time
      if (!this.financialStatementTo || selectedDate < this.financialStatementFromTime) {
        return new DateTime().time
      }
      return selectedDate
    },
    financialStatementDate () {
      return new DateTime(this.financialStatement.timestamp).format('YYYY-MM-DD')
    },
    currentMoneyTotal () {
      return this.finance.map(e => e.value).reduce((a, b) => {
        return parseFloat((a + b).toFixed(2))
      }, 0)
    },
    financeFiltered () {
      return this.finance
        .filter(statement => {
          return statement.timestamp >= this.financialStatementFromTime && statement.timestamp < this.financialStatementToTime
        })
        .map(statement => {
          const date = new DateTime(statement.timestamp).format('DD-MM-YYYY')
          return {
            ...statement,
            absValue: Math.abs(statement.value),
            date
          }
        })
        .sort((a, b) => {
          return b.timestamp - a.timestamp || b.created - a.created
        })
    }
  },
  watch: {
    analyticDayFrom () {
      this.analyticDayTo = this.analyticDayFrom
    }
  },
  methods: {
    saveNewPayment () {
      if (!this.selectedBorrowerName) return
      ipcRenderer.send('borrowers:pay', this.selectedBorrowerName, this.newPayment)
      this.closePaymentModal()
    },
    closePaymentModal () {
      this.newPayment = 0
      this.showPaymentModal = false
    },
    selectBorrower (name) {
      this.page = `borrower-id-${name}`
    },
    saveNewBorrower () {
      ipcRenderer.send('borrowers:new', this.newBorrower.name, this.newBorrower.pastRecord)
      this.fetchAllBorrowers()
      this.closeAddBorrower()
    },
    closeAddBorrower () {
      this.showAddBorrowerModal = false
      this.newBorrower = {
        name: '',
        pastRecord: 0
      }
    },
    setFinancialStatementDate (date) {
      this.financialStatement.timestamp = new DateTime(date).time
    },
    closeFinanceModal () {
      this.showFinanceStatementModal = false
      this.financialStatement = {
        id: null,
        description: '',
        value: 0,
        metadata: {
          updateable: true
        },
        timestamp: new DateTime().time,
        created: new DateTime().time,
        updated: new DateTime().time
      }
    },
    editFinancialStatement (finance) {
      this.financialStatement = {
        id: finance.id,
        description: finance.description,
        value: finance.value,
        metadata: finance.metadata,
        timestamp: finance.timestamp,
        created: finance.created,
        updated: finance.updated
      }
      this.showFinanceStatementModal = true
    },
    saveFinancialStatement () {
      const id = this.financialStatement.id
      if (id) {
        this.finance = this.finance.map(statement => {
          if (statement.id === id) {
            statement = {
              ...statement,
              description: this.financialStatement.description,
              value: this.financialStatement.value,
              metadata: this.financialStatement.metadata,
              timestamp: this.financialStatement.timestamp,
              created: this.financialStatement.created,
              updated: this.financialStatement.updated
            }
            return statement
          }

          return statement
        })
      } else {
        this.finance.push({
          id: Math.random().toString(16).slice(2),
          description: this.financialStatement.description,
          value: this.financialStatement.value,
          metadata: this.financialStatement.metadata,
          timestamp: this.financialStatement.timestamp,
          created: new DateTime().time,
          updated: new DateTime().time
        })
      }
      ipcRenderer.send('finance:update', this.finance)
      this.closeFinanceModal()
    },
    deleteFinancialStatement () {
      const id = this.financialStatement.id
      this.finance = this.finance.filter(statement => statement.id !== id)
      ipcRenderer.send('finance:update', this.finance)
      this.closeFinanceModal()
    },
    changePage (page) {
      this.page = page
      this.search = ''
      this.analyticDayFrom = ''
      if (page === 'receipt-list') {
        this.showAllReceipt = false
      }
    },
    sortBy (property) {
      if (property === this.sortingProperty) {
        this.sortingOrder = !this.sortingOrder
      } else {
        this.sortingProperty = property
        this.sortingOrder = true
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
    getFormattedDateTime (timestamp) {
      const date = new DateTime(timestamp);
      return date.format('DD/MM/YYYY (HH:mm:ss)')
    },
    getFormattedDate (timestamp) {
      const date = new DateTime(timestamp);
      return date.format('DD_MM_YYYY_dddd')
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
    fetchAllFinances () {
      ipcRenderer.send('finance:fetchAll');
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
    async openAddStockModal () {
      this.newStockItems = [{
        id: '',
        name: '',
        stock: 0,
        price: 0,
        sold: 0,
        profit: 0
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
    checkIfItemIsInStock (event, index) {
      const itemId = event.target.value;

      this.newStockItems[index].id = itemId;
      
      const item = this.items.find(item => item.id == itemId);
      if (item) {
        this.newStockItems[index].name = item.name;
        this.newStockItems[index].price = item.price;
      }

      if (index === this.newStockItems.length - 1) {
        this.addToNewStock()
      }
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
    },
    addNewStatementForTodaySales () {
      ipcRenderer.send('finance:update-today-statement')
    }
  },
  created () {
    ipcRenderer.on('item:fetchAll', (e, items) => {
      this.items = items;
    });
    ipcRenderer.on('customer:fetchAll', (e, customers) => {
      this.customers = customers;
      this.receiptDay = Object.keys(customers).reverse()[0]
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
    ipcRenderer.on('finance:fetchAll', (e, finance) => {
      this.finance = finance
    });
    ipcRenderer.on('borrowers:list', (e, borrowers) => {
      this.borrowers = borrowers
    });
  },
  beforeMount () {
    this.fetchAll();
    this.fetchAllCustomers();
    this.fetchAllFinances();
    this.fetchAllBorrowers();
  },
  mounted () {
  }
}).$mount('#app');
