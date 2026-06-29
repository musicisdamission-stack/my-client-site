// NetiVana — Shopify Order Status Page Script
// Paste this into: Shopify Admin → Settings → Checkout → Order status page → Additional scripts
//
// BEFORE PASTING: Replace NETIVANA_VERCEL_URL below with your actual Vercel URL
// e.g. https://my-client-site.vercel.app

(function () {
  var VERCEL_URL = 'https://my-client-site-six.vercel.app';

  var PRODUCT_URLS = {
    '10386439078167': VERCEL_URL + '/downloads/prompts-la7f3a2b',   // Prompt Pack
    '10386439274775': VERCEL_URL + '/downloads/persona-la4e8d1f',   // Persona Kit
    '10386439864599': VERCEL_URL + '/downloads/content-la2b5c8e',   // Content Pack
    '10386439602455': VERCEL_URL + '/downloads/audit-la9a3f6c',     // Audit Template
  };

  if (typeof Shopify === 'undefined' || !Shopify.checkout) return;

  var lineItems = Shopify.checkout.line_items || [];
  var links = [];

  lineItems.forEach(function (item) {
    var id = String(item.product_id);
    if (PRODUCT_URLS[id]) {
      links.push({ title: item.title, url: PRODUCT_URLS[id] });
    }
  });

  if (links.length === 0) return;

  var html = '<div style="background:#09090b;border:1px solid #27272a;padding:28px 24px;margin:24px 0;font-family:system-ui,sans-serif;">'
    + '<p style="color:#71717a;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 16px;">Your Downloads — NetiVana</p>';

  links.forEach(function (link) {
    html += '<div style="margin-bottom:20px;">'
      + '<p style="color:#a1a1aa;font-size:12px;margin:0 0 6px;">' + link.title + '</p>'
      + '<a href="' + link.url + '" target="_blank" style="color:#fafafa;font-size:13px;font-family:monospace;word-break:break-all;text-decoration:none;border-bottom:1px solid #27272a;padding-bottom:2px;">'
      + link.url
      + '</a>'
      + '</div>';
  });

  html += '<p style="color:#52525b;font-size:11px;margin:20px 0 0;">'
    + 'Bookmark this page — this is your permanent access link. No login required.'
    + '</p></div>';

  var target = document.querySelector('.os-order-email')
    || document.querySelector('[data-order-update-options]')
    || document.querySelector('.main__header')
    || null;

  var container = document.createElement('div');
  container.innerHTML = html;

  if (target && target.parentNode) {
    target.parentNode.insertBefore(container, target.nextSibling);
  } else {
    document.body.insertBefore(container, document.body.firstChild);
  }
})();
