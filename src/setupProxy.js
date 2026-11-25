const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  // Google Identity popup needs COOP that allows window.postMessage back.
  app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    // Helps GIS load from accounts.google.com during local http://localhost use.
    res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
    next();
  });

  app.use(
    ['/api'],
    createProxyMiddleware({
      target: 'http://127.0.0.1:4000',
      changeOrigin: true,
    })
  );
};
