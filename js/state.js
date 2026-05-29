export const VENDOR_DEFAULT_SETTINGS = {
    'NCmall':  { shipping: 2800, freeThreshold: 70000 },
    'NOPACK':  { shipping: 2970, freeThreshold: 55000 },
    '혜림봉투': { shipping: 2750, freeThreshold: 60000 },
    '박스몰':  { shipping: 3190, freeThreshold: 77000 },
    'PJPACK':  { shipping: 3000, freeThreshold: 30000 },
    '도매매':  { shipping: 3000, freeThreshold: 0 }
};

export const state = {
    currentUser: null,
    isApproved: false,
    products: [],
    inspectList: [],
    orderHistory: [],
    vendorSettings: {},
    vendorOrder: [],
    currentOrderProductId: null,
    unsubscribeData: null,
    editingProductId: null,
    stockSortOrder: 'none',
    currentProductPage: 1,
    selectedProductIds: new Set(),
};
