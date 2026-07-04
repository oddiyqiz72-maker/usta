// games -> "O'yinlar" bo'limi, apps -> "App" bo'limi
// icon: /public/images/ papkasidagi rasm fayli nomi (haqiqiy logotiplarni shu joyga qo'yasiz)
// idLabel: checkout ekranida "Player ID" o'rniga qanday matn ko'rsatilsin

module.exports = {
  games: [
    {
      id: 'pubg',
      title: 'PUBG Mobile',
      icon: '/images/pubg.svg',
      idLabel: 'Player ID',
      needsServerId: false,
      products: [
        { id: 'pubg_30', title: '30 UC', price: 5750, icon: '/images/uc.svg' },
        { id: 'pubg_60', title: '60 UC', price: 11500, icon: '/images/uc.svg' },
        { id: 'pubg_300', title: '300 + 25 UC', price: 57500, icon: '/images/uc.svg' },
        { id: 'pubg_600', title: '600 + 60 UC', price: 115000, icon: '/images/uc.svg' },
        { id: 'pubg_1500', title: '1500 + 300 UC', price: 460000, icon: '/images/uc.svg' },
        { id: 'pubg_3000', title: '3000 + 850 UC', price: 920000, icon: '/images/uc.svg' },
      ],
    },
    {
      id: 'mlbb',
      title: 'Mobile Legends',
      icon: '/images/mlbb.svg',
      idLabel: 'Player ID',
      needsServerId: true,
      products: [
        { id: 'ml_78', title: '78 + 8 Diamond', price: 15385, icon: '/images/diamond.svg' },
        { id: 'ml_weekly', title: 'Weekly Diamond Pass', price: 19020, icon: '/images/diamond.svg' },
        { id: 'ml_55x2', title: '55 Diamond 2x', price: 9766, icon: '/images/diamond.svg' },
        { id: 'ml_165x2', title: '165 Diamond 2x', price: 29260, icon: '/images/diamond.svg' },
        { id: 'ml_275x2', title: '275 Diamond 2x', price: 46924, icon: '/images/diamond.svg' },
        { id: 'ml_565x2', title: '565 Diamond 2x', price: 96358, icon: '/images/diamond.svg' },
        { id: 'ml_156', title: '156 + 16 Diamond', price: 30527, icon: '/images/diamond.svg' },
        { id: 'ml_234', title: '234 + 23 Diamond', price: 44224, icon: '/images/diamond.svg' },
      ],
    },
    {
      id: 'standoff',
      title: 'Standoff 2',
      icon: '/images/standoff.svg',
      idLabel: 'Player ID',
      needsServerId: false,
      products: [
        { id: 'so_100', title: '100 Gold', price: 8500, icon: '/images/gold.svg' },
        { id: 'so_310', title: '310 Gold', price: 24500, icon: '/images/gold.svg' },
        { id: 'so_520', title: '520 Gold', price: 39000, icon: '/images/gold.svg' },
        { id: 'so_1060', title: '1060 Gold', price: 76000, icon: '/images/gold.svg' },
        { id: 'so_2180', title: '2180 Gold', price: 148000, icon: '/images/gold.svg' },
      ],
    },
  ],

  apps: [
    {
      id: 'premium',
      title: 'Telegram Premium',
      icon: '/images/premium.svg',
      idLabel: 'Telegram username (@siz)',
      needsServerId: false,
      products: [
        { id: 'prem_1m', title: '1 oylik Premium', price: 89000, icon: '/images/premium.svg' },
        { id: 'prem_3m', title: '3 oylik Premium', price: 239000, icon: '/images/premium.svg' },
        { id: 'prem_12m', title: '12 oylik Premium', price: 799000, icon: '/images/premium.svg' },
      ],
    },
    {
      id: 'stars',
      title: 'Telegram Stars',
      icon: '/images/stars.svg',
      idLabel: 'Telegram username (@siz)',
      needsServerId: false,
      products: [
        { id: 'stars_50', title: '50 ⭐', price: 15000, icon: '/images/stars.svg' },
        { id: 'stars_100', title: '100 ⭐', price: 29000, icon: '/images/stars.svg' },
        { id: 'stars_500', title: '500 ⭐', price: 139000, icon: '/images/stars.svg' },
        { id: 'stars_1000', title: '1000 ⭐', price: 269000, icon: '/images/stars.svg' },
      ],
    },
    {
      id: 'nft',
      title: 'NFT',
      icon: '/images/nft.svg',
      idLabel: 'Telegram username (@siz)',
      needsServerId: false,
      isNft: true, // checkout ekranida Sotib olish / Ijaraga olish tanlovi chiqadi
      products: [
        { id: 'nft_plushpepe', title: 'Plush Pepe', icon: '/images/nft.svg', buyPrice: 25000000, rentPricePerDay: 150000 },
        { id: 'nft_durov', title: "Durov's Cap", icon: '/images/nft.svg', buyPrice: 8000000, rentPricePerDay: 60000 },
        { id: 'nft_lolpop', title: 'Lol Pop', icon: '/images/nft.svg', buyPrice: 1200000, rentPricePerDay: 15000 },
        { id: 'nft_astrsign', title: 'Astral Shard', icon: '/images/nft.svg', buyPrice: 3200000, rentPricePerDay: 30000 },
      ],
    },
  ],

  findGame(gameId) {
    return this.games.find((g) => g.id === gameId) || this.apps.find((g) => g.id === gameId);
  },

  findProduct(gameId, productId) {
    const game = this.findGame(gameId);
    if (!game) return null;
    const product = game.products.find((p) => p.id === productId);
    return product ? { ...product, game } : null;
  },
};
