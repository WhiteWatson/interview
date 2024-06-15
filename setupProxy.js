const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://3077y270w6.zicp.vip:48669',
      changeOrigin: true,
      pathRewrite: {
        '^/api': '',
      },
    })
  );
};
