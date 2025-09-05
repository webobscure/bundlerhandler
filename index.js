import fetch from 'node-fetch';

import { config } from 'dotenv';

config();



async function fetchProducts(pageInfo = null, accumulated = {}) {
const url = new URL(`https://${process.env.SHOP}.myshopify.com/admin/api/2023-07/products.json`);
url.searchParams.append('fields', 'handle,variants');
url.searchParams.append('limit', '250');
if (pageInfo) url.searchParams.append('page_info', pageInfo);

const res = await fetch(url, {
    headers: {
     'X-Shopify-Access-Token': process.env.ACCESS_TOKEN,
     'Content-Type': 'application/json',
    },
});

if (!res.ok) {
    throw new Error(`HTTP error! Status: ${res.status}`);
}

const data = await res.json();

data.products.forEach(product => {
    product.variants.forEach(variant => {
     if (variant.sku) {
        accumulated[variant.sku] = product.handle;
     }
    });
});

// Парсим заголовок Link
const linkHeader = res.headers.get('link');
if (linkHeader) {
    const nextLinkMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    if (nextLinkMatch) {
     const nextUrl = new URL(nextLinkMatch[1]);
     const nextPageInfo = nextUrl.searchParams.get('page_info');
     if (nextPageInfo) {
        // Рекурсивно вызываем для следующей страницы
        return fetchProducts(nextPageInfo, accumulated);
     }
    }
}

return accumulated;
}

fetchProducts()
.then(result => {
    const lines = Object.entries(result).map(([sku, handle]) => `${sku}|${handle}`);
    console.log(lines.join(",\n"));
})
.catch(console.error);