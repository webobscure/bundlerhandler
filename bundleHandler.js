const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

async function fetchProducts(pageInfo = null, accumulated = {}) {
  const url = new URL(
    `https://${process.env.SHOP}.myshopify.com/admin/api/2023-07/products.json`
  );
  url.searchParams.append("fields", "handle,title,variants,images");
  url.searchParams.append("limit", "250");
  if (pageInfo) url.searchParams.append("page_info", pageInfo);

  const res = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": process.env.ACCESS_TOKEN,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP error! Status: ${res.status}`);
  }

  const data = await res.json();

  data.products.forEach((product) => {
    const firstImage = product.images?.[0]?.src || null;
    product.variants.forEach((variant) => {
      if (variant.sku) {
        accumulated[variant.sku] = {
          handle: product.handle,
          image: firstImage,
          variantId: variant.id,
          title: variant.title || product.title,
          inventory_quantity: variant.inventory_quantity || 0,
        };
      }
    });
  });

  const linkHeader = res.headers.get("link");
  if (linkHeader) {
    const nextLinkMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    if (nextLinkMatch) {
      const nextUrl = new URL(nextLinkMatch[1]);
      const nextPageInfo = nextUrl.searchParams.get("page_info");
      if (nextPageInfo) {
        return fetchProducts(nextPageInfo, accumulated);
      }
    }
  }

  return accumulated;
}

fetchProducts()
  .then((result) => {
    const lines = Object.entries(result).map(
      ([sku, { handle, image, variantId, title, inventory_quantity }]) =>
        `{% assign product_images = product_images | append: '${sku}:${image}' | append: ',' %}\n` +
        `{% assign product_handles = product_handles | append: '${sku}:${handle}' | append: ',' %}\n` +
        `{% assign product_variant_ids = product_variant_ids | append: '${sku}:${variantId}' | append: ',' %}\n` +
        `{% assign product_titles = product_titles | append: '${sku}:${title}' | append: ',' %}\n` +
        `{% assign product_inventory = product_inventory | append: '${sku}:${inventory_quantity}' | append: ',' %}`
    );

    const filePath = path.join(__dirname, "products_output.txt");
    fs.writeFileSync(filePath, lines.join("\n\n"), "utf8");
    console.log(`Данные успешно записаны в ${filePath}`);
  })
  .catch(console.error);
